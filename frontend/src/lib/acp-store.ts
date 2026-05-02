/**
 * Multi-session ACP store — supports multiple concurrent agent sessions.
 *
 * Each session has its own AcpClient, state, and notification stream.
 * Backwards compatible: default session helpers still work.
 */

import {
  AcpClient,
  type AcpNotification,
  type AgentConfig,
  type ConnectionStatus,
  type SessionInfo,
} from "./acp-client";

// ─── Per-session state ───────────────────────────────────────────────────────

interface SessionState {
  client: AcpClient | null;
  status: ConnectionStatus;
  sessionInfo: SessionInfo | null;
  notifications: AcpNotification[];
  pendingPermission: {
    request: any;
    resolve: (r: any) => void;
    reject: (e: Error) => void;
  } | null;
  cwd: string;
  agentConfig: AgentConfig | null;
}

function createEmptySession(): SessionState {
  return {
    client: null,
    status: "disconnected",
    sessionInfo: null,
    notifications: [],
    pendingPermission: null,
    cwd: "",
    agentConfig: null,
  };
}

// ─── Multi-session store ────────────────────────────────────────────────────

type Subscriber = (sessionId: string) => void;

const sessions = new Map<string, SessionState>();
const subscribers = new Set<Subscriber>();
let defaultSessionId: string | null = null;

function notifySession(sessionId: string) {
  for (const cb of subscribers) cb(sessionId);
}

function getSessionState(id: string): SessionState {
  if (!sessions.has(id)) sessions.set(id, createEmptySession());
  return sessions.get(id)!;
}

function setSessionState(id: string, partial: Partial<SessionState>) {
  const state = getSessionState(id);
  Object.assign(state, partial);
  notifySession(id);
}

// ─── Session lifecycle ───────────────────────────────────────────────────────

export function createSession(
  sessionId: string,
  config: AgentConfig,
  cwd: string,
): void {
  if (sessions.has(sessionId)) return;

  const state: SessionState = {
    client: null,
    status: "disconnected",
    sessionInfo: null,
    notifications: [],
    pendingPermission: null,
    cwd,
    agentConfig: config,
  };
  sessions.set(sessionId, state);

  if (!defaultSessionId) defaultSessionId = sessionId;

  const client = new AcpClient({
    agentConfig: config,
    cwd,
    onNotification: (n) => {
      setSessionState(sessionId, {
        notifications: [...state.notifications, n],
      });
    },
    onStatusChange: (s) => {
      setSessionState(sessionId, { status: s });
    },
    onPermissionRequest: (req, resolve, reject) => {
      setSessionState(sessionId, {
        pendingPermission: { request: req, resolve, reject },
      });
    },
  });

  state.client = client;

  client
    .connect()
    .then((info) => {
      setSessionState(sessionId, { sessionInfo: info, status: "ready" });
    })
    .catch((err) => {
      console.error(`[acp-store] Session ${sessionId} connect failed:`, err);
      setSessionState(sessionId, { status: "disconnected" });
    });
}

export function closeSession(sessionId: string): void {
  const state = sessions.get(sessionId);
  if (state?.client) {
    state.client.disconnect().catch(() => {});
  }
  sessions.delete(sessionId);

  if (defaultSessionId === sessionId) {
    const keys = Array.from(sessions.keys());
    defaultSessionId = keys.length > 0 ? keys[keys.length - 1] : null;
  }

  notifySession(sessionId);
}

export function getSessionIds(): string[] {
  return Array.from(sessions.keys());
}

export function getDefaultSessionId(): string | null {
  return defaultSessionId;
}

export function setDefaultSessionId(id: string | null): void {
  if (id === null || sessions.has(id)) {
    defaultSessionId = id;
    notifySession("__meta__");
  }
}

// ─── Per-session access ──────────────────────────────────────────────────────

export function getSession(sessionId: string): SessionState {
  return getSessionState(sessionId);
}

export function subscribeToSession(
  sessionId: string,
  cb: (state: SessionState) => void,
): () => void {
  const wrapper: Subscriber = (id) => {
    if (id === sessionId || id === "__meta__") {
      cb(getSessionState(sessionId));
    }
  };
  subscribers.add(wrapper);
  cb(getSessionState(sessionId));
  return () => subscribers.delete(wrapper);
}

export function subscribeToMeta(cb: () => void): () => void {
  const wrapper: Subscriber = (id) => {
    if (id === "__meta__") cb();
  };
  subscribers.add(wrapper);
  return () => subscribers.delete(wrapper);
}

export function getClient(sessionId: string): AcpClient | null {
  return sessions.get(sessionId)?.client ?? null;
}

export function prompt(sessionId: string, text: string): Promise<void> {
  const client = getClient(sessionId);
  if (!client) throw new Error(`Session ${sessionId} not found`);
  return client.prompt(text).then(() => {});
}

export function cancel(sessionId: string): Promise<void> {
  const client = getClient(sessionId);
  if (!client) return Promise.resolve();
  return client.cancel();
}

export function getTerminalId(
  sessionId: string,
  toolCallId: string,
): string | undefined {
  return sessions.get(sessionId)?.client?.getTerminalId(toolCallId);
}

// ─── Backwards compat ────────────────────────────────────────────────────────

export function initialize(config: AgentConfig, cwd: string) {
  const id = `default-${Date.now()}`;
  createSession(id, config, cwd);
  return id;
}

export function disconnect() {
  if (defaultSessionId) closeSession(defaultSessionId);
}

export function reconnect(config: AgentConfig, cwd: string) {
  disconnect();
  const id = `default-${Date.now()}`;
  createSession(id, config, cwd);
  return id;
}

export function clearNotifications(sessionId?: string) {
  const ids = sessionId ? [sessionId] : getSessionIds();
  for (const id of ids) {
    const state = sessions.get(id);
    if (state) {
      state.notifications = [];
      notifySession(id);
    }
  }
}

export function subscribe(cb: () => void): () => void {
  if (!defaultSessionId) return () => {};
  return subscribeToSession(defaultSessionId, () => cb());
}

export function getState(): SessionState {
  if (!defaultSessionId) return createEmptySession();
  return getSessionState(defaultSessionId);
}

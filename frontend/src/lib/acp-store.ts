/**
 * Persistent ACP client store — lives outside React component tree
 * so closing/reopening the chat panel doesn't destroy the agent session.
 */

import {
  AcpClient,
  type AcpNotification,
  type AgentConfig,
  type ConnectionStatus,
  type SessionInfo,
} from "./acp-client";

type Subscriber = () => void;

interface StoreState {
  client: AcpClient | null;
  status: ConnectionStatus;
  sessionInfo: SessionInfo | null;
  notifications: AcpNotification[];
  pendingPermission: {
    request: any;
    resolve: (r: any) => void;
    reject: (e: Error) => void;
  } | null;
  initialized: boolean;
  cwd: string;
  agentConfig: AgentConfig | null;
}

const state: StoreState = {
  client: null,
  status: "disconnected",
  sessionInfo: null,
  notifications: [],
  pendingPermission: null,
  initialized: false,
  cwd: "",
  agentConfig: null,
};

const subscribers = new Set<Subscriber>();

function notify() {
  for (const cb of subscribers) cb();
}

function setState(partial: Partial<StoreState>) {
  Object.assign(state, partial);
  notify();
}

export function initialize(config: AgentConfig, cwd: string) {
  if (state.initialized) return;
  state.initialized = true;
  state.cwd = cwd;
  state.agentConfig = config;

  const client = new AcpClient({
    agentConfig: config,
    cwd,
    onNotification: (n) => {
      setState({ notifications: [...state.notifications, n] });
    },
    onStatusChange: (s) => {
      setState({ status: s });
    },
    onPermissionRequest: (req, resolve, reject) => {
      setState({ pendingPermission: { request: req, resolve, reject } });
    },
  });

  state.client = client;

  client
    .connect()
    .then((info) => {
      setState({ sessionInfo: info, status: "ready" });
    })
    .catch((err) => {
      console.error("[acp-store] Connect failed:", err);
      setState({ status: "disconnected" });
    });
}

export function disconnect() {
  if (state.client) {
    state.client.disconnect().catch(() => {});
  }
  state.client = null;
  state.initialized = false;
  setState({
    status: "disconnected",
    sessionInfo: null,
    notifications: [],
    pendingPermission: null,
    cwd: "",
    agentConfig: null,
  });
}

export function reconnect(config: AgentConfig, cwd: string) {
  disconnect();
  initialize(config, cwd);
}

export function clearNotifications() {
  setState({ notifications: [] });
}

export function subscribe(cb: Subscriber): () => void {
  subscribers.add(cb);
  return () => subscribers.delete(cb);
}

export function getState(): StoreState {
  return state;
}

// Expose client for imperative calls (prompt, cancel, etc.)
export function getClient(): AcpClient | null {
  return state.client;
}

// Expose terminal ID mapping for inline terminal rendering
export function getTerminalId(toolCallId: string): string | undefined {
  return state.client?.getTerminalId(toolCallId);
}

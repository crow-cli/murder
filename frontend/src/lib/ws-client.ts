interface WsRequest {
  id: number;
  method: string;
  params: Record<string, unknown>;
}

interface WsResponse {
  id: number;
  result?: unknown;
  error?: string;
}

interface WsNotification {
  method: string;
  params: Record<string, unknown>;
}

export type TerminalEventHandler = (event: {
  type: "data" | "exit" | "started";
  id: number;
  data?: string;
  exitCode?: number;
  shell?: string;
  pid?: number;
  cwd?: string;
}) => void;

export class WsClient {
  private nextId = 1;
  private pending = new Map<
    number,
    {
      resolve: (v: unknown) => void;
      reject: (e: string) => void;
    }
  >();
  public connected = false;
  public ws: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private terminalHandlers = new Set<TerminalEventHandler>();

  constructor(private url: string) {}

  connect(): Promise<void> {
    console.log("[ws] Connecting to", this.url);
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.url);
      this.ws.onopen = () => {
        this.connected = true;
        console.log("[ws] Connected");
        resolve();
      };
      this.ws.onclose = () => {
        this.connected = false;
        console.log("[ws] Disconnected");
        for (const [, { reject: rej }] of this.pending)
          rej("WebSocket disconnected");
        this.pending.clear();
        this.reconnectTimer = setTimeout(() => this.reconnect(), 2000);
      };
      this.ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        // Response (has id)
        if (msg.id !== undefined) {
          const handler = this.pending.get(msg.id);
          if (handler) {
            this.pending.delete(msg.id);
            if (msg.error) handler.reject(msg.error);
            else handler.resolve(msg.result);
          }
        }
        // Notification (no id, has method)
        else if (msg.method) {
          this.handleNotification(msg);
        }
      };
      this.ws.onerror = () => {
        console.error("[ws] Connection error");
        reject(new Error("WebSocket connection failed"));
      };
    });
  }

  private handleNotification(msg: WsNotification) {
    const { method, params } = msg;
    if (method.startsWith("terminal-")) {
      const type = method.replace("terminal-", "") as
        | "data"
        | "exit"
        | "started";
      const event = {
        type,
        id: params.id as number,
        ...(type === "data" && { data: params.data as string }),
        ...(type === "exit" && { exitCode: params.exit_code as number }),
        ...(type === "started" && {
          shell: params.shell as string,
          pid: params.pid as number,
          cwd: params.cwd as string,
        }),
      };
      for (const handler of this.terminalHandlers) {
        handler(event);
      }
    }
  }

  onTerminalEvent(handler: TerminalEventHandler): () => void {
    this.terminalHandlers.add(handler);
    return () => this.terminalHandlers.delete(handler);
  }

  private reconnect() {
    this.connect().catch(() => {});
  }

  disconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
  }

  async invoke<T = unknown>(
    method: string,
    params: Record<string, unknown> = {},
  ): Promise<T> {
    console.log("[ws] Invoking", method, params);
    if (!this.ws || !this.connected) {
      console.error("[ws] Not connected!", {
        ws: !!this.ws,
        connected: this.connected,
      });
      throw new Error("WebSocket not connected");
    }
    const id = this.nextId++;
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: (v) => resolve(v as T), reject });
      this.ws!.send(JSON.stringify({ id, method, params }));
    });
  }
}

// Use relative WebSocket path — same origin as frontend
export const ws = new WsClient(
  `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/ws`,
);

// Expose to window for debugging
(window as any).__ws_client = ws;

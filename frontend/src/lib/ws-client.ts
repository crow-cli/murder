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

export class WsClient {
  private ws: WebSocket | null = null;
  private nextId = 1;
  private pending = new Map<
    number,
    {
      resolve: (v: unknown) => void;
      reject: (e: string) => void;
    }
  >();
  public connected = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private url: string) {}

  connect(): Promise<void> {
    console.log('[ws] Connecting to', this.url);
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.url);
      this.ws.onopen = () => {
        this.connected = true;
        console.log('[ws] Connected');
        resolve();
      };
      this.ws.onclose = () => {
        this.connected = false;
        console.log('[ws] Disconnected');
        for (const [, { reject: rej }] of this.pending)
          rej("WebSocket disconnected");
        this.pending.clear();
        this.reconnectTimer = setTimeout(() => this.reconnect(), 2000);
      };
      this.ws.onmessage = (event) => {
        const msg: WsResponse = JSON.parse(event.data);
        if (msg.id !== undefined) {
          const handler = this.pending.get(msg.id);
          if (handler) {
            this.pending.delete(msg.id);
            if (msg.error) handler.reject(msg.error);
            else handler.resolve(msg.result);
          }
        }
      };
      this.ws.onerror = () => {
        console.error('[ws] Connection error');
        reject(new Error("WebSocket connection failed"));
      };
    });
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
    console.log('[ws] Invoking', method, params);
    if (!this.ws || !this.connected) {
      console.error('[ws] Not connected!', { ws: !!this.ws, connected: this.connected });
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

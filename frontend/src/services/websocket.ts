type EventCallback = (event: { event_type: string; data: unknown; timestamp: string }) => void;

export function resolveWebSocketUrl(): string {
  const envWsUrl = import.meta.env.VITE_WS_URL as string | undefined;
  if (envWsUrl && envWsUrl.trim()) {
    return envWsUrl.trim().replace(/\/+$/, '');
  }

  const envApiUrl = import.meta.env.VITE_API_URL as string | undefined;
  if (envApiUrl && envApiUrl.trim()) {
    const base = envApiUrl
      .trim()
      .replace(/\/+$/, '')
      .replace(/\/api$/, '')
      .replace(/^https:/i, 'wss:')
      .replace(/^http:/i, 'ws:');
    if (/^wss?:\/\//i.test(base)) {
      return `${base}/ws/live`;
    }
  }

  const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${wsProto}//127.0.0.1:8000/ws/live`;
}

class WebSocketClient {
  private socket: WebSocket | null = null;
  private url: string;
  private listeners: EventCallback[] = [];
  private reconnectInterval: number = 3000;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private isExplicitlyClosed: boolean = false;
  public isConnected: boolean = false;

  constructor() {
    this.url = resolveWebSocketUrl();
  }

  public getUrl(): string {
    return this.url;
  }

  public connect() {
    this.isExplicitlyClosed = false;
    try {
      this.socket = new WebSocket(this.url);

      this.socket.onopen = () => {
        this.isConnected = true;
        console.log('[FraudShield WS] Connected to live event stream');
      };

      this.socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.notify(data);
        } catch {
          // ignore non-json ping/pong
        }
      };

      this.socket.onclose = () => {
        this.isConnected = false;
        if (!this.isExplicitlyClosed) {
          this.scheduleReconnect();
        }
      };

      this.socket.onerror = (err) => {
        console.warn('[FraudShield WS] Connection issue:', err);
        this.socket?.close();
      };
    } catch {
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      console.log('[FraudShield WS] Attempting reconnection...');
      this.connect();
    }, this.reconnectInterval);
  }

  public subscribe(callback: EventCallback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter((cb) => cb !== callback);
    };
  }

  private notify(data: { event_type: string; data: unknown; timestamp: string }) {
    this.listeners.forEach((callback) => {
      try {
        callback(data);
      } catch (err) {
        console.error('[FraudShield WS] Listener error:', err);
      }
    });
  }

  public disconnect() {
    this.isExplicitlyClosed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.isConnected = false;
  }
}

export const liveSocket = new WebSocketClient();

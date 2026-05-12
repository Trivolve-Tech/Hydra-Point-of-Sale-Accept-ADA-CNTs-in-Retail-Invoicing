import { EventEmitter } from "events";
import WebSocket from "ws";
import type { HydraClientConfig } from "./config";
import { webSocketUrl } from "./config";
import type { HydraInboundMessage } from "./types";
import { parseHydraMessage } from "./parser";

export class HydraSession extends EventEmitter {
  private config: HydraClientConfig;
  private ws: WebSocket | null = null;

  constructor(config: HydraClientConfig) {
    super();
    this.config = config;
  }

  get isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  connect(): Promise<void> {
    if (this.ws) return Promise.resolve();

    return new Promise<void>((resolve, reject) => {
      const url = webSocketUrl(this.config);
      const ws = new WebSocket(url);
      this.ws = ws;

      ws.once("open", () => {
        resolve();
      });

      ws.once("error", (err: Error) => {
        if (ws.readyState !== WebSocket.OPEN) {
          this.ws = null;
          reject(err);
        }
      });

      ws.on("message", (data: WebSocket.Data) => {
        const text = typeof data === "string" ? data : data.toString("utf-8");
        try {
          const msg: HydraInboundMessage = parseHydraMessage(text);
          this.emit("message", msg);
        } catch (e) {
          this.emit("error", e);
        }
      });

      ws.on("error", (err: Error) => {
        this.emit("error", err);
      });

      ws.on("close", () => {
        this.ws = null;
        this.emit("close");
      });
    });
  }

  send(clientInput: Record<string, unknown>): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("HydraSession.connect() must be called before send()");
    }
    this.ws.send(JSON.stringify(clientInput));
  }

  async close(): Promise<void> {
    const ws = this.ws;
    if (!ws) return;

    return new Promise<void>((resolve) => {
      ws.once("close", () => {
        this.ws = null;
        resolve();
      });
      ws.close();
    });
  }

  async dispose(): Promise<void> {
    await this.close();
    this.removeAllListeners();
  }
}

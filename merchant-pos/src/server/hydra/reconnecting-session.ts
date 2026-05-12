import { EventEmitter } from "events";
import type { HydraClientConfig } from "./config";
import type { HydraReconnectPolicy } from "./reconnect-policy";
import { DEFAULT_RECONNECT_POLICY, delayForAttempt } from "./reconnect-policy";
import { HydraSession } from "./session";
import type { HydraInboundMessage } from "./types";
import { HydraConnectionState } from "./types";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class ReconnectingHydraSession extends EventEmitter {
  readonly config: HydraClientConfig;
  readonly policy: HydraReconnectPolicy;

  private session: HydraSession | null = null;
  private userStop = true;
  private failAttempt = 0;
  private currentState: HydraConnectionState = HydraConnectionState.disconnected;
  private opChain: Promise<void> = Promise.resolve();

  constructor(
    config: HydraClientConfig,
    policy?: HydraReconnectPolicy,
  ) {
    super();
    this.config = config;
    this.policy = policy ?? DEFAULT_RECONNECT_POLICY;
  }

  get state(): HydraConnectionState {
    return this.currentState;
  }

  get isConnected(): boolean {
    return (
      this.currentState === HydraConnectionState.connected &&
      this.session !== null
    );
  }

  private emitState(s: HydraConnectionState) {
    this.currentState = s;
    this.emit("connectionState", s);
  }

  private serialized(fn: () => Promise<void>): Promise<void> {
    const p = this.opChain.then(fn).catch(() => {});
    this.opChain = p;
    return p;
  }

  async connect(): Promise<void> {
    this.userStop = false;
    return this.serialized(async () => {
      if (this.isConnected) return;
      this.failAttempt = 0;

      while (!this.userStop) {
        this.emitState(HydraConnectionState.connecting);
        try {
          await this.openSession();
          this.failAttempt = 0;
          this.emitState(HydraConnectionState.connected);
          return;
        } catch {
          if (this.userStop) break;
          if (!this.policy.autoReconnect) {
            await this.tearDownSession();
            this.emitState(HydraConnectionState.disconnected);
            return;
          }
          this.emitState(HydraConnectionState.reconnecting);
          await sleep(delayForAttempt(this.policy, this.failAttempt));
          if (this.userStop) break;
          this.failAttempt++;
        }
      }
      await this.tearDownSession();
      this.emitState(HydraConnectionState.disconnected);
    });
  }

  private async openSession(): Promise<void> {
    await this.tearDownSession();
    const session = new HydraSession(this.config);
    this.session = session;

    session.on("message", (msg: HydraInboundMessage) => {
      this.emit("message", msg);
    });
    session.on("error", (err: Error) => {
      this.emit("error", err);
    });
    session.on("close", () => {
      this.onSessionDone();
    });

    await session.connect();
  }

  private onSessionDone() {
    void this.serialized(async () => {
      const s = this.session;
      this.session = null;
      if (s) await s.dispose();

      if (this.userStop || !this.policy.autoReconnect) {
        this.emitState(HydraConnectionState.disconnected);
        return;
      }

      this.failAttempt = 0;
      while (!this.userStop && this.policy.autoReconnect) {
        this.emitState(HydraConnectionState.reconnecting);
        await sleep(delayForAttempt(this.policy, this.failAttempt));
        if (this.userStop) break;
        this.failAttempt++;
        this.emitState(HydraConnectionState.connecting);
        try {
          await this.openSession();
          this.failAttempt = 0;
          this.emitState(HydraConnectionState.connected);
          return;
        } catch {
          if (this.userStop) break;
        }
      }
      await this.tearDownSession();
      this.emitState(HydraConnectionState.disconnected);
    });
  }

  private async tearDownSession() {
    const s = this.session;
    this.session = null;
    if (s) await s.dispose();
  }

  send(clientInput: Record<string, unknown>): void {
    if (!this.session || !this.session.isConnected) {
      throw new Error(
        "ReconnectingHydraSession is not connected; call connect() first.",
      );
    }
    this.session.send(clientInput);
  }

  async disconnect(): Promise<void> {
    return this.serialized(async () => {
      this.userStop = true;
      await this.tearDownSession();
      this.emitState(HydraConnectionState.disconnected);
    });
  }

  async dispose(): Promise<void> {
    await this.disconnect();
    this.removeAllListeners();
  }
}

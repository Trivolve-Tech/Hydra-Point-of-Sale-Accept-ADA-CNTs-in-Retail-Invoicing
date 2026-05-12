import { EventEmitter } from "events";
import type { HydraClientConfig } from "./config";
import { ClientInput } from "./client-input";
import { HydraHttpClient } from "./hydra-http";
import type { HydraReconnectPolicy } from "./reconnect-policy";
import { ReconnectingHydraSession } from "./reconnecting-session";
import { SeqTracker, HydraSyncPolicy } from "./seq-tracker";
import type { HydraStateStore } from "./state-store";
import { InMemoryHydraStateStore } from "./state-store";
import type { HydraInboundMessage } from "./types";
import { HydraConnectionState } from "./types";

export interface HydraHeadFacadeOptions {
  config: HydraClientConfig;
  reconnectPolicy?: HydraReconnectPolicy;
  syncPolicy?: HydraSyncPolicy;
  stateStore?: HydraStateStore;
  onSeqGap?: (lastSeq: number, receivedSeq: number) => void;
}

export class HydraHeadFacade extends EventEmitter {
  readonly hydraHttp: HydraHttpClient;
  readonly config: HydraClientConfig;
  readonly stateStore: HydraStateStore;

  private session: ReconnectingHydraSession;
  private seq: SeqTracker;
  private messageHandler: ((msg: HydraInboundMessage) => void) | null = null;

  constructor(opts: HydraHeadFacadeOptions) {
    super();
    this.config = opts.config;
    this.stateStore = opts.stateStore ?? new InMemoryHydraStateStore();

    this.hydraHttp = new HydraHttpClient(opts.config);
    this.session = new ReconnectingHydraSession(
      opts.config,
      opts.reconnectPolicy,
    );

    const syncPolicy = opts.syncPolicy ?? HydraSyncPolicy.none;
    this.seq = new SeqTracker({
      policy: syncPolicy,
      store: this.stateStore,
      http: syncPolicy === HydraSyncPolicy.dedupeAndRefreshOnGap ? this.hydraHttp : undefined,
      onSeqGap: opts.onSeqGap,
    });

    this.session.on("connectionState", (s: HydraConnectionState) => {
      this.emit("connectionState", s);
    });
  }

  get lastProcessedSeq(): number | null {
    return this.seq.lastSeq;
  }

  get connectionStateValue(): HydraConnectionState {
    return this.session.state;
  }

  async connect(restoreSeq = true): Promise<void> {
    if (this.messageHandler) {
      this.session.removeListener("message", this.messageHandler);
    }
    if (restoreSeq) {
      await this.seq.restore();
    } else {
      this.seq.reset();
    }

    this.messageHandler = (msg: HydraInboundMessage) => {
      void this.seq.process(msg).then((filtered) => {
        if (filtered) this.emit("message", filtered);
      });
    };
    this.session.on("message", this.messageHandler);
    await this.session.connect();
  }

  async disconnect(): Promise<void> {
    if (this.messageHandler) {
      this.session.removeListener("message", this.messageHandler);
      this.messageHandler = null;
    }
    await this.session.disconnect();
  }

  sendInit() { this.session.send(ClientInput.init()); }
  sendClose() { this.session.send(ClientInput.close()); }
  sendSafeClose() { this.session.send(ClientInput.safeClose()); }
  sendContest() { this.session.send(ClientInput.contest()); }
  sendFanout() { this.session.send(ClientInput.fanout()); }

  sendNewTx(transaction: Record<string, unknown>) {
    this.session.send(ClientInput.newTx(transaction));
  }

  sendRecover(recoverTxId: string) {
    this.session.send(ClientInput.recover(recoverTxId));
  }

  sendDecommit(decommitTx: Record<string, unknown>) {
    this.session.send(ClientInput.decommit(decommitTx));
  }

  sendSideLoadSnapshot(snapshot: Record<string, unknown>) {
    this.session.send(ClientInput.sideLoadSnapshot(snapshot));
  }

  sendRaw(clientInput: Record<string, unknown>) {
    this.session.send(clientInput);
  }

  async dispose(): Promise<void> {
    await this.disconnect();
    await this.session.dispose();
    this.removeAllListeners();
  }
}

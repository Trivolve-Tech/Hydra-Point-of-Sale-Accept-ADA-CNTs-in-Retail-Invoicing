import { HydraHeadFacade } from "./hydra-head-facade";
import { HydraConnectionState } from "./types";
import type { HydraInboundMessage } from "./types";

export type SettlementLayer = "L1" | "L2";

export interface L2SubmitResult {
  success: boolean;
  transactionId?: string;
  error?: string;
}

export class HydraPaymentRouter {
  private facade: HydraHeadFacade;

  constructor(facade: HydraHeadFacade) {
    this.facade = facade;
  }

  async isHydraAvailable(): Promise<boolean> {
    try {
      const resp = await this.facade.hydraHttp.getHeadState();
      const data = resp.data as Record<string, unknown>;
      if (data.tag !== "Open") return false;
      const ws = this.facade.connectionStateValue;
      return ws === HydraConnectionState.connected ||
        ws === HydraConnectionState.connecting ||
        ws === HydraConnectionState.reconnecting;
    } catch {
      return false;
    }
  }

  async getHeadStatus(): Promise<{
    available: boolean;
    headState: string;
    headId?: string;
    connectionState: HydraConnectionState;
  }> {
    const connectionState = this.facade.connectionStateValue;
    try {
      const resp = await this.facade.hydraHttp.getHeadState();
      const data = resp.data as Record<string, unknown>;
      const headState = (data.tag as string) ?? "Unknown";
      const headId = data.headId as string | undefined;
      return {
        available: headState === "Open" && connectionState !== HydraConnectionState.disconnected,
        headState,
        headId,
        connectionState,
      };
    } catch {
      return {
        available: false,
        headState: "Unreachable",
        connectionState,
      };
    }
  }

  async selectSettlementLayer(preferHydra: boolean): Promise<SettlementLayer> {
    if (!preferHydra) return "L1";
    const available = await this.isHydraAvailable();
    return available ? "L2" : "L1";
  }

  async submitL2Transaction(cborHex: string, description?: string): Promise<L2SubmitResult> {
    // Wait up to 5s for the WS to come up — the facade's connect() is
    // fire-and-forget so the first call after registry construction may
    // race the socket handshake.
    const start = Date.now();
    while (this.facade.connectionStateValue !== HydraConnectionState.connected) {
      if (Date.now() - start > 5000) {
        return {
          success: false,
          error: `WebSocket did not connect (state=${this.facade.connectionStateValue})`,
        };
      }
      await new Promise((r) => setTimeout(r, 100));
    }

    const body = {
      cborHex,
      type: "Witnessed Tx ConwayEra",
      description: description ?? "hydra-pos-payment",
    };

    return new Promise<L2SubmitResult>((resolve) => {
      const timeout = setTimeout(() => {
        cleanup();
        resolve({ success: false, error: "L2 submission timed out (5s)" });
      }, 5000);

      const onMessage = (msg: HydraInboundMessage) => {
        if (msg.tag === "TxValid") {
          cleanup();
          resolve({
            success: true,
            transactionId: msg.json.transactionId as string | undefined,
          });
        } else if (msg.tag === "TxInvalid") {
          cleanup();
          resolve({
            success: false,
            error: (msg.json.validationError as string) ?? "Transaction invalid",
          });
        }
      };

      const cleanup = () => {
        clearTimeout(timeout);
        this.facade.removeListener("message", onMessage);
      };

      this.facade.on("message", onMessage);

      try {
        this.facade.sendNewTx(body);
      } catch (err) {
        cleanup();
        resolve({
          success: false,
          error: err instanceof Error ? err.message : "Failed to send L2 transaction",
        });
      }
    });
  }
}

import { configFromEnv } from "./config";
import { HydraHeadFacade } from "./hydra-head-facade";
import { HydraSyncPolicy } from "./seq-tracker";
import { FileHydraStateStore } from "./state-store";
import { HydraPaymentRouter } from "./payment-router";
import { getMetricsCollector } from "./metrics";
import type { HydraConnectionState } from "./types";

let facade: HydraHeadFacade | null = null;
let router: HydraPaymentRouter | null = null;
let shutdownRegistered = false;

function isEnabled(): boolean {
  return process.env.HYDRA_ENABLE === "true";
}

export function getHydraFacade(): HydraHeadFacade | null {
  if (!isEnabled()) return null;
  if (facade) return facade;

  const config = configFromEnv();
  if (!config) return null;

  facade = new HydraHeadFacade({
    config,
    syncPolicy: HydraSyncPolicy.dedupeOnly,
    stateStore: new FileHydraStateStore(),
  });

  facade.on("connectionState", (state: HydraConnectionState) => {
    getMetricsCollector().recordConnection(state);
  });

  void facade.connect().catch((err) => {
    console.error("[hydra] initial connect failed:", err);
  });

  registerShutdown();
  return facade;
}

export function getHydraRouter(): HydraPaymentRouter | null {
  const f = getHydraFacade();
  if (!f) return null;
  if (router) return router;
  router = new HydraPaymentRouter(f);
  return router;
}

function registerShutdown() {
  if (shutdownRegistered) return;
  shutdownRegistered = true;

  const cleanup = () => {
    if (facade) {
      void facade.dispose().catch(() => {});
      facade = null;
      router = null;
    }
  };

  process.on("SIGTERM", cleanup);
  process.on("SIGINT", cleanup);
}

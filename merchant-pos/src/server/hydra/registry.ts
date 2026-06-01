import { configFromEnv, type HydraClientConfig } from "./config";
import { HydraHeadFacade } from "./hydra-head-facade";
import { HydraHttpClient } from "./hydra-http";
import { HydraPaymentRouter } from "./payment-router";
import { HydraSyncPolicy } from "./seq-tracker";
import { InMemoryHydraStateStore } from "./state-store";
import { getMetricsCollector } from "./metrics";
import type { HydraConnectionState } from "./types";
import { getHeadById } from "~/server/heads";

// The dev solo head defined in infra/docker/compose.preprod.yml is addressable
// only through the legacy env vars (HYDRA_NODE_HOST/PORT). Routes treat the
// literal head id "dev" as a request for that head.
export const DEV_HEAD_ID = "dev";

export class HydraHeadRegistry {
  private facades = new Map<string, HydraHeadFacade>();
  private routers = new Map<string, HydraPaymentRouter>();

  async getFacade(headId: string): Promise<HydraHeadFacade | null> {
    const cached = this.facades.get(headId);
    if (cached) return cached;

    const config = await configForHead(headId);
    if (!config) return null;

    const facade = new HydraHeadFacade({
      config,
      syncPolicy: HydraSyncPolicy.dedupeOnly,
      stateStore: new InMemoryHydraStateStore(),
    });
    facade.on("connectionState", (s: HydraConnectionState) => {
      getMetricsCollector().recordConnection(s);
    });
    void facade.connect().catch((err) => {
      console.error(`[hydra] initial connect failed for head ${headId}:`, err);
    });

    this.facades.set(headId, facade);
    return facade;
  }

  async getRouter(headId: string): Promise<HydraPaymentRouter | null> {
    const cached = this.routers.get(headId);
    if (cached) return cached;
    const facade = await this.getFacade(headId);
    if (!facade) return null;
    const router = new HydraPaymentRouter(facade);
    this.routers.set(headId, router);
    return router;
  }

  async close(headId: string): Promise<void> {
    const facade = this.facades.get(headId);
    if (facade) {
      await facade.dispose();
      this.facades.delete(headId);
      this.routers.delete(headId);
    }
  }

  list(): string[] {
    return Array.from(this.facades.keys());
  }

  async disposeAll(): Promise<void> {
    for (const id of this.list()) {
      await this.close(id);
    }
  }
}

let registry: HydraHeadRegistry | null = null;
let shutdownRegistered = false;

export function getHydraRegistry(): HydraHeadRegistry {
  if (!registry) {
    registry = new HydraHeadRegistry();
    if (!shutdownRegistered) {
      shutdownRegistered = true;
      const cleanup = () => {
        if (registry) {
          void registry.disposeAll().catch(() => {});
          registry = null;
        }
      };
      process.on("SIGTERM", cleanup);
      process.on("SIGINT", cleanup);
    }
  }
  return registry;
}

// Convenience for HTTP-only routes (/snapshot/utxo, /protocol-parameters)
// that don't need a long-lived WebSocket facade.
export async function makeHydraHttpClient(
  headId: string,
): Promise<HydraHttpClient | null> {
  const config = await configForHead(headId);
  if (!config) return null;
  return new HydraHttpClient(config);
}

async function configForHead(headId: string): Promise<HydraClientConfig | null> {
  if (headId === DEV_HEAD_ID) return configFromEnv();
  const head = await getHeadById(headId);
  if (!head) return null;
  return {
    host: process.env.HYDRA_NODE_HOST ?? "localhost",
    port: head.merchantApiPort,
    secure: process.env.HYDRA_NODE_SECURE === "true",
  };
}

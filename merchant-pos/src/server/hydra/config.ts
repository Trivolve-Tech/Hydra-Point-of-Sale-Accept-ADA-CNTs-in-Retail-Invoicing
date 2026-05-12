export interface HydraClientConfig {
  host: string;
  port: number;
  secure: boolean;
  history?: boolean;
  snapshotUtxo?: boolean;
  addressFilter?: string;
}

export function createConfig(opts: Partial<HydraClientConfig> & { host: string }): HydraClientConfig {
  return {
    port: 4001,
    secure: false,
    ...opts,
  };
}

export function configFromEnv(): HydraClientConfig | null {
  const host = process.env.HYDRA_NODE_HOST;
  if (!host) return null;
  return {
    host,
    port: parseInt(process.env.HYDRA_NODE_PORT ?? "4001", 10),
    secure: process.env.HYDRA_NODE_SECURE === "true",
  };
}

export function webSocketUrl(config: HydraClientConfig): string {
  const scheme = config.secure ? "wss" : "ws";
  const params = new URLSearchParams();
  if (config.history !== undefined) {
    params.set("history", config.history ? "yes" : "no");
  }
  if (config.snapshotUtxo !== undefined) {
    params.set("snapshot-utxo", config.snapshotUtxo ? "yes" : "no");
  }
  if (config.addressFilter) {
    params.set("address", config.addressFilter);
  }
  const qs = params.toString();
  return `${scheme}://${config.host}:${config.port}/${qs ? `?${qs}` : ""}`;
}

export function httpUrl(config: HydraClientConfig, path: string): string {
  const scheme = config.secure ? "https" : "http";
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${scheme}://${config.host}:${config.port}${p}`;
}

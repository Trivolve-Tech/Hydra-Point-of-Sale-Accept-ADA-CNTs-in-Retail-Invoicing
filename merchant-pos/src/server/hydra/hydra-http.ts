import axios from "axios";
import type { AxiosInstance, AxiosResponse } from "axios";
import type { HydraClientConfig } from "./config";
import { httpUrl } from "./config";

export class HydraHttpClient {
  private config: HydraClientConfig;
  private client: AxiosInstance;

  constructor(config: HydraClientConfig, client?: AxiosInstance) {
    this.config = config;
    this.client = client ?? axios.create({ timeout: 10_000 });
  }

  async postCommit(body: unknown): Promise<AxiosResponse> {
    return this.jsonPost("/commit", body);
  }

  async postCardanoTransaction(body: unknown): Promise<AxiosResponse> {
    return this.jsonPost("/cardano-transaction", body);
  }

  async postTransaction(body: unknown): Promise<AxiosResponse> {
    return this.jsonPost("/transaction", body);
  }

  async getProtocolParameters(): Promise<AxiosResponse> {
    return this.client.get(httpUrl(this.config, "/protocol-parameters"));
  }

  async getSnapshotUtxo(): Promise<AxiosResponse> {
    return this.client.get(httpUrl(this.config, "/snapshot/utxo"));
  }

  async getSnapshotLastSeen(): Promise<AxiosResponse> {
    return this.client.get(httpUrl(this.config, "/snapshot/last-seen"));
  }

  async getSnapshot(): Promise<AxiosResponse> {
    return this.client.get(httpUrl(this.config, "/snapshot"));
  }

  async postSnapshot(body: unknown): Promise<AxiosResponse> {
    return this.jsonPost("/snapshot", body);
  }

  async postDecommit(body: unknown): Promise<AxiosResponse> {
    return this.jsonPost("/decommit", body);
  }

  async getHeadState(): Promise<AxiosResponse> {
    return this.client.get(httpUrl(this.config, "/head"));
  }

  async getHeadInitialization(): Promise<AxiosResponse> {
    return this.client.get(httpUrl(this.config, "/head-initialization"));
  }

  async getPendingCommits(): Promise<AxiosResponse> {
    return this.client.get(httpUrl(this.config, "/commits"));
  }

  async deleteCommitTx(txId: string): Promise<AxiosResponse> {
    const enc = encodeURIComponent(txId);
    return this.client.delete(httpUrl(this.config, `/commits/${enc}`));
  }

  private async jsonPost(path: string, body: unknown): Promise<AxiosResponse> {
    return this.client.post(httpUrl(this.config, path), body, {
      headers: { "Content-Type": "application/json" },
    });
  }
}

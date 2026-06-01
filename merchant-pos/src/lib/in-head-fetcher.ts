import axios from "axios";
import type {
  AccountInfo,
  Asset,
  AssetMetadata,
  BlockInfo,
  GovernanceProposalInfo,
  IFetcher,
  Protocol,
  TransactionInfo,
  UTxO,
} from "@meshsdk/core";

// Shape of /snapshot/utxo entries returned by hydra-node 1.3.0:
//   { "<txhash>#<ix>": { address, value: { lovelace, "<policyId>.<assetName>": qty, ... }, datum?, ... } }
type HydraUtxoEntry = {
  address: string;
  value: Record<string, number>;
};

type HydraUtxosResponse = {
  utxos: Record<string, HydraUtxoEntry>;
};

export type HydraHeadFetcherOptions = {
  baseUrl?: string;
  /** Head id to route the requests to. Omit to target the dev solo head. */
  headId?: string;
};

const NOT_SUPPORTED = "Operation not supported inside a Hydra head";

// Standard Cardano mainnet protocol parameter values, used to fill any field
// hydra-node does not return. The in-head ledger generally returns L1's
// parameters, but we keep these as a safety net so building never fails on a
// missing key.
const PROTOCOL_DEFAULTS: Protocol = {
  epoch: 0,
  minFeeA: 44,
  minFeeB: 155381,
  maxBlockSize: 90112,
  maxTxSize: 16384,
  maxBlockHeaderSize: 1100,
  keyDeposit: 2000000,
  poolDeposit: 500000000,
  decentralisation: 0,
  minPoolCost: "340000000",
  priceMem: 0.0577,
  priceStep: 0.0000721,
  maxTxExMem: "14000000",
  maxTxExSteps: "10000000000",
  maxBlockExMem: "62000000",
  maxBlockExSteps: "20000000000",
  maxValSize: 5000,
  collateralPercent: 150,
  maxCollateralInputs: 3,
  coinsPerUtxoSize: 4310,
  minFeeRefScriptCostPerByte: 15,
};

export class HydraHeadFetcher implements IFetcher {
  private baseUrl: string;
  private headId: string | undefined;

  constructor(opts: HydraHeadFetcherOptions = {}) {
    this.baseUrl = opts.baseUrl ?? "/api/hydra";
    this.headId = opts.headId;
  }

  async fetchAddressUTxOs(address: string): Promise<UTxO[]> {
    const { data } = await axios.get<HydraUtxosResponse>(
      `${this.baseUrl}/utxos`,
      { params: { address, ...(this.headId ? { head_id: this.headId } : {}) } },
    );
    return hydraUtxoMapToMesh(data.utxos ?? {});
  }

  async fetchProtocolParameters(_epoch: number): Promise<Protocol> {
    const { data } = await axios.get<Record<string, unknown>>(
      `${this.baseUrl}/protocol-parameters`,
      { params: this.headId ? { head_id: this.headId } : {} },
    );
    return cardanoCliProtocolToMesh(data);
  }

  // Methods below are not meaningful inside a head — fail loudly rather than
  // silently returning wrong data.
  fetchAccountInfo(_address: string): Promise<AccountInfo> { return Promise.reject(new Error(NOT_SUPPORTED)); }
  fetchAssetAddresses(_asset: string): Promise<{ address: string; quantity: string }[]> { return Promise.reject(new Error(NOT_SUPPORTED)); }
  fetchAssetMetadata(_asset: string): Promise<AssetMetadata> { return Promise.reject(new Error(NOT_SUPPORTED)); }
  fetchBlockInfo(_hash: string): Promise<BlockInfo> { return Promise.reject(new Error(NOT_SUPPORTED)); }
  fetchCollectionAssets(_policyId: string): Promise<{ assets: Asset[]; next?: string | number | null }> { return Promise.reject(new Error(NOT_SUPPORTED)); }
  fetchTxInfo(_hash: string): Promise<TransactionInfo> { return Promise.reject(new Error(NOT_SUPPORTED)); }
  fetchUTxOs(_hash: string, _index?: number): Promise<UTxO[]> { return Promise.reject(new Error(NOT_SUPPORTED)); }
  fetchGovernanceProposal(_txHash: string, _certIndex: number): Promise<GovernanceProposalInfo> { return Promise.reject(new Error(NOT_SUPPORTED)); }
  get(_url: string): Promise<unknown> { return Promise.reject(new Error(NOT_SUPPORTED)); }
}

function hydraUtxoMapToMesh(map: Record<string, HydraUtxoEntry>): UTxO[] {
  const out: UTxO[] = [];
  for (const [key, entry] of Object.entries(map)) {
    const hashIxIndex = key.indexOf("#");
    if (hashIxIndex < 0) continue;
    const txHash = key.slice(0, hashIxIndex);
    const outputIndex = Number(key.slice(hashIxIndex + 1));
    if (!txHash || Number.isNaN(outputIndex)) continue;
    out.push({
      input: { txHash, outputIndex },
      output: {
        address: entry.address,
        amount: hydraValueToAssets(entry.value),
      },
    });
  }
  return out;
}

function hydraValueToAssets(value: Record<string, number>): Asset[] {
  const assets: Asset[] = [];
  for (const [unit, qty] of Object.entries(value ?? {})) {
    if (unit === "lovelace") {
      assets.push({ unit: "lovelace", quantity: String(qty) });
    } else {
      // Hydra serialises native tokens as "<policyId>.<assetNameHex>".
      // Mesh expects "<policyId><assetNameHex>" (no separator).
      const meshUnit = unit.replace(".", "");
      assets.push({ unit: meshUnit, quantity: String(qty) });
    }
  }
  return assets;
}

function cardanoCliProtocolToMesh(p: Record<string, unknown>): Protocol {
  const num = (v: unknown): number | undefined =>
    typeof v === "number" ? v : undefined;
  const str = (v: unknown): string | undefined =>
    typeof v === "string"
      ? v
      : typeof v === "number"
        ? String(v)
        : undefined;
  const nested = (key: string): Record<string, unknown> | undefined => {
    const v = p[key];
    return v && typeof v === "object" ? (v as Record<string, unknown>) : undefined;
  };

  const exec = nested("executionUnitPrices");
  const txEx = nested("maxTxExecutionUnits");
  const blockEx = nested("maxBlockExecutionUnits");

  const overrides: Partial<Protocol> = {
    epoch: num(p.epoch) ?? PROTOCOL_DEFAULTS.epoch,
    minFeeA: num(p.txFeePerByte) ?? num(p.minFeeA) ?? PROTOCOL_DEFAULTS.minFeeA,
    minFeeB: num(p.txFeeFixed) ?? num(p.minFeeB) ?? PROTOCOL_DEFAULTS.minFeeB,
    maxBlockSize:
      num(p.maxBlockBodySize) ?? num(p.maxBlockSize) ?? PROTOCOL_DEFAULTS.maxBlockSize,
    maxTxSize: num(p.maxTxSize) ?? PROTOCOL_DEFAULTS.maxTxSize,
    maxBlockHeaderSize:
      num(p.maxBlockHeaderSize) ?? PROTOCOL_DEFAULTS.maxBlockHeaderSize,
    keyDeposit:
      num(p.stakeAddressDeposit) ?? num(p.keyDeposit) ?? PROTOCOL_DEFAULTS.keyDeposit,
    poolDeposit:
      num(p.stakePoolDeposit) ?? num(p.poolDeposit) ?? PROTOCOL_DEFAULTS.poolDeposit,
    decentralisation: num(p.decentralisation) ?? PROTOCOL_DEFAULTS.decentralisation,
    minPoolCost: str(p.minPoolCost) ?? PROTOCOL_DEFAULTS.minPoolCost,
    priceMem:
      num(exec?.priceMemory) ?? num(p.priceMem) ?? PROTOCOL_DEFAULTS.priceMem,
    priceStep:
      num(exec?.priceSteps) ?? num(p.priceStep) ?? PROTOCOL_DEFAULTS.priceStep,
    maxTxExMem: str(txEx?.memory) ?? str(p.maxTxExMem) ?? PROTOCOL_DEFAULTS.maxTxExMem,
    maxTxExSteps: str(txEx?.steps) ?? str(p.maxTxExSteps) ?? PROTOCOL_DEFAULTS.maxTxExSteps,
    maxBlockExMem:
      str(blockEx?.memory) ?? str(p.maxBlockExMem) ?? PROTOCOL_DEFAULTS.maxBlockExMem,
    maxBlockExSteps:
      str(blockEx?.steps) ?? str(p.maxBlockExSteps) ?? PROTOCOL_DEFAULTS.maxBlockExSteps,
    maxValSize: num(p.maxValueSize) ?? num(p.maxValSize) ?? PROTOCOL_DEFAULTS.maxValSize,
    collateralPercent:
      num(p.collateralPercentage) ?? num(p.collateralPercent) ?? PROTOCOL_DEFAULTS.collateralPercent,
    maxCollateralInputs:
      num(p.maxCollateralInputs) ?? PROTOCOL_DEFAULTS.maxCollateralInputs,
    coinsPerUtxoSize:
      num(p.utxoCostPerByte) ?? num(p.coinsPerUtxoSize) ?? PROTOCOL_DEFAULTS.coinsPerUtxoSize,
    minFeeRefScriptCostPerByte:
      num(p.minFeeRefScriptCostPerByte) ?? PROTOCOL_DEFAULTS.minFeeRefScriptCostPerByte,
  };

  return { ...PROTOCOL_DEFAULTS, ...overrides };
}

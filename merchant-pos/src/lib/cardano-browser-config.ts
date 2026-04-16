/** Maps app network to Mesh `Transaction.setNetwork` / Blockfrost routing. */
export type MeshChainNetwork = "mainnet" | "preprod" | "preview";

export function getMeshChainNetwork(): MeshChainNetwork {
  const raw = (
    process.env.NEXT_PUBLIC_CARDANO_NETWORK ??
    process.env.CARDANO_NETWORK ??
    "preprod"
  )
    .toString()
    .trim()
    .toLowerCase();
  if (raw === "mainnet") return "mainnet";
  if (raw === "preview") return "preview";
  return "preprod";
}

/**
 * Blockfrost project id for **browser** Mesh (fetch UTxOs, submit).
 * Use a dedicated key with safe limits; do not reuse production secrets on public pages.
 */
export function getBrowserBlockfrostProjectId(): string | undefined {
  const id = process.env.NEXT_PUBLIC_BLOCKFROST_PROJECT_ID?.trim();
  return id !== "" ? id : undefined;
}

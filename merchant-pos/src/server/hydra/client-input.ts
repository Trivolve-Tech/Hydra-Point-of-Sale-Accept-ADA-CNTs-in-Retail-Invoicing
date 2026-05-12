export const ClientInput = {
  init: () => ({ tag: "Init" as const }),

  close: () => ({ tag: "Close" as const }),

  safeClose: () => ({ tag: "SafeClose" as const }),

  contest: () => ({ tag: "Contest" as const }),

  fanout: () => ({ tag: "Fanout" as const }),

  newTx: (transaction: Record<string, unknown>) => ({
    tag: "NewTx" as const,
    transaction,
  }),

  recover: (recoverTxId: string) => ({
    tag: "Recover" as const,
    recoverTxId,
  }),

  decommit: (decommitTx: Record<string, unknown>) => ({
    tag: "Decommit" as const,
    decommitTx,
  }),

  sideLoadSnapshot: (snapshot: Record<string, unknown>) => ({
    tag: "SideLoadSnapshot" as const,
    snapshot,
  }),
} as const;

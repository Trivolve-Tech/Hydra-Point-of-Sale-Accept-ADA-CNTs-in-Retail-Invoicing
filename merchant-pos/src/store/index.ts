import { create } from "zustand";

type MODALSTATES = "PAYMENT" | "SUCCESS" | "HERO" | null;
type SettlementLayer = "L1" | "L2" | null;

interface AppStore {
  loading: boolean;
  subLoading: boolean;
  modal: { state: MODALSTATES };
  hydraAvailable: boolean;
  settlementLayer: SettlementLayer;
  setLoading: (value: boolean) => void;
  setSubLoading: (value: boolean) => void;
  setModal: (m_state: MODALSTATES) => void;
  setHydraAvailable: (value: boolean) => void;
  setSettlementLayer: (layer: SettlementLayer) => void;
}

export const useAppStore = create<AppStore>()((set) => ({
  loading: false,
  subLoading: false,
  modal: { state: "HERO" },
  hydraAvailable: false,
  settlementLayer: null,
  setLoading: (value: boolean) => set(() => ({ loading: value })),
  setSubLoading: (value: boolean) => set(() => ({ subLoading: value })),
  setModal: (m_state: MODALSTATES) =>
    set(() => ({ modal: { state: m_state } })),
  setHydraAvailable: (value: boolean) => set(() => ({ hydraAvailable: value })),
  setSettlementLayer: (layer: SettlementLayer) =>
    set(() => ({ settlementLayer: layer })),
}));

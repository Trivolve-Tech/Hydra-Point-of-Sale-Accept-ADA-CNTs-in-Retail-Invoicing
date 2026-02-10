import { create } from "zustand";

type MODALSTATES = "PAYMENT" | "SUCCESS" | "HERO" | null;

interface AppStore {
  loading: boolean;
  subLoading: boolean;
  modal: { state: MODALSTATES };
  setLoading: (value: boolean) => void;
  setSubLoading: (value: boolean) => void;
  setModal: (m_state: MODALSTATES) => void;
}

export const useAppStore = create<AppStore>()((set) => ({
  loading: false,
  subLoading: false,
  modal: { state: "HERO" },
  setLoading: (value: boolean) => set(() => ({ loading: value })),
  setSubLoading: (value: boolean) => set(() => ({ subLoading: value })),
  setModal: (m_state: MODALSTATES) =>
    set(() => ({ modal: { state: m_state } })),
}));

import { create } from "zustand";

interface SettingsTriggerStore {
  pendingTab: string | null;
  requestTab: (tab: string) => void;
  clearPending: () => void;
}

export const useSettingsTrigger = create<SettingsTriggerStore>((set) => ({
  pendingTab: null,
  requestTab: (tab) => set({ pendingTab: tab }),
  clearPending: () => set({ pendingTab: null }),
}));

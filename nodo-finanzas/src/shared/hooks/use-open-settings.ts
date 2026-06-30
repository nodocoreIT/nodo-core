import { createContext, useContext } from "react";
import type { SettingsTabId } from "@nodocore/nodo-modules/settings";

interface OpenSettingsContextValue {
  openSettings: (tab?: SettingsTabId) => void;
}

export const OpenSettingsContext = createContext<OpenSettingsContextValue>({
  openSettings: () => {},
});

export function useOpenSettings() {
  return useContext(OpenSettingsContext);
}

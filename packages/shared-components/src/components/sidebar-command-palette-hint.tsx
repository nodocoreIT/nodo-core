"use client";

import { SidebarSearchHint, type SidebarSearchHintProps } from "./sidebar-search-hint";
import { useAdminCommandPalette } from "../providers/admin-command-palette-provider";

/** Sidebar Ctrl+K hint wired to AdminCommandPaletteProvider. */
export function SidebarCommandPaletteHint(props: Omit<SidebarSearchHintProps, "onClick">) {
  const { open } = useAdminCommandPalette();
  return <SidebarSearchHint onClick={open} {...props} />;
}

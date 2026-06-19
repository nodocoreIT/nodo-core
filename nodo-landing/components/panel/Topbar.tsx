"use client";

import { Menu } from "lucide-react";
import {
  PortalHeaderActions,
  PortalHeaderMobileActions,
  SearchInput,
} from "@nodocore/shared-components";
import { usePanelShell } from "./PanelChrome";
import { NotificationsBell } from "./NotificationsBell";

type TopbarProps = {
  breadcrumb: string;
  title: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
};

export default function Topbar({
  breadcrumb,
  title,
  searchValue = "",
  onSearchChange,
  searchPlaceholder = "Buscar…",
}: TopbarProps) {
  const shell = usePanelShell();
  const hasSearch = onSearchChange !== undefined;

  return (
    <header
      className="flex min-h-20 shrink-0 flex-col items-center gap-3 border-b border-border bg-[#EEF3F8] px-4 py-3 shadow-sm sm:flex-row sm:gap-4 sm:px-6"
    >
      <div className="flex w-full items-center justify-between gap-3 sm:w-auto sm:min-w-0 sm:flex-1 sm:justify-start">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            className="block text-navy hover:text-brand md:hidden"
            onClick={() => shell?.openMobileMenu()}
            aria-label="Abrir menú"
          >
            <Menu className="h-6 w-6" />
          </button>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate2 sm:text-xs">
              {breadcrumb}
            </p>
            <h1 className="truncate text-base font-bold text-navy sm:text-xl">
              {title}
            </h1>
          </div>
        </div>

        <PortalHeaderMobileActions notifications={<NotificationsBell />} />
      </div>

      <PortalHeaderActions
        search={
          hasSearch ? (
            <SearchInput
              value={searchValue}
              onChange={onSearchChange!}
              placeholder={searchPlaceholder}
              className="w-full sm:max-w-none md:max-w-none"
            />
          ) : undefined
        }
        notifications={<NotificationsBell />}
      />
    </header>
  );
}

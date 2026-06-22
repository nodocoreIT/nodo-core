"use client";

import { useEffect, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "../lib/utils";
import { useSidebarNavAccordion } from "./sidebar-nav-accordion";

export interface SidebarNavGroupProps {
  /** Stable id for accordion state (required when parent uses SidebarNavAccordionProvider). */
  groupId: string;
  label: string;
  /** When true the group auto-expands (e.g. a child route is active). */
  isActive?: boolean;
  children: ReactNode;
}

export function SidebarNavGroup({
  groupId,
  label,
  isActive = false,
  children,
}: SidebarNavGroupProps) {
  const accordion = useSidebarNavAccordion();
  const collapsible = accordion?.collapsible ?? false;
  const open = collapsible
    ? accordion?.openGroupId === groupId
    : true;

  useEffect(() => {
    if (isActive && collapsible) {
      accordion?.openGroup(groupId);
    }
  }, [isActive, collapsible, groupId, accordion]);

  if (!collapsible) {
    return (
      <div className="mb-4">
        <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-[var(--color-sidebar-text)] opacity-60">
          {label}
        </p>
        <div className="flex flex-col gap-1">{children}</div>
      </div>
    );
  }

  return (
    <div className="mb-1">
      <button
        type="button"
        onClick={() => accordion?.toggleGroup(groupId)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 rounded-sm px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/40 transition-colors hover:text-white/60"
      >
        <ChevronRight
          className={cn(
            "h-3 w-3 shrink-0 transition-transform duration-200",
            open && "rotate-90",
          )}
        />
        {label}
      </button>
      <div
        className="grid transition-[grid-template-rows] duration-200"
        style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">
          <div className="ml-2 flex flex-col gap-0.5 pt-0.5">{children}</div>
        </div>
      </div>
    </div>
  );
}

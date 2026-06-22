"use client";

import { Command } from "lucide-react";
import { cn } from "../lib/utils";

export interface SidebarSearchHintProps {
  onClick?: () => void;
  className?: string;
}

/** Subtle Ctrl + K hint for sidebar footers (command palette or global search). */
export function SidebarSearchHint({ onClick, className }: SidebarSearchHintProps) {
  const Tag = onClick ? "button" : "p";

  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "mt-3 flex w-full items-center gap-2 rounded-sm border border-[var(--color-sidebar-border)] px-3 py-2 text-left text-[11px] font-medium text-[var(--color-sidebar-text)] opacity-70 transition-colors",
        onClick && "cursor-pointer hover:border-brand/40 hover:bg-brand/5 hover:opacity-100",
        className,
      )}
    >
      <Command className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
      <span>
        <kbd className="rounded border border-white/10 bg-white/5 px-1 py-0.5 text-[10px] font-semibold text-white/80">
          Ctrl
        </kbd>
        {" + "}
        <kbd className="rounded border border-white/10 bg-white/5 px-1 py-0.5 text-[10px] font-semibold text-white/80">
          K
        </kbd>
        <span className="ml-1.5 normal-case tracking-normal">para buscar</span>
      </span>
    </Tag>
  );
}

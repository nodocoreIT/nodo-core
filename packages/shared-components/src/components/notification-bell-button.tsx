import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "../lib/utils";

export interface NotificationBellButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  /** Count badge overlay (optional) */
  badge?: ReactNode;
}

/**
 * Fixed-size bell trigger for portal headers — keeps alignment consistent
 * across nodes and prevents the icon from drifting at the viewport edge.
 */
export function NotificationBellButton({
  children,
  badge,
  className,
  ...props
}: NotificationBellButtonProps) {
  return (
    <button
      type="button"
      className={cn(
        "relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-navy transition-colors hover:bg-navy/5 hover:text-brand focus:outline-none",
        className,
      )}
      {...props}
    >
      {children}
      {badge}
    </button>
  );
}

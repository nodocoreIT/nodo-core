import { cn } from "../lib/utils";

export interface NotificationBellBadgeProps {
  count: number;
  /** Ring color matching the portal header background. */
  ringClassName?: string;
  variant?: "brand" | "danger";
}

function formatBadgeCount(count: number): string {
  if (count > 99) return "99+";
  return String(count);
}

/**
 * Count pill for NotificationBellButton — fixed size, corner placement.
 */
export function NotificationBellBadge({
  count,
  ringClassName = "ring-[#EEF3F8]",
  variant = "brand",
}: NotificationBellBadgeProps) {
  if (count <= 0) return null;

  return (
    <span
      className={cn(
        "pointer-events-none absolute -right-0.5 -top-0.5 z-10 flex h-4 min-w-4 max-w-[1.75rem] items-center justify-center rounded-full px-1 text-[9px] font-bold leading-none text-white ring-2",
        variant === "brand" ? "bg-brand" : "bg-red-500",
        ringClassName,
      )}
      aria-hidden
    >
      {formatBadgeCount(count)}
    </span>
  );
}

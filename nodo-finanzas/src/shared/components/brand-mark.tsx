/**
 * BrandMark — static Nodo Finanzas lockup for use in auth flows.
 *
 * Intentionally avoids store/context hooks so it renders safely
 * before any providers are mounted (e.g. the auth callback page).
 */
import { cn } from "@/shared/lib/utils";

interface BrandMarkProps {
  /** Extra classes on the wrapper (e.g. text size). */
  className?: string;
  /** Extra classes on the icon (size overrides). */
  iconClassName?: string;
}

export function BrandMark({ className, iconClassName }: BrandMarkProps) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span className="flex items-center justify-center rounded-md bg-navy p-1.5">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#059669"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={cn("h-6 w-6 flex-shrink-0", iconClassName)}
          aria-hidden="true"
        >
          <line x1="12" x2="12" y1="2" y2="22" />
          <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
        </svg>
      </span>
      <span className="font-display text-xl font-bold tracking-tight">
        <span className="text-navy">nodo</span>
        <span className="text-brand">finanzas</span>
      </span>
    </span>
  );
}

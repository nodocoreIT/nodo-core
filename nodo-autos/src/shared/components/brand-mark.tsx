/**
 * BrandMark — static Nodo Autos lockup for use in auth flows.
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
          stroke="#C41E3A"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={cn("h-6 w-6 flex-shrink-0", iconClassName)}
          aria-hidden="true"
        >
          <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2" />
          <circle cx="7" cy="17" r="2" />
          <path d="M9 17h6" />
          <circle cx="17" cy="17" r="2" />
        </svg>
      </span>
      <span className="font-display text-xl font-bold tracking-tight">
        <span className="text-navy">nodo</span>
        <span className="text-brand">autos</span>
      </span>
    </span>
  );
}

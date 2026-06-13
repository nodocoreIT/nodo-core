/**
 * BrandMark — the shared Nodo lockup.
 *
 * Accepts props for all display values instead of reading from app-specific hooks.
 * Each consuming app passes its own orgName, logoUrl, and theme settings.
 *
 * mode:
 *   - "default"  renders the SVG icon + wordmark
 *   - "text"     renders brandText only
 *   - "custom"   renders a custom logo image (requires logoUrl)
 */
import { cn } from "../lib/utils";

export interface BrandMarkProps {
  /** Render for placement on a dark background (e.g. the navy sidebar). */
  onDark?: boolean;
  /** Extra classes on the wrapper. */
  className?: string;
  /** Extra classes on the icon (size overrides). */
  iconClassName?: string;
  /** Display mode. Defaults to "default". */
  mode?: "default" | "text" | "custom";
  /** Brand text shown in "text" mode. */
  orgName?: string;
  /** Logo image URL used in "custom" mode. */
  logoUrl?: string | null;
  /** Primary brand color (e.g. "#da5a0e"). Defaults to CSS var(--color-brand). */
  primaryColor?: string;
  /** Secondary/background color for the icon badge. Defaults to CSS var(--color-navy). */
  secondaryColor?: string;
  /** Product suffix shown next to "nodo" in default mode. */
  productSuffix?: string;
  /** Force legacy image rendering (useful for test environments). */
  useLegacyIcon?: boolean;
}

export function BrandMark({
  onDark,
  className,
  iconClassName,
  mode = "default",
  orgName = "nodo",
  logoUrl = null,
  primaryColor = "var(--color-brand)",
  secondaryColor = "var(--color-navy)",
  productSuffix,
  useLegacyIcon = false,
}: BrandMarkProps) {
  // Text-only logo
  if (mode === "text") {
    const textLength = orgName.length;
    let fontSizeClass = "text-lg sm:text-xl";
    if (textLength > 25) {
      fontSizeClass = "text-sm sm:text-base";
    } else if (textLength > 15) {
      fontSizeClass = "text-base sm:text-lg";
    }

    return (
      <span
        className={cn(
          "font-display font-bold tracking-tight py-1 block whitespace-normal break-words leading-tight",
          onDark ? "max-w-[180px] md:max-w-[200px] text-white" : "max-w-full text-navy",
          fontSizeClass,
          className
        )}
      >
        {orgName}
      </span>
    );
  }

  // Custom logo image
  if (mode === "custom" && logoUrl) {
    return (
      <span className={cn("inline-flex items-center gap-2", className)}>
        <img
          src={logoUrl}
          alt="Logo"
          className="h-10 w-auto max-w-[180px] md:max-w-[200px] flex-shrink-0 object-contain"
        />
      </span>
    );
  }

  // Legacy image fallback (for test environments)
  if (useLegacyIcon) {
    return (
      <span className={cn("inline-flex items-center gap-2", className)}>
        <img
          src={onDark ? "/brand/nodo-mark-white.png" : "/brand/nodo-mark.png"}
          alt=""
          className={cn("h-7 w-7 flex-shrink-0", iconClassName)}
        />
        <span className="font-display text-xl font-bold tracking-tight">
          <span className={onDark ? "text-white" : "text-navy"}>nodo</span>
          {productSuffix && <span style={{ color: primaryColor }}>{productSuffix}</span>}
        </span>
      </span>
    );
  }

  // Default: SVG icon + wordmark
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span
        className="flex items-center justify-center p-1.5 rounded-md"
        style={{ backgroundColor: secondaryColor }}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke={primaryColor}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={cn("h-6 w-6 flex-shrink-0", iconClassName)}
          aria-hidden="true"
        >
          <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" />
          <path d="M6 12H4a2 2 0 0 0-2 2v8" />
          <path d="M18 16h2a2 2 0 0 1 2 2v4" />
          <path d="M10 6h4" />
          <path d="M10 10h4" />
          <path d="M10 14h4" />
          <path d="M10 18h4" />
        </svg>
      </span>
      <span className="font-display text-xl font-bold tracking-tight">
        <span className={onDark ? "text-white" : "text-navy"}>nodo</span>
        {productSuffix && <span style={{ color: primaryColor }}>{productSuffix}</span>}
      </span>
    </span>
  );
}

import Link from "next/link";
import { cn } from "@/lib/utils";

type ActionTone = "brand" | "navy" | "amber" | "slate";

const TONE_BUTTON: Record<ActionTone, string> = {
  brand: "bg-brand text-white hover:opacity-90",
  navy: "bg-navy text-white hover:opacity-90",
  amber: "bg-amber-500 text-white hover:bg-amber-600",
  slate: "bg-mist text-navy hover:bg-mist/80",
};

export interface DashboardActionCardProps {
  badge?: string;
  title: string;
  description: string;
  buttonLabel: string;
  href?: string;
  onClick?: () => void;
  tone?: ActionTone;
}

export function DashboardActionCard({
  badge,
  title,
  description,
  buttonLabel,
  href,
  onClick,
  tone = "brand",
}: DashboardActionCardProps) {
  const btnClass = cn(
    "inline-flex w-full items-center justify-center rounded-sm px-3 py-2 text-xs font-bold uppercase tracking-wide transition-colors shadow-sm",
    TONE_BUTTON[tone],
  );

  return (
    <div className="flex h-full flex-col rounded-md border border-border bg-card px-5 py-4 shadow-sm">
      {badge ? (
        <p className="text-[10px] font-bold uppercase tracking-wide text-slate2">
          {badge}
        </p>
      ) : null}

      <h3 className="mt-1 font-display text-lg font-bold text-navy">{title}</h3>
      <p className="mt-1 flex-1 text-sm text-slate2">{description}</p>

      <div className="mt-4">
        {onClick ? (
          <button type="button" onClick={onClick} className={btnClass}>
            {buttonLabel}
          </button>
        ) : (
          <Link href={href ?? "#"} className={btnClass}>
            {buttonLabel}
          </Link>
        )}
      </div>
    </div>
  );
}

import { cn } from "@/lib/utils";

interface ProgressRingProps {
  value: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
  trackClassName?: string;
  labelClassName?: string;
}

export function ProgressRing({
  value,
  size = 56,
  strokeWidth = 3,
  className,
  trackClassName = "text-slate-200",
  labelClassName = "text-navy",
}: ProgressRingProps) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  const radius = 15.9155;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 36 36"
        className="absolute inset-0 h-full w-full -rotate-90"
        aria-hidden
      >
        <circle
          cx="18"
          cy="18"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className={trackClassName}
        />
        <circle
          cx="18"
          cy="18"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={offset}
          className={cn("transition-all duration-500 ease-out", className)}
        />
      </svg>
      <span className={cn("text-xs font-bold", labelClassName)}>
        {clamped}%
      </span>
    </div>
  );
}

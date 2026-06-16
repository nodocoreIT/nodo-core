import { cn } from "@/shared/lib/utils";

interface ReclamoStatusBadgeProps {
  status: string;
  className?: string;
}

const STATUS_CONFIG: Record<string, { label: string; classes: string }> = {
  open: {
    label: "Abierto",
    classes: "bg-blue-100 text-blue-700",
  },
  in_progress: {
    label: "En curso",
    classes: "bg-amber-100 text-amber-700",
  },
  resolved: {
    label: "Resuelto",
    classes: "bg-green-100 text-green-700",
  },
  closed: {
    label: "Cerrado",
    classes: "bg-slate-100 text-slate-600",
  },
};

export function ReclamoStatusBadge({ status, className }: ReclamoStatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? { label: status, classes: "bg-slate-100 text-slate-600" };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold",
        config.classes,
        className
      )}
    >
      {config.label}
    </span>
  );
}

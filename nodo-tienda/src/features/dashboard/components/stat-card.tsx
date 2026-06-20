import { type LucideIcon } from "lucide-react";
import { cn } from "@/shared/lib/utils";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  description?: string;
  highlight?: boolean;
}

export function StatCard({
  title,
  value,
  icon: Icon,
  description,
  highlight,
}: StatCardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border p-5 bg-card",
        highlight ? "border-orange-200 bg-orange-50" : "border-border",
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        <div
          className={cn(
            "p-2 rounded-lg",
            highlight ? "bg-orange-100" : "bg-primary/10",
          )}
        >
          <Icon
            className={cn(
              "w-4 h-4",
              highlight ? "text-orange-600" : "text-primary",
            )}
          />
        </div>
      </div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
      {description && (
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      )}
    </div>
  );
}

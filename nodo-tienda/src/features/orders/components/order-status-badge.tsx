import { cn } from "@/shared/lib/utils";
import { ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from "../lib/order-utils";

interface OrderStatusBadgeProps {
  status: string;
}

export function OrderStatusBadge({ status }: OrderStatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        ORDER_STATUS_COLORS[status] ?? "bg-gray-100 text-gray-700",
      )}
    >
      {ORDER_STATUS_LABELS[status] ?? status}
    </span>
  );
}

import type { ReactNode } from "react";
import { cn } from "../lib/utils";

export interface PortalHeaderActionsProps {
  /** Optional search field (list pages) */
  search?: ReactNode;
  /** IPC, USD quote, etc. */
  metrics?: ReactNode;
  notifications: ReactNode;
  /** Logout, settings, etc. */
  trailing?: ReactNode;
  className?: string;
}

/** Metrics + notifications for the mobile title row */
export function PortalHeaderMobileActions({
  metrics,
  notifications,
  trailing,
  className,
}: Pick<
  PortalHeaderActionsProps,
  "metrics" | "notifications" | "trailing" | "className"
>) {
  return (
    <div
      className={cn("flex max-w-full items-center justify-end gap-1.5 overflow-x-auto md:hidden", className)}
    >
      {metrics}
      {notifications}
      {trailing}
    </div>
  );
}

/**
 * Right-side portal header cluster: search (optional) + metrics + bell + extras.
 * Keeps items grouped so the notification bell does not drift to the viewport edge.
 */
export function PortalHeaderActions({
  search,
  metrics,
  notifications,
  trailing,
  className,
}: PortalHeaderActionsProps) {
  const hasSearch = Boolean(search);

  return (
    <div
      className={cn(
        "flex items-center gap-2 sm:gap-2.5",
        hasSearch ? "w-full sm:ml-auto sm:w-auto" : "ml-auto hidden sm:flex",
        className,
      )}
    >
      {search ? (
        <div className="min-w-0 flex-1 sm:flex-none sm:w-52 md:w-56">{search}</div>
      ) : null}
      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        {hasSearch ? (
          <div className="hidden sm:contents">{metrics}</div>
        ) : (
          metrics
        )}
        {hasSearch ? (
          <div className="hidden sm:contents">{notifications}</div>
        ) : (
          notifications
        )}
        {hasSearch ? (
          <div className="hidden sm:contents">{trailing}</div>
        ) : (
          trailing
        )}
      </div>
    </div>
  );
}

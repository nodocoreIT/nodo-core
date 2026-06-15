import { Bell, FileUp, UserPlus, X } from "lucide-react";
import { Button } from "@nodocore/shared-components";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { Badge } from "@/shared/components/ui/badge";
import { useConsultationStore } from "@/store/consultation-store";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

export function NotificationBell() {
  const { notifications, markNotificationRead } = useConsultationStore();
  const unreadCount = notifications.filter((n) => !n.read).length;

  const iconForType = (type: string) => {
    switch (type) {
      case "document_upload":
        return <FileUp className="h-4 w-4 text-amber-500" />;
      case "patient_waiting":
        return <UserPlus className="h-4 w-4 text-blue-500" />;
      default:
        return <Bell className="h-4 w-4 text-slate-500" />;
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg hover:bg-muted transition-colors">
        <Bell className="h-4 w-4 text-slate-600" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white animate-pulse">
            {unreadCount}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="px-4 py-3 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-slate-800">
              Notificaciones
            </h4>
            {unreadCount > 0 && (
              <Badge variant="outline" className="text-xs">
                {unreadCount} nuevas
              </Badge>
            )}
          </div>
        </div>
        <div className="max-h-[320px] overflow-y-auto">
          {notifications.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">
              Sin notificaciones
            </p>
          ) : (
            notifications.map((notification) => (
              <div
                key={notification.id}
                className={`flex gap-3 px-4 py-3 border-b border-slate-50 hover:bg-slate-50 transition-colors ${
                  !notification.read ? "bg-blue-50/30" : ""
                }`}
              >
                <div className="mt-0.5">{iconForType(notification.type)}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800">
                    {notification.title}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">
                    {notification.message}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    {formatDistanceToNow(notification.createdAt, {
                      addSuffix: true,
                      locale: es,
                    })}
                  </p>
                </div>
                {!notification.read && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 shrink-0"
                    onClick={() => markNotificationRead(notification.id)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

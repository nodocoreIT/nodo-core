"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Stethoscope,
  Settings,
  LogOut,
  Menu,
  X,
  MessageSquare,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BrandMark } from "@/components/nodo/brand-mark";
import { NodoChatWidget } from "@/components/nodo-chat/nodo-chat-widget";
import { NodoChatBell } from "@/components/nodo-chat/nodo-chat-bell";
import { clinicApi } from "@/lib/clinic/client-api";
import { PlanBadge } from "@/components/plan/plan-badge";
import { isProPlan } from "@/lib/nodo-chat/is-pro-plan";
import { isPlatformMode } from "@/lib/clinic/platform-config";
import { isProOnlyMedicoRoute } from "@/lib/clinic/pro-features";
import { useThemeStore, useThemeSettings } from "@/hooks/use-theme-settings";
import { mergeThemeSettings } from "@/lib/clinic/theme-settings";
import { Button } from "@/components/ui/button";

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/medico/dashboard", label: "Inicio", icon: LayoutDashboard },
  { href: "/medico/consultorio", label: "Consultorio", icon: Stethoscope },
  { href: "/medico/cobros", label: "Cobros", icon: Wallet },
  { href: "/medico/interconsultas", label: "Interconsultas", icon: MessageSquare },
];

const ROUTE_TITLES: Record<string, string> = {
  "/medico/dashboard": "Inicio",
  "/medico/consultorio": "Consultorio",
  "/medico/cobros": "Cobros",
  "/medico/interconsultas": "Interconsultas",
  "/medico/configuracion": "Configuración",
};

function initials(value: string): string {
  const base = value.trim();
  if (!base) return "?";
  const parts = base.split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return base.slice(0, 2).toUpperCase();
}

export function MedicoAdminLayout({ children }: { children: React.ReactNode }) {
  useThemeSettings();
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [doctor, setDoctor] = useState<{
    id: string;
    fullName: string;
    email: string;
    subscriptionPlan?: string;
  } | null>(null);
  const [checking, setChecking] = useState(true);
  const [chatOpen, setChatOpen] = useState(false);
  const [cobrosUnread, setCobrosUnread] = useState(0);

  const [planTier, setPlanTier] = useState<string | null>(null);
  const isPro = isPlatformMode()
    ? isProPlan(planTier)
    : isProPlan(doctor?.subscriptionPlan);
  const chatEmbedded = pathname === "/medico/interconsultas";

  const refreshCobrosUnread = useCallback(async () => {
    try {
      const data = await clinicApi.getCobrosUnreadCount();
      setCobrosUnread(data.cobrosCount);
    } catch {
      setCobrosUnread(0);
    }
  }, []);

  useEffect(() => {
    if (!doctor) return;
    refreshCobrosUnread();
    const interval = setInterval(refreshCobrosUnread, 10_000);
    const onRead = () => refreshCobrosUnread();
    const onVisible = () => {
      if (document.visibilityState === "visible") refreshCobrosUnread();
    };
    window.addEventListener("cobros-notifications-read", onRead);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(interval);
      window.removeEventListener("cobros-notifications-read", onRead);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [doctor, refreshCobrosUnread]);

  useEffect(() => {
    if (pathname === "/medico/cobros" && doctor) {
      clinicApi.markCobrosNotificationsRead().then(() => {
        refreshCobrosUnread();
        window.dispatchEvent(new CustomEvent("cobros-notifications-read"));
      }).catch(() => {});
    }
  }, [pathname, doctor, refreshCobrosUnread]);

  useEffect(() => {
    clinicApi.getSession().then(async ({ session, user }) => {
      if (!session || session.role !== "doctor") {
        if (isPlatformMode()) {
          try {
            const synced = await clinicApi.syncPlatformSession();
            setDoctor({
              id: synced.user.id,
              fullName: synced.user.fullName,
              email: synced.user.email,
              subscriptionPlan: synced.user.subscriptionPlan,
            });
            setPlanTier(
              synced.platform?.plan ?? synced.user.subscriptionPlan ?? null,
            );
            setChecking(false);
            return;
          } catch {
            router.push("/login/medico");
            return;
          }
        }
        router.push("/login");
        return;
      }
      setDoctor({
        id: user.id,
        fullName: user.fullName,
        email: user.email ?? session.email,
        subscriptionPlan: user.subscriptionPlan,
      });
      setPlanTier(user.subscriptionPlan ?? null);
      try {
        const office = await clinicApi.getDoctorSchedule(user.id);
        if (office.themeSettings) {
          useThemeStore.getState().hydrateSettings(
            mergeThemeSettings(office.themeSettings),
          );
        }
      } catch {
        /* tema local por defecto */
      }
      setChecking(false);
    });
  }, [router]);

  const title = ROUTE_TITLES[pathname] ?? "Gestión";
  const displayName = doctor?.fullName ?? "Médico";

  useEffect(() => {
    document.title = "Nodo | Clinicas";
  }, []);

  const handleLogout = async () => {
    await clinicApi.logout();
    router.push("/");
  };

  if (checking) {
    return (
      <div className="flex h-dvh items-center justify-center bg-paper">
        <div
          role="status"
          aria-label="Cargando panel"
          className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-primary)] border-t-transparent"
        />
      </div>
    );
  }

  return (
    <div className="flex h-dvh max-h-dvh overflow-hidden bg-paper">
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 transition-opacity md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed bottom-0 top-0 left-0 z-50 flex h-dvh max-h-dvh w-60 flex-shrink-0 flex-col bg-[var(--color-sidebar-bg)] transition-transform duration-300 ease-in-out border-r border-[var(--color-sidebar-border)] md:static md:z-auto md:translate-x-0 md:flex",
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="mt-2.5 flex h-16 flex-shrink-0 items-center justify-between px-5">
          <BrandMark onDark iconClassName="h-6 w-6" />
          <button
            type="button"
            className="md:hidden text-[var(--color-sidebar-text)] hover:text-white"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Cerrar menú"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <nav
          className="flex-1 overflow-y-auto px-3 py-4"
          aria-label="Navegación principal"
        >
          <div className="flex flex-col gap-1">
            {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
              const isActive =
                pathname === href ||
                (href !== "/medico/dashboard" && pathname.startsWith(href));
              const proLocked =
                isProOnlyMedicoRoute(href) && !isPro;
              const showCobrosBadge =
                href === "/medico/cobros" && cobrosUnread > 0;
              return (
                <Link
                  key={href}
                  href={proLocked ? "/medico/dashboard" : href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-sm px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-[var(--sidebar-primary)] text-[var(--sidebar-primary-foreground)]"
                      : "text-[var(--color-sidebar-text)] hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-accent-foreground)]",
                    proLocked && "opacity-50",
                  )}
                  title={proLocked ? "Disponible en Plan Pro" : undefined}
                >
                  <Icon className="h-4 w-4 flex-shrink-0" />
                  <span className="flex-1">{label}</span>
                  {showCobrosBadge && (
                    <span
                      className="ml-auto shrink-0 rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold leading-tight text-white whitespace-nowrap"
                      aria-label={`${cobrosUnread} pago${cobrosUnread === 1 ? "" : "s"} pendiente${cobrosUnread === 1 ? "" : "s"} de revisión`}
                    >
                      {cobrosUnread} Pendiente{cobrosUnread === 1 ? "" : "s"}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </nav>

        <div className="flex-shrink-0 border-t border-[var(--color-sidebar-border)] p-3 space-y-2">
          <div className="flex items-center gap-3 px-1 py-1">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[var(--sidebar-primary)] text-xs font-bold text-[var(--sidebar-primary-foreground)]">
              {initials(displayName)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">
                {displayName}
              </p>
              {doctor?.email && (
                <p className="truncate text-xs text-[var(--color-sidebar-text)]">
                  {doctor.email}
                </p>
              )}
            </div>
            <button
              type="button"
              aria-label="Configuración"
              onClick={() => {
                setMobileMenuOpen(false);
                router.push("/medico/configuracion");
              }}
              className={cn(
                "flex-shrink-0 rounded-md p-1.5 transition-colors hover:text-[var(--sidebar-accent-foreground)]",
                pathname === "/medico/configuracion"
                  ? "text-[var(--sidebar-primary)]"
                  : "text-[var(--color-sidebar-text)]",
              )}
            >
              <Settings className="h-4 w-4" />
            </button>
          </div>

          <Button
            variant="outline"
            onClick={handleLogout}
            className="mt-2 w-full justify-center gap-2 border-[var(--color-sidebar-border)] bg-transparent text-[var(--color-sidebar-text)] hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-accent-foreground)] hover:border-[var(--sidebar-primary)]"
          >
            <LogOut className="h-4 w-4" />
            Cerrar sesión
          </Button>
        </div>
      </aside>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <header className="flex min-h-16 flex-shrink-0 items-center justify-between gap-4 border-b border-border bg-[#EEF3F8] px-4 py-3 shadow-sm sm:px-6">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              className="block md:hidden text-[var(--color-navy)] hover:text-[var(--color-primary)]"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Abrir menú"
            >
              <Menu className="h-6 w-6" />
            </button>
            <div className="min-w-0">
              <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wide text-slate2">
                Nodo Salud · Gestión
              </p>
              <h1 className="truncate text-base sm:text-xl font-bold text-navy font-display">
                {title}
              </h1>
            </div>
          </div>

          {doctor && (
            <div className="flex items-center gap-2">
              <PlanBadge fallbackPlan={doctor.subscriptionPlan} />
              <NodoChatBell
              isPro={isPro}
              chatEmbedded={chatEmbedded}
              onOpenChat={() => setChatOpen(true)}
            />
            </div>
          )}
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain p-4 pb-[max(1.5rem,env(safe-area-inset-bottom,0px))] sm:p-6 sm:pb-6">
          {children}
        </main>
      </div>

      {doctor && !chatEmbedded && (
        <NodoChatWidget
          doctorId={doctor.id}
          doctorName={doctor.fullName}
          isPro={isPro}
          open={chatOpen}
          onOpenChange={setChatOpen}
        />
      )}
    </div>
  );
}

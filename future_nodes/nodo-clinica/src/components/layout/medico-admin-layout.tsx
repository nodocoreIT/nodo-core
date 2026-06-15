"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Stethoscope,
  Settings,
  LogOut,
  Menu,
  X,
  Calendar,
  MessageSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BrandMark } from "@/components/nodo/brand-mark";
import { ThemeSettingsDialog } from "@/components/settings/theme-settings-dialog";
import { NodoChatWidget } from "@/components/nodo-chat/nodo-chat-widget";
import { NodoChatBell } from "@/components/nodo-chat/nodo-chat-bell";
import { clinicApi } from "@/lib/clinic/client-api";
import { isProPlan } from "@/lib/nodo-chat/is-pro-plan";
import { Button } from "@/components/ui/button";

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/medico/dashboard", label: "Inicio", icon: LayoutDashboard },
  { href: "/medico/consultorio", label: "Consultorio", icon: Stethoscope },
  { href: "/medico/interconsultas", label: "Interconsultas", icon: MessageSquare },
  { href: "/medico/configuracion", label: "Agenda y perfil", icon: Calendar },
];

const ROUTE_TITLES: Record<string, string> = {
  "/medico/dashboard": "Inicio",
  "/medico/consultorio": "Consultorio",
  "/medico/interconsultas": "Interconsultas",
  "/medico/configuracion": "Agenda y perfil",
};

function initials(value: string): string {
  const base = value.trim();
  if (!base) return "?";
  const parts = base.split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return base.slice(0, 2).toUpperCase();
}

export function MedicoAdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [doctor, setDoctor] = useState<{
    id: string;
    fullName: string;
    email: string;
    subscriptionPlan?: string;
  } | null>(null);
  const [checking, setChecking] = useState(true);
  const [chatOpen, setChatOpen] = useState(false);

  const isPro = isProPlan(doctor?.subscriptionPlan);
  const chatEmbedded = pathname === "/medico/interconsultas";

  useEffect(() => {
    clinicApi.getSession().then(({ session, user }) => {
      if (!session || session.role !== "doctor") {
        router.push("/login");
        return;
      }
      setDoctor({
        id: user.id,
        fullName: user.fullName,
        email: user.email ?? session.email,
        subscriptionPlan: user.subscriptionPlan,
      });
      setChecking(false);
    });
  }, [router]);

  const title = ROUTE_TITLES[pathname] ?? "Gestión";
  const displayName = doctor?.fullName ?? "Médico";

  const handleLogout = async () => {
    await clinicApi.logout();
    router.push("/");
  };

  if (checking) {
    return (
      <div className="flex h-screen items-center justify-center bg-paper">
        <div
          role="status"
          aria-label="Cargando panel"
          className="h-8 w-8 animate-spin rounded-full border-4 border-brand border-t-transparent"
        />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-paper">
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 transition-opacity md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed bottom-0 top-0 left-0 z-50 flex h-screen w-60 flex-shrink-0 flex-col bg-[var(--color-sidebar-bg)] transition-transform duration-300 ease-in-out border-r border-[var(--color-sidebar-border)] md:static md:z-auto md:translate-x-0 md:flex",
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-16 flex-shrink-0 items-center justify-between px-5">
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
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-sm px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-brand text-[var(--color-primary-foreground,#fff)]"
                      : "text-[var(--color-sidebar-text)] hover:bg-brand/10 hover:text-brand",
                  )}
                >
                  <Icon className="h-4 w-4 flex-shrink-0" />
                  <span className="flex-1">{label}</span>
                </Link>
              );
            })}
          </div>
        </nav>

        <div className="flex-shrink-0 border-t border-[var(--color-sidebar-border)] p-3">
          <div className="flex items-center gap-3 px-1 py-1">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold text-white">
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
              aria-label="Personalización"
              onClick={() => {
                setMobileMenuOpen(false);
                setSettingsOpen(true);
              }}
              className="flex-shrink-0 rounded-md p-1.5 text-[var(--color-sidebar-text)] transition-colors hover:text-brand"
            >
              <Settings className="h-4 w-4" />
            </button>
          </div>

          <Button
            variant="outline"
            onClick={handleLogout}
            className="mt-2 w-full justify-center gap-2 border-[var(--color-sidebar-border)] bg-transparent text-[var(--color-sidebar-text)] hover:bg-brand/10 hover:text-brand hover:border-brand"
          >
            <LogOut className="h-4 w-4" />
            Cerrar sesión
          </Button>
        </div>
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex min-h-16 items-center justify-between gap-4 border-b border-border bg-[#EEF3F8] px-4 sm:px-6 py-3 shadow-sm flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              className="block md:hidden text-navy hover:text-brand"
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
            <NodoChatBell
              isPro={isPro}
              chatEmbedded={chatEmbedded}
              onOpenChat={() => setChatOpen(true)}
            />
          )}
        </header>

        <main className="flex-1 overflow-auto p-4 sm:p-6">{children}</main>
      </div>

      <ThemeSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />

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

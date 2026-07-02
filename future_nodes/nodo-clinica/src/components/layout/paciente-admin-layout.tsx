"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Stethoscope,
  HeartPulse,
  FileText,
  Clock,
  Settings,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BrandMark } from "@/components/nodo/brand-mark";
import { usePatientTheme } from "@/hooks/use-theme-settings";
import { clinicApi, getClientSession } from "@/lib/clinic/client-api";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/ui/user-avatar";

const NAV_ITEMS = [
  { href: "/paciente", label: "Buscar médico", icon: Stethoscope },
  { href: "/paciente/salud", label: "Mi salud", icon: HeartPulse },
  { href: "/paciente/historial", label: "Historial", icon: FileText },
  { href: "/paciente/turnos", label: "Mis turnos", icon: Clock },
];

const ROUTE_TITLES: Record<string, string> = {
  "/paciente": "Inicio",
  "/paciente/salud": "Mi salud",
  "/paciente/historial": "Historial clínico",
  "/paciente/turnos": "Mis turnos",
  "/paciente/perfil": "Mi perfil",
};

export function PacienteAdminLayout({ children }: { children: React.ReactNode }) {
  usePatientTheme();
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [patient, setPatient] = useState<{
    id: string;
    fullName: string;
    email?: string;
    profilePhotoData?: string;
  } | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    async function check() {
      const stored = getClientSession();
      if (stored?.role === "patient") {
        try {
          const { session, user } = await clinicApi.getSession();
          if (session?.role === "patient" && user?.id) {
            setPatient({
              id: user.id,
              fullName: user.fullName,
              email: user.email ?? session.email,
              profilePhotoData: user.profilePhotoData,
            });
            setChecking(false);
            return;
          }
        } catch {
          /* fallback abajo */
        }
        setPatient({
          id: stored.userId,
          fullName: stored.fullName,
          email: stored.email,
        });
        setChecking(false);
        return;
      }

      try {
        const { session, user } = await clinicApi.getSession();
        if (!session || session.role !== "patient" || !user?.id) {
          router.replace("/login/paciente");
          return;
        }
        setPatient({
          id: user.id,
          fullName: user.fullName,
          email: user.email ?? session.email,
          profilePhotoData: user.profilePhotoData,
        });
      } catch {
        router.replace("/login/paciente");
        return;
      } finally {
        setChecking(false);
      }
    }
    void check();
  }, [router]);

  const title = ROUTE_TITLES[pathname] ?? "Portal del paciente";

  const handleLogout = async () => {
    await clinicApi.logout();
    window.location.href = "/";
  };

  if (checking) {
    return (
      <div className="flex h-screen items-center justify-center bg-paper">
        <div
          role="status"
          aria-label="Cargando portal"
          className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent"
        />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-paper">
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed bottom-0 top-0 left-0 z-50 flex h-screen w-60 flex-shrink-0 flex-col bg-[var(--color-sidebar-bg)] border-r border-[var(--color-sidebar-border)] transition-transform duration-300 md:static md:translate-x-0",
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="mt-2.5 flex h-16 items-center justify-between px-5">
          <BrandMark onDark iconClassName="h-6 w-6" />
          <button
            type="button"
            className="md:hidden text-[var(--color-sidebar-text)]"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Cerrar menú"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Paciente">
          <div className="flex flex-col gap-1">
            {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
              const isActive =
                href === "/paciente"
                  ? pathname === "/paciente"
                  : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-sm px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-emerald-600 text-white"
                      : "text-[var(--color-sidebar-text)] hover:bg-emerald-600/10 hover:text-emerald-400",
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {label}
                </Link>
              );
            })}
          </div>
        </nav>

        <div className="flex-shrink-0 border-t border-[var(--color-sidebar-border)] p-3">
          <div className="flex items-center gap-3 px-1 py-1">
            <UserAvatar
              name={patient?.fullName ?? "Paciente"}
              photoUrl={patient?.profilePhotoData}
              size="sm"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">
                {patient?.fullName}
              </p>
              {patient?.email && (
                <p className="truncate text-xs text-[var(--color-sidebar-text)]">
                  {patient.email}
                </p>
              )}
            </div>
            <button
              type="button"
              aria-label="Mi perfil"
              onClick={() => {
                setMobileMenuOpen(false);
                router.push("/paciente/perfil");
              }}
              className={cn(
                "rounded-md p-1.5 transition-colors",
                pathname === "/paciente/perfil"
                  ? "text-emerald-400"
                  : "text-[var(--color-sidebar-text)] hover:text-emerald-400",
              )}
            >
              <Settings className="h-4 w-4" />
            </button>
          </div>
          <Button
            variant="outline"
            onClick={handleLogout}
            className="mt-2 w-full justify-center gap-2 border-[var(--color-sidebar-border)] bg-transparent text-[var(--color-sidebar-text)] hover:bg-emerald-600/10 hover:text-emerald-400"
          >
            <LogOut className="h-4 w-4" />
            Cerrar sesión
          </Button>
        </div>
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex min-h-16 items-center justify-between gap-4 border-b border-border bg-[#EEF8F3] px-4 sm:px-6 py-3 shadow-sm shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              className="md:hidden text-navy"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Abrir menú"
            >
              <Menu className="h-6 w-6" />
            </button>
            <div className="min-w-0">
              <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wide text-slate-500">
                Nodo Salud · Pacientes
              </p>
              <h1 className="truncate text-base sm:text-xl font-bold text-navy font-display">
                {title}
              </h1>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}

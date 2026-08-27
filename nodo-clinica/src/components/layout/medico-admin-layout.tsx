"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  LayoutDashboard,
  Stethoscope,
  Settings,
  LogOut,
  Menu,
  X,
  MessageSquare,
  Wallet,
  CalendarDays,
  CalendarPlus,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { BrandMark } from "@/components/nodo/brand-mark";
import { NodoChatBell } from "@/components/nodo-chat/nodo-chat-bell";
import { NodoChatWidget } from "@/components/nodo-chat/nodo-chat-widget";
import { isProPlan } from "@/lib/nodo-chat/is-pro-plan";
import { useConsultationStore } from "@/store/consultation-store";
import { clinicApi, invalidateClinicApiCache } from "@/lib/clinic/client-api";
import { isBrowserSupabaseEnabled } from "@/lib/clinic/config";
import { isPlatformMode } from "@/lib/clinic/platform-config";
import { useConsultorioStore, useConsultorioTheme } from "@/hooks/use-consultorio-theme";
import { mergeThemeSettings } from "@/lib/clinic/theme-settings";
import { Button } from "@/components/ui/button";
import {
  AdminCommandPaletteProvider,
  SidebarNavAccordionProvider,
  SidebarNavGroup,
  SidebarCommandPaletteHint,
  PortalHeaderActions,
  type AdminCommandPaletteItem,
} from "@nodocore/shared-components";
// import { NodoSwitcher } from "@nodocore/nodo-modules"; // TODO: uncomment when nodoswitch is needed
import { FeedbackFAB } from "@nodocore/nodo-modules/feedback";
import { RoleSwitcher } from "@/components/nodo/role-switcher";
import { MedicoDoctorProvider } from "@/contexts/medico-doctor-context";
import { DoctorSettingsDialog, type SectionId } from "@/components/medical/doctor-settings-dialog";
import { DoctorSpecialtySetupModal } from "@/components/medical/doctor-specialty-setup-modal";
import {
  DoctorOnboardingGateModal,
  type OnboardingGateKind,
} from "@/components/medical/doctor-onboarding-gate-modal";
import { ClinicNotificationsBell } from "@/components/layout/clinic-notifications-bell";
import { needsSpecialtyAssignment } from "@/lib/clinic/unassigned-specialty";
import { PlanBadge } from "@/components/plan/plan-badge";
import { BillingLockoutGate } from "@/components/layout/billing-lockout-gate";
import { PROFESSIONAL_PENDING_APPROVAL_CODE } from "@/lib/clinic/professional-approval";
import { toast } from "sonner";

function mpErrorLabel(code: string) {
  const labels: Record<string, string> = {
    oauth_not_configured: "OAuth no configurado en el servidor (CLIENT_ID / CLIENT_SECRET)",
    invalid_state: "Sesión OAuth expirada — intentá conectar de nuevo",
    expired_state: "El enlace de autorización venció — reconectá",
    session_mismatch: "Iniciá sesión como el mismo médico que conectó",
    missing_code: "Mercado Pago no devolvió el código de autorización",
    token_exchange: "Error al intercambiar el código por tokens",
  };
  return labels[code] ?? code;
}

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/medico/dashboard", label: "Inicio", icon: LayoutDashboard },
  { href: "/medico/consultorio", label: "Consultorio", icon: Stethoscope },
  { href: "/medico/asignar-turnos", label: "Asignar Turnos", icon: CalendarPlus },
  { href: "/medico/turnos-programados", label: "Turnos Programados", icon: CalendarDays },
  { href: "/medico/pacientes", label: "Pacientes", icon: Users },
  { href: "/medico/cobros", label: "Cobros", icon: Wallet },
  { href: "/medico/interconsultas", label: "Interconsultas", icon: MessageSquare },
];

const ROUTE_TITLES: Record<string, string> = {
  "/medico/dashboard": "Inicio",
  "/medico/consultorio": "Consultorio",
  "/medico/asignar-turnos": "Asignar Turnos",
  "/medico/turnos-programados": "Turnos Programados",
  "/medico/pacientes": "Pacientes",
  "/medico/cobros": "Cobros",
  "/medico/interconsultas": "Interconsultas",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function resolveOnboardingGate(office: any): OnboardingGateKind | null {
  const consultationFee = office?.payment?.consultationFee;
  const needsFee = !(typeof consultationFee === "number" && consultationFee > 0);
  const needsAgenda = !office?.hasAvailability;
  // First run: both pending → combined welcome gate that names both steps.
  // Then the sequential gates take over (honorarios first, agenda after).
  if (needsFee && needsAgenda) return "ambos";
  if (needsFee) return "honorarios";
  if (needsAgenda) return "agenda";
  return null;
}

function initials(value: string): string {
  const base = value.trim();
  if (!base) return "?";
  const parts = base.split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return base.slice(0, 2).toUpperCase();
}

const commandItems: AdminCommandPaletteItem[] = NAV_ITEMS.map((item) => ({
  id: item.href,
  label: item.label,
  href: item.href,
  group: "Secciones",
}));

export function MedicoAdminLayout({ children }: { children: React.ReactNode }) {
  useConsultorioTheme();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [doctor, setDoctor] = useState<{
    id: string;
    fullName: string;
    email: string;
    subscriptionPlan?: string;
    subscriptionStatus?: string;
    trialDaysRemaining?: number;
    profilePhotoUrl?: string;
  } | null>(null);
  const [checking, setChecking] = useState(true);
  const [canSwitchToPatient, setCanSwitchToPatient] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsSection, setSettingsSection] = useState<SectionId | undefined>(undefined);
  const [specialtySetupOpen, setSpecialtySetupOpen] = useState(false);
  const [onboardingGate, setOnboardingGate] = useState<OnboardingGateKind | null>(null);
  const [cobrosUnread, setCobrosUnread] = useState(0);
  const [mpJustConnected, setMpJustConnected] = useState(false);
  const mpCallbackHandled = useRef(false);

  const chatEmbedded = pathname === "/medico/interconsultas";
  const activeAppointment = useConsultationStore((s) => s.activeAppointment);
  const inVideoConsultation =
    pathname === "/medico/consultorio" && !!activeAppointment;
  const [chatFloatingOpen, setChatFloatingOpen] = useState(false);
  const [chatSessionKey, setChatSessionKey] = useState(0);
  const [chatInitialPeer, setChatInitialPeer] = useState<{
    id?: string;
    name?: string;
  }>({});

  const openFloatingChat = useCallback((peerId?: string, peerName?: string) => {
    setChatInitialPeer({ id: peerId, name: peerName });
    setChatSessionKey((k) => k + 1);
    setChatFloatingOpen(true);
  }, []);

  const warnNavigationBlocked = useCallback(() => {
    toast.message(
      "Estás en videoconsulta. Usá «Finalizar consulta» antes de cambiar de sección.",
    );
  }, []);

  const handleBlockedNavClick = useCallback(
    (event: React.MouseEvent) => {
      if (!inVideoConsultation) return;
      event.preventDefault();
      warnNavigationBlocked();
    },
    [inVideoConsultation, warnNavigationBlocked],
  );

  const refreshCobrosUnread = useCallback(async () => {
    try {
      const data = await clinicApi.getCobrosUnreadCount();
      setCobrosUnread(data.cobrosCount);
    } catch {
      setCobrosUnread(0);
    }
  }, []);

  // Re-derives whether honorarios/agenda are still unconfigured. Called
  // after specialty setup completes and whenever the settings dialog
  // closes, so the gate re-appears if the médico backed out without saving
  // (must-configure, not a one-time dismissible tip).
  const recheckOnboardingGate = useCallback(async (doctorId: string) => {
    try {
      const office = await clinicApi.getDoctorSchedule(doctorId);
      setOnboardingGate(resolveOnboardingGate(office));
    } catch {
      /* leave gate state as-is on error */
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
    if (!doctor) return;
    clinicApi.pingInterconsultPresence();
    const interval = setInterval(() => clinicApi.pingInterconsultPresence(), 30_000);
    return () => clearInterval(interval);
  }, [doctor]);

  useEffect(() => {
    async function bootstrapMedicoSession() {
      try {
        let { session, user } = await clinicApi.getSession();
        if (!session) {
          setChecking(false);
          router.push("/login?role=medico");
          return;
        }

        // Dual-role accounts may still have a stale patient cookie — verify
        // médico access first and refresh clinica_session before rejecting.
        const verifyRes = await fetch("/api/clinic/account/verify-portal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ role: "medico" }),
        });
        if (!verifyRes.ok) {
          const verifyError = (await verifyRes.json().catch(() => ({}))) as {
            error?: string;
            code?: string;
          };
          if (verifyError.code === PROFESSIONAL_PENDING_APPROVAL_CODE && verifyError.error) {
            toast.error(verifyError.error);
          }
          await clinicApi.logout();
          setChecking(false);
          router.push("/login?role=medico");
          return;
        }

        invalidateClinicApiCache("session");
        ({ session, user } = await clinicApi.getSession());
        if (!session || session.role !== "doctor" || !user) {
          setChecking(false);
          router.push("/login?role=medico");
          return;
        }

        const verifyData = (await verifyRes.json()) as {
          professionalId?: string;
        };
        const professionalId = verifyData.professionalId ?? user.id;

        setCanSwitchToPatient(Boolean(user.canSwitchToPatient));
        setDoctor({
          id: professionalId,
          fullName: user.fullName ?? "",
          email: user.email ?? session.email ?? "",
          subscriptionPlan: user.subscriptionPlan,
          subscriptionStatus: user.subscriptionStatus,
          trialDaysRemaining: user.trialDaysRemaining,
          profilePhotoUrl: user.profilePhotoUrl,
        });
        try {
          const office = await clinicApi.getDoctorSchedule(professionalId);
          if (office.themeSettings) {
            useConsultorioStore.getState().hydrateSettings(
              mergeThemeSettings(office.themeSettings),
            );
          }
          const officeSpecialties = Array.isArray(office.specialties)
            ? (office.specialties as string[])
            : [];
          const needsSpecialty = needsSpecialtyAssignment(officeSpecialties);
          setSpecialtySetupOpen(needsSpecialty);
          if (!needsSpecialty) {
            setOnboardingGate(resolveOnboardingGate(office));
          }
          const photo =
            typeof office.profilePhotoData === "string" && office.profilePhotoData
              ? office.profilePhotoData
              : undefined;
          if (photo || office.fullName) {
            setDoctor((d) =>
              d
                ? {
                    ...d,
                    fullName: office.fullName || d.fullName,
                    profilePhotoUrl: photo ?? d.profilePhotoUrl,
                  }
                : d,
            );
          }
        } catch {
          /* tema / foto local por defecto */
        }
        setChecking(false);
      } catch {
        setChecking(false);
        router.push("/login?role=medico");
      }
    }

    void bootstrapMedicoSession();
  }, [router]);

  const title = ROUTE_TITLES[pathname] ?? "Gestión";
  const displayName = doctor?.fullName ?? "Médico";
  const firstName = displayName.trim().split(/\s+/)[0] || displayName;

  useEffect(() => {
    if (!doctor) return;

    const settingsTab = searchParams.get("settings");
    const mp = searchParams.get("mp");

    if (settingsTab === "cobros" || mp === "connected" || mp === "error") {
      setSettingsSection("cobros");
      setSettingsOpen(true);
    }

    if (!mp || mpCallbackHandled.current) return;
    mpCallbackHandled.current = true;

    if (mp === "connected") {
      toast.success(
        "Tu cuenta de Mercado Pago quedó vinculada. Los pacientes pueden pagarte por MP.",
      );
      setMpJustConnected(true);
    } else if (mp === "error") {
      const msg = searchParams.get("mp_msg") ?? "desconocido";
      toast.error(`No se pudo vincular Mercado Pago: ${mpErrorLabel(msg)}`);
    }

    const clearParams = () => router.replace(pathname, { scroll: false });
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(clearParams);
    } else {
      setTimeout(clearParams, 0);
    }
  }, [searchParams, router, pathname, doctor]);

  useEffect(() => {
    const handler = (e: Event) => {
      const section = (e as CustomEvent<{ section?: SectionId }>).detail?.section;
      setSettingsSection(section);
      setSettingsOpen(true);
    };
    window.addEventListener("nodo:open-settings", handler);
    return () => window.removeEventListener("nodo:open-settings", handler);
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ fullName?: string; profilePhotoUrl?: string }>).detail;
      if (!detail) return;
      setDoctor((d) =>
        d
          ? {
              ...d,
              fullName: detail.fullName ?? d.fullName,
              profilePhotoUrl: detail.profilePhotoUrl ?? d.profilePhotoUrl,
            }
          : d,
      );
    };
    window.addEventListener("nodo:profile-updated", handler);
    return () => window.removeEventListener("nodo:profile-updated", handler);
  }, []);

  const handleLogout = async () => {
    await clinicApi.logout();
    useConsultorioStore.getState().resetSettings();
    router.push("/login");
  };

  const handleCommandSelect = useCallback(
    (item: AdminCommandPaletteItem) => {
      if (inVideoConsultation) {
        warnNavigationBlocked();
        return;
      }
      router.push(item.href);
      setMobileMenuOpen(false);
    },
    [router, inVideoConsultation, warnNavigationBlocked],
  );

  useEffect(() => {
    if (!inVideoConsultation) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      const isModifier = event.metaKey || event.ctrlKey;
      if (!isModifier || event.key.toLowerCase() !== "k") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      warnNavigationBlocked();
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [inVideoConsultation, warnNavigationBlocked]);

  if (checking || !doctor) {
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
    <MedicoDoctorProvider doctor={doctor}>
    <AdminCommandPaletteProvider
      items={commandItems}
      onSelectItem={handleCommandSelect}
    >
      <div className="flex h-dvh max-h-dvh overflow-hidden bg-paper">
        {mobileMenuOpen && (
          <div
            className="fixed inset-0 z-50 bg-black/50 transition-opacity md:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}

        <aside
          className={cn(
            "fixed bottom-0 top-0 left-0 z-50 flex h-svh max-h-svh w-60 flex-shrink-0 flex-col bg-[var(--color-sidebar-bg)] transition-transform duration-300 ease-in-out border-r border-[var(--color-sidebar-border)] md:static md:z-auto md:translate-x-0 md:flex",
            mobileMenuOpen ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <div className="mt-2.5 flex h-16 shrink-0 items-center justify-between gap-2 px-5">
            <BrandMark onDark iconClassName="h-6 w-6" />
            <button
              type="button"
              className="shrink-0 md:hidden text-[var(--color-sidebar-text)] hover:text-white"
              onClick={() => setMobileMenuOpen(false)}
              aria-label="Cerrar menú"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <div className="md:hidden flex-shrink-0 border-b border-[var(--color-sidebar-border)] px-4 pb-3">
            <div className="flex items-center gap-3 py-1">
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--sidebar-primary)] text-xs font-bold text-[var(--sidebar-primary-foreground)]">
                {doctor?.profilePhotoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={doctor.profilePhotoUrl}
                    alt={displayName}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  initials(displayName)
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">
                  {firstName}
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
                  if (inVideoConsultation) {
                    warnNavigationBlocked();
                    return;
                  }
                  setMobileMenuOpen(false);
                  setSettingsOpen(true);
                }}
                className={cn(
                  "flex-shrink-0 rounded-md p-1.5 transition-colors text-[var(--color-sidebar-text)] hover:text-[var(--sidebar-accent-foreground)]",
                  inVideoConsultation && "opacity-40 cursor-not-allowed",
                )}
              >
                <Settings className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label="Cerrar sesión"
                onClick={() => {
                  if (inVideoConsultation) {
                    warnNavigationBlocked();
                    return;
                  }
                  void handleLogout();
                }}
                className={cn(
                  "flex-shrink-0 rounded-md p-1.5 transition-colors text-[var(--color-sidebar-text)] hover:text-[var(--sidebar-accent-foreground)]",
                  inVideoConsultation && "opacity-40 cursor-not-allowed",
                )}
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>

          <nav
            className={cn(
              "flex-1 min-h-0 overflow-y-auto px-3 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))]",
              inVideoConsultation && "opacity-60",
            )}
            aria-label="Navegación principal"
          >
            <SidebarNavAccordionProvider itemCount={NAV_ITEMS.length}>
              <SidebarNavGroup
                groupId="main"
                label="Menú"
                isActive={NAV_ITEMS.some(
                  (item) =>
                    pathname === item.href ||
                    (item.href !== "/medico/dashboard" &&
                      pathname.startsWith(item.href)),
                )}
              >
                {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
                  const isActive =
                    pathname === href ||
                    (href !== "/medico/dashboard" && pathname.startsWith(href));
                  const showCobrosBadge =
                    href === "/medico/cobros" && cobrosUnread > 0;
                  return (
                    <Link
                      key={href}
                      href={href}
                      onClick={(event) => {
                        if (inVideoConsultation) {
                          handleBlockedNavClick(event);
                          return;
                        }
                        setMobileMenuOpen(false);
                      }}
                      aria-disabled={inVideoConsultation}
                      tabIndex={inVideoConsultation ? -1 : undefined}
                      className={cn(
                        "flex items-center gap-3 rounded-sm px-3 py-2 text-sm font-medium transition-colors",
                        isActive
                          ? "bg-[var(--sidebar-primary)] text-[var(--sidebar-primary-foreground)]"
                          : "text-[var(--color-sidebar-text)] hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-accent-foreground)]",
                        inVideoConsultation &&
                          "cursor-not-allowed hover:bg-transparent hover:text-[var(--color-sidebar-text)]",
                      )}
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
              </SidebarNavGroup>
            </SidebarNavAccordionProvider>
            <SidebarCommandPaletteHint />
          </nav>

          <div className="hidden md:block flex-shrink-0 border-t border-[var(--color-sidebar-border)] px-3 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] space-y-2">
            <div className="flex items-center gap-3 px-1 py-1">
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--sidebar-primary)] text-xs font-bold text-[var(--sidebar-primary-foreground)]">
                {doctor?.profilePhotoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={doctor.profilePhotoUrl}
                    alt={displayName}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  initials(displayName)
                )}
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
                  if (inVideoConsultation) {
                    warnNavigationBlocked();
                    return;
                  }
                  setMobileMenuOpen(false);
                  setSettingsOpen(true);
                }}
                className={cn(
                  "flex-shrink-0 rounded-md p-1.5 transition-colors text-[var(--color-sidebar-text)] hover:text-[var(--sidebar-accent-foreground)]",
                  inVideoConsultation && "opacity-40 cursor-not-allowed",
                )}
              >
                <Settings className="h-4 w-4" />
              </button>
            </div>

            <Button
              variant="outline"
              onClick={() => {
                if (inVideoConsultation) {
                  warnNavigationBlocked();
                  return;
                }
                void handleLogout();
              }}
              disabled={inVideoConsultation}
              className="mt-2 w-full justify-center gap-2 border-[var(--color-sidebar-border)] bg-transparent text-[var(--color-sidebar-text)] hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-accent-foreground)] hover:border-[var(--sidebar-primary)] disabled:opacity-40"
            >
              <LogOut className="h-4 w-4" />
              Cerrar sesión
            </Button>
          </div>
        </aside>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <header className="flex flex-shrink-0 flex-col gap-3 border-b border-border bg-[#EEF3F8] px-4 py-3 shadow-sm sm:px-6 md:min-h-16 md:flex-row md:items-center md:gap-4">
            {/* Mobile: title row + actions row (evita solapamiento del PlanBadge) */}
            <div className="flex w-full min-w-0 flex-col gap-2 md:hidden">
              <div className="flex min-w-0 items-center gap-2">
                <button
                  type="button"
                  className="shrink-0 text-[var(--color-navy)] hover:text-[var(--color-primary)]"
                  onClick={() => setMobileMenuOpen(true)}
                  aria-label="Abrir menú"
                >
                  <Menu className="h-6 w-6" />
                </button>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[10px] font-semibold uppercase tracking-wide">
                    <span className="text-navy">NODO</span>
                    <span className="text-[var(--color-primary)]"> Clínica</span>
                    <span className="text-slate2"> · Profesionales</span>
                  </p>
                  <h1 className="truncate font-display text-base font-bold text-navy">
                    {title}
                  </h1>
                </div>
                {doctor ? (
                  <PlanBadge
                    compact
                    subscriptionStatus={
                      doctor.subscriptionStatus as
                        | "demo"
                        | "pending_payment"
                        | "active"
                        | "expired"
                        | "courtesy"
                        | undefined
                    }
                    trialDaysRemaining={doctor.trialDaysRemaining}
                  />
                ) : null}
              </div>

              {doctor ? (
                <div className="flex items-center justify-end gap-1.5">
                  <div
                    className={cn(
                      "flex items-center gap-0.5",
                      inVideoConsultation && "pointer-events-none opacity-50",
                    )}
                  >
                    <ClinicNotificationsBell
                      doctorId={doctor.id}
                      navigationDisabled={inVideoConsultation}
                      onNavigationBlocked={warnNavigationBlocked}
                    />
                    <NodoChatBell
                      chatEmbedded={chatEmbedded}
                      inVideoConsultation={inVideoConsultation}
                      onOpenChat={chatEmbedded ? undefined : openFloatingChat}
                    />
                  </div>
                  <div
                    className={cn(
                      "flex items-center gap-1.5",
                      inVideoConsultation && "pointer-events-none opacity-50",
                    )}
                  >
                    <RoleSwitcher
                      currentRole="doctor"
                      canSwitchToOther={canSwitchToPatient}
                      disabled={inVideoConsultation}
                      onDisabledClick={warnNavigationBlocked}
                    />
                    {/* TODO: uncomment nodoswitch when needed */}
                    {/* {isPlatformMode() && isBrowserSupabaseEnabled() ? (
                      <NodoSwitcher product="clinica" clinicaRole="medico" />
                    ) : null} */}
                  </div>
                </div>
              ) : null}
            </div>

            {/* Desktop / tablet */}
            <div className="hidden min-w-0 flex-1 items-center gap-3 md:flex">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide">
                  <span className="text-navy">NODO</span>
                  <span className="text-[var(--color-primary)]"> Clínica</span>
                  <span className="text-slate2"> · Profesionales</span>
                </p>
                <h1 className="truncate font-display text-xl font-bold text-navy">
                  {title}
                </h1>
              </div>
            </div>

            {doctor ? (
              <PortalHeaderActions
                notifications={
                  <div className="flex items-center gap-0.5">
                    <div
                      className={cn(
                        inVideoConsultation && "pointer-events-none opacity-50",
                      )}
                    >
                      <ClinicNotificationsBell
                        doctorId={doctor.id}
                        navigationDisabled={inVideoConsultation}
                        onNavigationBlocked={warnNavigationBlocked}
                      />
                    </div>
                    <NodoChatBell
                      chatEmbedded={chatEmbedded}
                      inVideoConsultation={inVideoConsultation}
                      onOpenChat={chatEmbedded ? undefined : openFloatingChat}
                    />
                  </div>
                }
                metrics={
                  <PlanBadge
                    subscriptionStatus={
                      doctor.subscriptionStatus as
                        | "demo"
                        | "pending_payment"
                        | "active"
                        | "expired"
                        | "courtesy"
                        | undefined
                    }
                    trialDaysRemaining={doctor.trialDaysRemaining}
                  />
                }
                trailing={
                  <div
                    className={cn(
                      "flex items-center gap-2",
                      inVideoConsultation && "pointer-events-none opacity-50",
                    )}
                  >
                    <RoleSwitcher
                      currentRole="doctor"
                      canSwitchToOther={canSwitchToPatient}
                      disabled={inVideoConsultation}
                      onDisabledClick={warnNavigationBlocked}
                    />
                    {/* TODO: uncomment nodoswitch when needed */}
                    {/* {isPlatformMode() && isBrowserSupabaseEnabled() ? (
                      <NodoSwitcher product="clinica" clinicaRole="medico" />
                    ) : null} */}
                  </div>
                }
              />
            ) : null}
          </header>

          <main className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain p-4 pb-[max(6rem,env(safe-area-inset-bottom,0px))] sm:p-6 sm:pb-6">
            {isPlatformMode() && isBrowserSupabaseEnabled() ? (
              <BillingLockoutGate>{children}</BillingLockoutGate>
            ) : (
              children
            )}
          </main>
        </div>

        {/* Mismo "nodito flotante" de feedback que el resto de los nodos
            (paquete compartido @nodocore/nodo-modules/feedback) — solo en
            el dashboard principal, y solo en modo plataforma (requiere
            sesión real de Supabase Auth para invocar la Edge Function). */}
        {doctor && pathname === "/medico/dashboard" && isPlatformMode() && isBrowserSupabaseEnabled() && (
          <FeedbackFAB supabase={createClient()} sourceNode="clinica" />
        )}

        {doctor && (
          <DoctorSettingsDialog
            key={doctor.id}
            open={settingsOpen}
            onOpenChange={(o) => {
              setSettingsOpen(o);
              if (o) setChatFloatingOpen(false);
              if (!o) {
                setSettingsSection(undefined);
                setMpJustConnected(false);
                void recheckOnboardingGate(doctor.id);
              }
            }}
            doctorId={doctor.id}
            initialSection={settingsSection}
            mpJustConnected={mpJustConnected}
          />
        )}
        {doctor && (
          <DoctorSpecialtySetupModal
            open={specialtySetupOpen}
            onComplete={() => {
              setSpecialtySetupOpen(false);
              void recheckOnboardingGate(doctor.id);
            }}
          />
        )}
        {doctor && onboardingGate && !specialtySetupOpen && (
          <DoctorOnboardingGateModal
            kind={onboardingGate}
            open
            onContinue={() => {
              // "ambos" and "honorarios" both start at cobros (fees first);
              // "agenda" jumps straight to the schedule section.
              setSettingsSection(onboardingGate === "agenda" ? "agenda" : "cobros");
              setSettingsOpen(true);
              setOnboardingGate(null);
            }}
          />
        )}
        {doctor &&
          !chatEmbedded &&
          !settingsOpen &&
          isProPlan(doctor.subscriptionPlan) && (
          <NodoChatWidget
            key={chatSessionKey}
            doctorId={doctor.id}
            doctorName={doctor.fullName}
            isPro
            open={chatFloatingOpen}
            onOpenChange={setChatFloatingOpen}
            hideLauncher
            floatingVariant={inVideoConsultation ? "consultation" : "default"}
            initialPeerId={chatInitialPeer.id ?? null}
            initialPeerName={chatInitialPeer.name ?? null}
          />
        )}
      </div>
    </AdminCommandPaletteProvider>
    </MedicoDoctorProvider>
  );
}

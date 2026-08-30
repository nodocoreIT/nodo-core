"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  ChevronDown,
  ClipboardList,
  DatabaseBackup,
  KeyRound,
  Layers,
  LayoutDashboard,
  Lightbulb,
  LogOut,
  Map,
  MessageSquare,
  Settings,
  ShieldAlert,
  UserCog,
  Users,
  UsersRound,
  Video,
  Wallet,
  Wrench,
  X,
} from "lucide-react";
import {
  Button,
  cn,
  SidebarSearchHint,
} from "@nodocore/shared-components";
import { createClient } from "@/lib/supabase/client";
import { SettingsDialog } from "@nodocore/nodo-modules/settings";
import { useCommandPalette } from "@/components/CommandPaletteProvider";
import { useUnreadFeedbackCount } from "@/hooks/use-unread-feedback-count";
import { usePendingSolicitudesCount } from "@/hooks/use-pending-solicitudes-count";
import { clearPanelSessionClock } from "./PanelSessionTimeoutGuard";
import { PanelBrandMark } from "./PanelBrandMark";

type NavItem = {
  label: string;
  href: string;
  icon: React.ElementType;
  enabled?: boolean;
  badgeCount?: number;
};

export type SidebarProps = {
  userFullName: string;
  userEmail: string;
  userInitials: string;
  userColor: string;
  userAvatarUrl: string | null;
  /** nodo_core.profiles.role — "qa" gets a reduced nav (Ideas + Tareas + logout only). */
  role?: string | null;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
};

/** Restricted roles see only these platform items — everything else (ecosystem,
 *  herramientas, search, meeting link, settings) is hidden, not just unlinked. */
const RESTRICTED_ROLE_VISIBLE_HREFS: Record<string, string[]> = {
  qa: ["/panel/ideas", "/panel/tareas", "/panel/roadmap"],
};

const PLATFORM_ITEMS: NavItem[] = [
  { label: "Solicitudes", href: "/panel/solicitudes", icon: ClipboardList },
  { label: "Feedback", href: "/panel/feedback", icon: MessageSquare },
  { label: "Ideas", href: "/panel/ideas", icon: Lightbulb },
  { label: "Tareas", href: "/panel/tareas", icon: LayoutDashboard },
  { label: "Roadmap", href: "/panel/roadmap", icon: Map },
  { label: "Clientes", href: "/panel/clientes", icon: Users },
  { label: "Usuarios de Nodo", href: "/panel/usuarios-nodo", icon: UserCog },
  { label: "Caja", href: "/panel/caja", icon: Wallet },
  { label: "Equipo", href: "/panel/equipo", icon: UsersRound },
];

const ECOSYSTEM_ITEMS: NavItem[] = [
  { label: "Unidades", href: "/panel/unidades", icon: Layers, enabled: true },
];

const TOOLS_ITEMS: NavItem[] = [
  { label: "Bóveda de contraseñas", href: "/panel/passwords", icon: KeyRound },
  { label: "Backups", href: "/panel/backups", icon: DatabaseBackup },
  { label: "Informes", href: "/panel/informes", icon: BarChart3 },
  { label: "Auditorías", href: "/panel/auditorias", icon: ShieldAlert },
];


function NavBadge({ count }: { count: number }) {
  return (
    <span
      aria-label={`${count} sin leer`}
      className="inline-block rounded-full bg-rose-600 px-2.5 py-[3px] text-[11.5px] font-semibold text-white"
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

function isNavItemActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

function NavLinks({
  items,
  pathname,
  onNavigate,
}: {
  items: NavItem[];
  pathname: string;
  onNavigate?: () => void;
}) {
  return items.map((item) => {
    const active = isNavItemActive(pathname, item.href);
    const Icon = item.icon;

    if (item.enabled === false) {
      return (
        <div
          key={item.href}
          className="flex items-center gap-3 rounded-sm px-3 py-2 text-sm font-medium text-[var(--color-sidebar-text)] opacity-40"
        >
          <Icon className="h-4 w-4 flex-shrink-0" />
          <span className="flex-1">{item.label}</span>
        </div>
      );
    }

    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={onNavigate}
        className={cn(
          "flex items-center gap-3 rounded-sm px-3 py-2 text-sm font-medium transition-colors",
          active
            ? "bg-brand text-[var(--color-primary-foreground)]"
            : "text-[var(--color-sidebar-text)] hover:bg-brand/10 hover:text-brand",
        )}
      >
        <Icon className="h-4 w-4 flex-shrink-0" />
        <span className="flex-1 truncate">{item.label}</span>
        {!!item.badgeCount && item.badgeCount > 0 && <NavBadge count={item.badgeCount} />}
      </Link>
    );
  });
}

/**
 * Grupo colapsable de ítems de nav (ej. "Herramientas"). Se auto-expande
 * cuando la ruta activa está dentro del grupo, y no se puede colapsar
 * manualmente mientras eso sea así — evita esconder la sección en la que
 * el usuario está parado.
 */
function NavGroup({
  label,
  icon: Icon,
  items,
  pathname,
  onNavigate,
}: {
  label: string;
  icon: React.ElementType;
  items: NavItem[];
  pathname: string;
  onNavigate?: () => void;
}) {
  const hasActiveChild = items.some((item) => isNavItemActive(pathname, item.href));
  const [manuallyExpanded, setManuallyExpanded] = useState(false);
  const expanded = hasActiveChild || manuallyExpanded;
  const panelId = `nav-group-${label.toLowerCase().replace(/\s+/g, "-")}`;

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          // Bloqueado abierto por la ruta activa: ignorar el click en vez de
          // dejar manuallyExpanded="pegado" en true para cuando se navegue
          // afuera del grupo y ya no haya nada forzándolo.
          if (hasActiveChild) return;
          setManuallyExpanded((prev) => !prev);
        }}
        aria-expanded={expanded}
        aria-controls={panelId}
        className="flex w-full items-center gap-3 rounded-sm px-3 py-2 text-sm font-medium text-[var(--color-sidebar-text)] transition-colors hover:bg-brand/10 hover:text-brand"
      >
        <Icon className="h-4 w-4 flex-shrink-0" />
        <span className="flex-1 text-left">{label}</span>
        <ChevronDown
          className={cn(
            "h-4 w-4 flex-shrink-0 transition-transform duration-200",
            expanded ? "rotate-180" : "",
          )}
        />
      </button>
      {expanded && (
        <div id={panelId} className="ml-4 space-y-1 border-l border-[var(--color-sidebar-border)] pl-3">
          <NavLinks items={items} pathname={pathname} onNavigate={onNavigate} />
        </div>
      )}
    </div>
  );
}

export default function Sidebar({
  userFullName,
  userEmail,
  userInitials,
  userColor,
  userAvatarUrl,
  role,
  mobileOpen = false,
  onMobileClose,
}: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { open: openCommandPalette } = useCommandPalette();
  const { count: unreadFeedbackCount } = useUnreadFeedbackCount();
  const { count: pendingSolicitudesCount } = usePendingSolicitudesCount();

  const visibleHrefs = role ? RESTRICTED_ROLE_VISIBLE_HREFS[role] : undefined;
  const isRestricted = !!visibleHrefs;

  const platformItems = PLATFORM_ITEMS.filter(
    (item) => !visibleHrefs || visibleHrefs.includes(item.href),
  ).map((item) => {
    if (item.href === "/panel/feedback") {
      return { ...item, badgeCount: unreadFeedbackCount };
    }
    if (item.href === "/panel/solicitudes") {
      return { ...item, badgeCount: pendingSolicitudesCount };
    }
    return item;
  });

  async function handleSignOut() {
    const supabase = createClient();
    clearPanelSessionClock();
    await supabase.auth.signOut({ scope: "local" });
    router.push("/login");
  }

  return (
    <>
      <aside
        className={cn(
          "fixed bottom-0 top-0 left-0 z-50 flex h-dvh w-60 flex-shrink-0 flex-col border-r border-border bg-[var(--color-sidebar-bg)] transition-transform duration-300 ease-in-out md:static md:z-auto md:translate-x-0 md:flex",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="relative mt-2.5 flex h-14 w-full flex-shrink-0 items-center px-5">
          <Link href="/panel" className="flex items-center" onClick={onMobileClose}>
            <PanelBrandMark onDark iconClassName="h-12 w-auto max-w-[190px]" />
          </Link>
          <button
            type="button"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--color-sidebar-text)] hover:text-white md:hidden"
            onClick={onMobileClose}
            aria-label="Cerrar menú"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <nav
          className="flex-1 space-y-1 overflow-y-auto px-3 py-2"
          aria-label="Navegación principal"
        >
          <NavLinks
            items={platformItems}
            pathname={pathname}
            onNavigate={onMobileClose}
          />

          {!isRestricted && (
            <>
              <div className="my-2 border-t border-[var(--color-sidebar-border)]" />

              <NavLinks
                items={ECOSYSTEM_ITEMS}
                pathname={pathname}
                onNavigate={onMobileClose}
              />

              <div className="my-2 border-t border-[var(--color-sidebar-border)]" />

              <NavGroup
                label="Herramientas"
                icon={Wrench}
                items={TOOLS_ITEMS}
                pathname={pathname}
                onNavigate={onMobileClose}
              />

              <SidebarSearchHint onClick={openCommandPalette} />
            </>
          )}
        </nav>

        {!isRestricted && (
          <div className="px-3 pb-3">
            <a
              href="https://meet.google.com/fbx-yewk-dir?authuser=0&pli=1"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 rounded-sm border border-[var(--color-sidebar-border)] px-3 py-2 text-sm font-medium text-[var(--color-sidebar-text)] transition-colors hover:border-brand hover:bg-brand/10 hover:text-brand"
            >
              <Video className="h-4 w-4 flex-shrink-0" />
              Unirme a reunión
            </a>
          </div>
        )}

        <div className="flex-shrink-0 border-t border-[var(--color-sidebar-border)] p-3">
          <div className="flex items-center gap-3 px-1 py-1">
            {userAvatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={userAvatarUrl}
                alt={userFullName}
                className="h-9 w-9 flex-shrink-0 rounded-full object-cover"
              />
            ) : (
              <div
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                style={{ background: userColor }}
              >
                {userInitials}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">
                {userFullName}
              </p>
              <p className="truncate text-xs text-[var(--color-sidebar-text)]">
                {userEmail}
              </p>
            </div>
            {!isRestricted && (
              <button
                type="button"
                aria-label="Configuración"
                onClick={() => {
                  onMobileClose?.();
                  setSettingsOpen(true);
                }}
                className="flex-shrink-0 cursor-pointer rounded-md p-1.5 text-[var(--color-sidebar-text)] transition-colors hover:text-brand"
              >
                <Settings className="h-4 w-4" />
              </button>
            )}
          </div>

          <Button
            variant="outline"
            onClick={handleSignOut}
            className="mt-2 w-full cursor-pointer justify-center gap-2 border-[var(--color-sidebar-border)] bg-transparent text-[var(--color-sidebar-text)] hover:border-brand hover:bg-brand/10 hover:text-brand"
          >
            <LogOut className="h-4 w-4" />
            Cerrar sesión
          </Button>
        </div>
      </aside>

      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </>
  );
}

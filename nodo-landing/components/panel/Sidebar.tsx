"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  ClipboardList,
  KeyRound,
  Layers,
  LayoutDashboard,
  Lightbulb,
  LogOut,
  Mail,
  Settings,
  Users,
  UsersRound,
  Video,
  Wallet,
  X,
} from "lucide-react";
import {
  Button,
  cn,
} from "@nodocore/shared-components";
import { createClient } from "@/lib/supabase/client";
import { SettingsDialog } from "@nodocore/nodo-modules/settings";
import { PanelBrandMark } from "./PanelBrandMark";

type NavItem = {
  label: string;
  href: string;
  icon: React.ElementType;
  enabled?: boolean;
};

export type SidebarProps = {
  userFullName: string;
  userEmail: string;
  userInitials: string;
  userColor: string;
  userAvatarUrl: string | null;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
};

const PLATFORM_ITEMS: NavItem[] = [
  { label: "Solicitudes pendientes", href: "/panel/solicitudes", icon: ClipboardList },
  { label: "Ideas", href: "/panel/ideas", icon: Lightbulb },
  { label: "Tareas", href: "/panel/tareas", icon: LayoutDashboard },
  { label: "Clientes", href: "/panel/clientes", icon: Users },
  { label: "Caja", href: "/panel/caja", icon: Wallet },
  { label: "Equipo", href: "/panel/equipo", icon: UsersRound },
  { label: "Bóveda de contraseñas", href: "/panel/passwords", icon: KeyRound },
  { label: "Invitaciones", href: "/panel/invitaciones", icon: Mail },
];

const ECOSYSTEM_ITEMS: NavItem[] = [
  { label: "Unidades", href: "/panel/unidades", icon: Layers, enabled: true },
  { label: "Informes", href: "/panel/informes", icon: BarChart3, enabled: true },
];

function NavSection({
  title,
  items,
  pathname,
  onNavigate,
}: {
  title: string;
  items: NavItem[];
  pathname: string;
  onNavigate?: () => void;
}) {
  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <div className="mb-4">
      <p
        className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-[var(--color-sidebar-text)] opacity-60"
      >
        {title}
      </p>
      <div className="flex flex-col gap-1">
        {items.map((item) => {
          const active = isActive(item.href);
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
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export default function Sidebar({
  userFullName,
  userEmail,
  userInitials,
  userColor,
  userAvatarUrl,
  mobileOpen = false,
  onMobileClose,
}: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [settingsOpen, setSettingsOpen] = useState(false);

  async function handleSignOut() {
    const supabase = createClient();
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
        <div className="relative mt-2.5 flex h-16 w-full flex-shrink-0 items-center">
          <Link href="/panel" className="flex w-full items-center" onClick={onMobileClose}>
            <PanelBrandMark onDark fillWidth iconClassName="h-6 w-6" />
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
          className="flex-1 overflow-y-auto px-3 py-2"
          aria-label="Navegación principal"
        >
          <NavSection
            title="Plataforma"
            items={PLATFORM_ITEMS}
            pathname={pathname}
            onNavigate={onMobileClose}
          />
          <NavSection
            title="Ecosistema"
            items={ECOSYSTEM_ITEMS}
            pathname={pathname}
            onNavigate={onMobileClose}
          />
        </nav>

        <div className="px-3 pb-3">
          <a
            href="https://us05web.zoom.us/j/85456616409?pwd=OmLUE8DbGEkE6ilJpFNdfPEvj3J8Zg.1"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 rounded-sm border border-[var(--color-sidebar-border)] px-3 py-2 text-sm font-medium text-[var(--color-sidebar-text)] transition-colors hover:border-brand hover:bg-brand/10 hover:text-brand"
          >
            <Video className="h-4 w-4 flex-shrink-0" />
            Unirme a reunión
          </a>
        </div>

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

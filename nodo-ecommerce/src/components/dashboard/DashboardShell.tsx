"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  Package,
  UserCircle,
  LogOut,
  Menu,
  X,
  ShoppingBag,
  Bell,
  ChevronRight,
  Globe,
  Layers,
  GalleryHorizontal,
  Images,
  Palette,
  Tag,
  Sun,
  Moon,
  Settings,
  Truck,
} from "lucide-react";

const NAV = [
  {
    slug: "productos",
    href: "/dashboard",
    label: "Productos",
    icon: Package,
    match: (p: string) =>
      p === "/dashboard" ||
      p.startsWith("/dashboard/nuevo") ||
      p.startsWith("/dashboard/editar"),
  },
  {
    slug: "imagenes",
    href: "/dashboard/imagenes",
    label: "Imágenes",
    icon: Images,
    match: (p: string) => p.startsWith("/dashboard/imagenes"),
  },
  {
    slug: "carrousel",
    href: "/dashboard/carrousel",
    label: "Carrousel",
    icon: GalleryHorizontal,
    match: (p: string) => p.startsWith("/dashboard/carrousel"),
  },
  {
    slug: "pedidos",
    href: "/dashboard/pedidos",
    label: "Pedidos",
    icon: ShoppingBag,
    match: (p: string) => p.startsWith("/dashboard/pedidos"),
  },
  {
    slug: "categorias",
    href: "/dashboard/categorias",
    label: "Categorías",
    icon: Layers,
    match: (p: string) => p.startsWith("/dashboard/categorias"),
  },
  {
    slug: "marcas",
    href: "/dashboard/marcas",
    label: "Marcas",
    icon: Tag,
    match: (p: string) => p.startsWith("/dashboard/marcas"),
  },
  {
    slug: "proveedores",
    href: "/dashboard/proveedores",
    label: "Proveedores",
    icon: Truck,
    match: (p: string) => p.startsWith("/dashboard/proveedores"),
  },
  {
    slug: "configuracion",
    href: "/dashboard/configuracion",
    label: "Configuración",
    icon: Settings,
    match: (p: string) => p.startsWith("/dashboard/configuracion"),
  },
  {
    slug: "tema",
    href: "/dashboard/tema",
    label: "Tema",
    icon: Palette,
    match: (p: string) => p.startsWith("/dashboard/tema"),
  },
];

interface Props {
  user: { email?: string };
  nombreCompleto: string;
  children: React.ReactNode;
  enabledModules?: string[];
  preferredTheme?: 'dark' | 'light';
}

// Migrate old slugs to new consolidated 'configuracion' slug
const SLUG_MIGRATIONS: Record<string, string> = {
  'configuracion-sitio': 'configuracion',
  'mis-datos': 'configuracion',
  'datos-bancarios': 'configuracion',
}

function normalizeModules(modules: string[] | undefined): string[] | undefined {
  if (!modules) return undefined
  const normalized = modules.map((s) => SLUG_MIGRATIONS[s] ?? s)
  return [...new Set(normalized)]
}

export default function DashboardShell({ user, nombreCompleto, children, enabledModules, preferredTheme = 'dark' }: Props) {
  const resolvedModules = normalizeModules(enabledModules)
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarLightbox, setAvatarLightbox] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>(preferredTheme);

  async function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (authUser) {
      await supabase.from('perfiles').update({ preferred_theme: next }).eq('id', authUser.id);
    }
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setAvatarUrl(data.user?.user_metadata?.avatar_url ?? null);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setAvatarUrl(session?.user?.user_metadata?.avatar_url ?? null);
    });

    return () => listener.subscription.unsubscribe();
  }, [supabase]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [pendingOrders, setPendingOrders] = useState<any[]>([]);
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);

  // Cargar notificaciones descartadas del localStorage
  useEffect(() => {
    const saved = localStorage.getItem("dismissed_notifications");
    if (saved) setDismissedIds(JSON.parse(saved));
  }, []);

  const dismissNotification = (id: string) => {
    const updated = [...dismissedIds, id];
    setDismissedIds(updated);
    localStorage.setItem("dismissed_notifications", JSON.stringify(updated));
  };

  // Fetch pending orders and birthdays
  useEffect(() => {
    const fetchPending = async () => {
      const { data } = await supabase
        .from("pedidos")
        .select("*")
        .eq("estado", "pendiente")
        .order("created_at", { ascending: false });
      setPendingOrders(data || []);
    };

    fetchPending();

    // Subscribe to changes
    const channel = supabase
      .channel("dashboard_notifications")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pedidos" },
        () => fetchPending()
      )
      .subscribe();

    // Escuchar evento manual de refresco
    const handleManualRefresh = () => {
      fetchPending();
    };
    window.addEventListener('refresh-orders-count', handleManualRefresh);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener('refresh-orders-count', handleManualRefresh);
    };
  }, [supabase]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  // Nombre a mostrar: nombre_completo o primer parte del email
  const displayName = nombreCompleto || user.email?.split("@")[0] || "Admin";

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Avatar + Bienvenida */}
      <div className="px-5 pt-5 pb-4 border-b border-luxury-gray-mid">
        <button
          type="button"
          onClick={() => avatarUrl && setAvatarLightbox(true)}
          className={`w-12 h-12 rounded-full border-2 border-luxury-gray-mid overflow-hidden bg-luxury-gray flex items-center justify-center mb-3 transition-all duration-200 ${avatarUrl ? "cursor-pointer hover:border-gold hover:scale-110" : "cursor-default"}`}
          aria-label={avatarUrl ? "Ver foto en grande" : undefined}
          disabled={!avatarUrl}
        >
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="Foto de perfil" className="w-full h-full object-cover" />
          ) : (
            <UserCircle size={28} className="text-[#444]" />
          )}
        </button>

        <p className="text-[#555555] text-[10px] tracking-[0.2em] uppercase">
          Bienvenida
        </p>
        <p className="text-gold text-sm font-semibold mt-0.5 leading-tight truncate">
          {displayName}
        </p>
        <p className="text-luxury-gray-light text-[10px] tracking-widest uppercase mt-1">
          Dashboard
        </p>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {(resolvedModules && resolvedModules.length > 0
          ? NAV.filter((item) => resolvedModules.includes(item.slug))
          : NAV
        ).map((item) => {
          const active = item.match(pathname);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 text-sm transition-all duration-150 ${
                active
                  ? "bg-gold/10 border-l-2 border-gold text-gold pl-2.5"
                  : "text-luxury-gray-light hover:text-gold hover:bg-gold/5 border-l-2 border-transparent"
              }`}
            >
              <Icon size={15} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Email al pie */}
      <div className="px-5 py-4 border-t border-luxury-gray-mid">
        <p className="text-luxury-gray-light text-xs truncate">{user.email}</p>
      </div>
    </div>
  );

  return (
    <>
    {/* Avatar lightbox */}
    {avatarLightbox && avatarUrl && (
      <div
        className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm"
        onClick={() => setAvatarLightbox(false)}
      >
        <button
          className="absolute top-4 right-4 text-white/60 hover:text-white transition-colors"
          onClick={() => setAvatarLightbox(false)}
          aria-label="Cerrar"
        >
          <X size={28} />
        </button>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={avatarUrl}
          alt="Foto de perfil"
          className="max-w-[90vw] max-h-[90vh] rounded-full object-cover shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        />
      </div>
    )}
    <div className="min-h-screen bg-luxury-black flex" data-theme={theme}>
      {/* Sidebar desktop */}
      <aside className="hidden md:flex flex-col w-56 shrink-0 bg-luxury-gray border-r border-luxury-gray-mid fixed top-0 left-0 h-full z-30">
        {sidebarContent}
      </aside>

      {/* Sidebar mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/70 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar mobile panel */}
      <aside
        className={`fixed top-0 left-0 h-full w-56 bg-luxury-gray border-r border-luxury-gray-mid z-50 md:hidden transition-transform duration-300 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <button
          onClick={() => setSidebarOpen(false)}
          className="absolute top-4 right-4 text-luxury-gray-light hover:text-gold"
        >
          <X size={18} />
        </button>
        {sidebarContent}
      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0 md:pl-56">
        {/* Top bar (desktop + mobile) */}
        <header className="bg-luxury-gray border-b border-luxury-gray-mid px-4 py-3 flex items-center justify-between">
          {/* Mobile: hamburger + logo */}
          <div className="flex items-center gap-3 md:hidden">
            <button
              onClick={() => setSidebarOpen(true)}
              className="text-luxury-gray-light hover:text-white transition-colors"
            >
              <Menu size={20} />
            </button>
            <Image
              src="/logo.png"
              alt="Logo"
              width={60}
              height={60}
              className="h-7 w-auto object-contain"
            />
          </div>

          {/* Desktop: nombre a la izquierda */}
          <p className="hidden md:block text-[#555555] text-xs truncate">
            {displayName}
          </p>

          <div className="flex items-center gap-4 ml-auto md:ml-0">
            {/* Campanita de Notificaciones */}
            <button
              onClick={() => setNotificationsOpen(true)}
              className="relative p-2 text-luxury-gray-light hover:text-gold transition-colors group"
            >
              <Bell size={20} className={pendingOrders.length > 0 ? "animate-pulse" : ""} />
              {pendingOrders.filter(o => !dismissedIds.includes(o.id)).length > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-red-600 text-white text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-black">
                  {pendingOrders.filter(o => !dismissedIds.includes(o.id)).length}
                </span>
              )}
            </button>

            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              className="flex items-center gap-2 border border-luxury-gray-mid hover:border-gold/50 text-luxury-gray-light hover:text-gold hover:bg-gold/5 text-xs px-3 py-2 transition-all duration-200"
              title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
            >
              {theme === 'dark' ? <Sun size={13} /> : <Moon size={13} />}
              <span className="hidden sm:inline">{theme === 'dark' ? 'Claro' : 'Oscuro'}</span>
            </button>

            {/* Ver mi web */}
            <Link
              href="/"
              target="_blank"
              className="flex items-center gap-2 border border-luxury-gray-mid hover:border-gold/50 text-luxury-gray-light hover:text-gold hover:bg-gold/5 text-xs px-3 py-2 transition-all duration-200"
            >
              <Globe size={13} />
              Ver mi web
            </Link>

            {/* Logout */}
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 border border-luxury-gray-mid hover:border-red-500/50 text-luxury-gray-light hover:text-red-400 hover:bg-red-500/5 text-xs px-3 py-2 transition-all duration-200"
            >
              <LogOut size={13} />
              Cerrar sesión
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          {children}
        </main>

        {/* CENTRO DE NOTIFICACIONES (Slide-over) */}
        {notificationsOpen && (
          <div className="fixed inset-0 z-[100] overflow-hidden">
            <div 
              className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" 
              onClick={() => setNotificationsOpen(false)} 
            />
            
            <div className="absolute inset-y-0 right-0 max-w-full flex">
              <div className="w-screen max-w-md transform transition-transform duration-300 ease-in-out bg-luxury-black border-l border-luxury-gray-mid shadow-2xl flex flex-col">
                {/* Header */}
                <div className="px-6 py-5 border-b border-luxury-gray-mid flex items-center justify-between bg-luxury-gray">
                  <div>
                    <h2 className="text-text font-bold text-base tracking-widest uppercase flex items-center gap-2">
                      <Bell size={18} className="text-gold" />
                      Centro de Novedades
                    </h2>
                    <p className="text-[#555555] text-[10px] uppercase tracking-widest mt-0.5">
                      Panel de control administrativo
                    </p>
                  </div>
                  <button 
                    onClick={() => setNotificationsOpen(false)}
                    className="p-2 text-[#555555] hover:text-white transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  {/* Pedidos */}
                  <div className="space-y-3">
                    <h3 className="text-[#555555] text-[10px] font-bold tracking-[0.2em] uppercase flex items-center gap-2">
                      <ShoppingBag size={12} /> Pedidos Pendientes
                    </h3>
                    <div className="space-y-2">
                      {pendingOrders.filter(o => !dismissedIds.includes(o.id)).length === 0 ? (
                        <div className="bg-[#111111]/30 border border-dashed border-luxury-gray-mid p-8 text-center rounded">
                          <ShoppingBag size={24} className="mx-auto mb-2 text-luxury-gray-mid" />
                          <p className="text-[#555555] text-xs">No hay pedidos pendientes por procesar.</p>
                        </div>
                      ) : (
                        pendingOrders
                          .filter(order => !dismissedIds.includes(order.id))
                          .map(order => (
                            <div 
                              key={order.id} 
                              className="bg-gold/5 border border-gold/20 p-4 rounded transition-all group relative opacity-100 hover:border-gold/40"
                            >
                              <div className="absolute top-2 right-2 w-2 h-2 bg-gold rounded-full shadow-[0_0_8px_rgba(212,175,55,0.6)]" />
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex gap-3">
                                  <div className="mt-1 w-8 h-8 rounded-full bg-gold/10 flex items-center justify-center text-gold">
                                    <ShoppingBag size={16} />
                                  </div>
                                  <div>
                                    <p className="text-white text-sm font-medium">Pedido #{order.numero_pedido}</p>
                                    <p className="text-luxury-gray-light text-xs mt-0.5">Monto total: <span className="text-gold">${order.total.toLocaleString()}</span></p>
                                    <p className="text-[#555555] text-[10px] mt-2 italic">Hacé clic para gestionar</p>
                                  </div>
                                </div>
                                <div className="flex flex-col items-end gap-2">
                                  <button 
                                    onClick={(e) => {
                                      e.preventDefault();
                                      dismissNotification(order.id);
                                    }}
                                    className="text-[#555555] hover:text-white transition-colors p-1"
                                    title="Marcar como leído"
                                  >
                                    <X size={14} />
                                  </button>
                                  <Link 
                                    href="/dashboard/pedidos"
                                    onClick={() => {
                                      setNotificationsOpen(false);
                                      dismissNotification(order.id);
                                    }}
                                    className="text-gold hover:text-gold-light transition-colors"
                                  >
                                    <ChevronRight size={18} />
                                  </Link>
                                </div>
                              </div>
                            </div>
                          ))
                      )}
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-luxury-gray-mid bg-luxury-gray">
                  <button 
                    onClick={() => {
                      const allIds = pendingOrders.map(o => o.id);
                      setDismissedIds(allIds);
                      localStorage.setItem("dismissed_notifications", JSON.stringify(allIds));
                    }}
                    className="w-full py-3 border border-luxury-gray-mid text-luxury-gray-light hover:text-white hover:border-gold transition-all text-xs uppercase tracking-[0.2em] font-bold"
                  >
                    Marcar todas como leídas
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
    </>
  );
}

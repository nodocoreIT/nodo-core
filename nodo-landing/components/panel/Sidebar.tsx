"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Settings, Video } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import SettingsModal from "./SettingsModal";

type NavItem = {
  label: string;
  href: string;
  count?: number;
  enabled?: boolean;
};

type SidebarProps = {
  userId: string;
  userFullName: string;
  userEmail: string;
  userInitials: string;
  userColor: string;
  userRole: string;
  userAvatarUrl: string | null;
  taskCount: number;
  clientCount: number;
  teamCount: number;
  expenseCount: number;
  ideaCount: number;
};

const PLATFORM_ITEMS: NavItem[] = [
  { label: "Ideas", href: "/panel/ideas" },
  { label: "Tareas", href: "/panel/tareas" },
  { label: "Clientes", href: "/panel/clientes" },
  { label: "Caja", href: "/panel/caja" },
  { label: "Equipo", href: "/panel/equipo" },
  { label: "Bóveda de contraseñas", href: "/panel/passwords" },
];

const ECOSYSTEM_ITEMS: NavItem[] = [
  { label: "Unidades", href: "/panel/unidades", enabled: true },
  { label: "Informes", href: "/panel/informes", enabled: false },
  { label: "Ajustes", href: "/panel/ajustes", enabled: false },
];

export default function Sidebar({
  userId,
  userFullName,
  userEmail,
  userInitials,
  userColor,
  userRole,
  userAvatarUrl,
  taskCount,
  clientCount,
  teamCount,
  expenseCount,
  ideaCount,
}: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [showSettings, setShowSettings] = useState(false);

  const counts: Record<string, number> = {
    "/panel/ideas": ideaCount,
    "/panel/tareas": taskCount,
    "/panel/clientes": clientCount,
    "/panel/caja": expenseCount,
    "/panel/equipo": teamCount,
  };

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <>
      <aside
        className="panel-sidebar"
        style={{
          width: 256,
          background: "var(--color-navy-900)",
          height: "100vh",
          display: "flex",
          flexDirection: "column",
          flexShrink: 0,
        }}
      >
        {/* Logo */}
        <div style={{ padding: "24px 20px 20px" }}>
          <Link href="/panel" style={{ display: "inline-block" }}>
            <Image
              src="/logos/nodo bco.png"
              alt="Nodo Core"
              height={24}
              width={72}
              className="h-[24px] w-auto"
            />
          </Link>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, overflowY: "auto", padding: "4px 12px" }}>
          {/* PLATAFORMA group */}
          <div style={{ marginBottom: 24 }}>
            <p
              style={{
                fontSize: 11,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.14em",
                color: "var(--color-slate2)",
                padding: "0 8px",
                marginBottom: 4,
              }}
            >
              Plataforma
            </p>
            {PLATFORM_ITEMS.map((item) => {
              const active = isActive(item.href);
              const count = counts[item.href];
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "8px 10px",
                    borderRadius: 8,
                    marginBottom: 2,
                    textDecoration: "none",
                    fontSize: 14,
                    fontWeight: 600,
                    color: active ? "white" : "rgba(234,240,247,.72)",
                    background: active ? "var(--color-brand)" : "transparent",
                    boxShadow: active
                      ? "0 6px 16px rgba(218,90,14,.3)"
                      : "none",
                    transition: "background 150ms, color 150ms",
                  }}
                  onMouseEnter={(e) => {
                    if (!active) {
                      (e.currentTarget as HTMLElement).style.background =
                        "rgba(255,255,255,.06)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!active) {
                      (e.currentTarget as HTMLElement).style.background =
                        "transparent";
                    }
                  }}
                >
                  <span>{item.label}</span>
                  {count !== undefined && (
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        background: active
                          ? "rgba(255,255,255,.22)"
                          : "rgba(255,255,255,.12)",
                        borderRadius: 999,
                        padding: "2px 8px",
                      }}
                    >
                      {count}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>

          {/* ECOSISTEMA group */}
          <div>
            <p
              style={{
                fontSize: 11,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.14em",
                color: "var(--color-slate2)",
                padding: "0 8px",
                marginBottom: 4,
              }}
            >
              Ecosistema
            </p>
            {ECOSYSTEM_ITEMS.map((item) => {
              const active = isActive(item.href);
              if (item.enabled) {
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "8px 10px",
                      borderRadius: 8,
                      marginBottom: 2,
                      textDecoration: "none",
                      fontSize: 14,
                      fontWeight: 600,
                      color: active ? "white" : "rgba(234,240,247,.72)",
                      background: active ? "var(--color-brand)" : "transparent",
                      boxShadow: active ? "0 6px 16px rgba(218,90,14,.3)" : "none",
                      transition: "background 150ms, color 150ms",
                    }}
                    onMouseEnter={(e) => {
                      if (!active) {
                        (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,.06)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!active) {
                        (e.currentTarget as HTMLElement).style.background = "transparent";
                      }
                    }}
                  >
                    <span>{item.label}</span>
                  </Link>
                );
              }
              return (
                <div
                  key={item.href}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    padding: "8px 10px",
                    borderRadius: 8,
                    marginBottom: 2,
                    fontSize: 14,
                    fontWeight: 600,
                    color: "rgba(234,240,247,.4)",
                    cursor: "default",
                  }}
                >
                  {item.label}
                </div>
              );
            })}
          </div>
        </nav>

        {/* Zoom Meeting */}
        <div style={{ padding: "0 12px 12px" }}>
          <a
            href="https://us05web.zoom.us/j/85456616409?pwd=OmLUE8DbGEkE6ilJpFNdfPEvj3J8Zg.1"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              width: "100%",
              padding: "9px 10px",
              borderRadius: 8,
              border: "none",
              background: "rgba(45,140,255,.15)",
              color: "rgba(100,180,255,.9)",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              textDecoration: "none",
              transition: "background 150ms, color 150ms",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background =
                "rgba(45,140,255,.25)";
              (e.currentTarget as HTMLElement).style.color = "white";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background =
                "rgba(45,140,255,.15)";
              (e.currentTarget as HTMLElement).style.color =
                "rgba(100,180,255,.9)";
            }}
          >
            <Video size={16} strokeWidth={2} />
            Unirme a reunión
          </a>
        </div>

        {/* Footer */}
        <div
          style={{
            borderTop: "1px solid rgba(255,255,255,.1)",
            padding: "16px 12px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 12,
            }}
          >
            {userAvatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={userAvatarUrl}
                alt={userFullName}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  objectFit: "cover",
                  flexShrink: 0,
                }}
              />
            ) : (
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  background: userColor,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 13,
                  fontWeight: 700,
                  color: "white",
                  flexShrink: 0,
                }}
              >
                {userInitials}
              </div>
            )}
            <div style={{ overflow: "hidden" }}>
              <p
                style={{
                  margin: 0,
                  fontSize: 13,
                  fontWeight: 600,
                  color: "white",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {userFullName}
              </p>
              <p
                style={{
                  margin: 0,
                  fontSize: 11,
                  color: "rgba(234,240,247,.5)",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {userEmail}
              </p>
            </div>
            <button
              onClick={() => setShowSettings(true)}
              aria-label="Configuración de la cuenta"
              title="Configuración"
              style={{
                marginLeft: "auto",
                flexShrink: 0,
                width: 32,
                height: 32,
                borderRadius: 8,
                border: "none",
                background: "transparent",
                color: "rgba(234,240,247,.6)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                transition: "background 150ms, color 150ms",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background =
                  "rgba(255,255,255,.08)";
                (e.currentTarget as HTMLElement).style.color = "white";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background =
                  "transparent";
                (e.currentTarget as HTMLElement).style.color =
                  "rgba(234,240,247,.6)";
              }}
            >
              <Settings size={17} strokeWidth={1.9} />
            </button>
          </div>
          <button
            onClick={handleSignOut}
            style={{
              width: "100%",
              padding: "7px 10px",
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,.12)",
              background: "transparent",
              color: "rgba(234,240,247,.6)",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              textAlign: "left",
              transition: "background 150ms, color 150ms",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background =
                "rgba(255,255,255,.06)";
              (e.currentTarget as HTMLElement).style.color = "white";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = "transparent";
              (e.currentTarget as HTMLElement).style.color =
                "rgba(234,240,247,.6)";
            }}
          >
            Cerrar sesión
          </button>
        </div>
      </aside>

      {showSettings && (
        <SettingsModal
          userId={userId}
          userEmail={userEmail}
          initialFullName={userFullName}
          initialRole={userRole}
          initialAvatarUrl={userAvatarUrl}
          initials={userInitials}
          initialColor={userColor}
          isAdmin={userRole === "admin"}
          onClose={() => setShowSettings(false)}
        />
      )}
    </>
  );
}

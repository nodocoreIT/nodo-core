"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSupabase } from "@nodocore/shared-components";

/**
 * Session lifetime policy for the internal panel only — NOT enforced via a
 * project-wide Supabase Auth session/inactivity setting, because this
 * Supabase project is shared with every customer-facing Nodo app (Inmo,
 * Clínica, Finanzas, Autos, Ecommerce). A project-wide timeout would log out
 * regular customers mid-read; this guard only mounts inside the /panel tree.
 *
 * - Idle timeout: 20 min of no interaction, with a 60s warning first.
 *   Guidance for systems touching payment data (PCI-DSS) caps this at
 *   15 min; this panel has a password vault and client PII, so 20 min
 *   errs toward that same bracket while giving staff a little more room.
 * - Absolute session lifetime: 12h regardless of activity — the same
 *   reference point admin consoles commonly use (e.g. AWS IAM Identity
 *   Center's 12h default), forcing periodic re-auth even if a tab is
 *   never closed.
 */
const IDLE_TIMEOUT_MS = 20 * 60 * 1000;
const ABSOLUTE_TIMEOUT_MS = 12 * 60 * 60 * 1000;
const WARNING_BEFORE_MS = 60 * 1000;
const CHECK_INTERVAL_MS = 5 * 1000;
const ACTIVITY_THROTTLE_MS = 5 * 1000;

const LAST_ACTIVITY_KEY = "panel_last_activity";
const LOGIN_AT_KEY = "panel_login_at";
const ACTIVITY_EVENTS = ["mousemove", "keydown", "click", "scroll", "touchstart"] as const;

/** Called from every sign-out path (manual or forced) so the next login starts a clean clock. */
export function clearPanelSessionClock() {
  localStorage.removeItem(LAST_ACTIVITY_KEY);
  localStorage.removeItem(LOGIN_AT_KEY);
}

export function PanelSessionTimeoutGuard() {
  const supabase = useSupabase();
  const router = useRouter();
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const lastWriteRef = useRef(0);

  const signOut = useCallback(
    async (reason: "sesion_inactividad" | "sesion_expirada") => {
      clearPanelSessionClock();
      await supabase.auth.signOut({ scope: "local" });
      router.push(`/login?error=${reason}`);
    },
    [supabase, router],
  );

  const touchActivity = useCallback(() => {
    const now = Date.now();
    if (now - lastWriteRef.current < ACTIVITY_THROTTLE_MS) return;
    lastWriteRef.current = now;
    localStorage.setItem(LAST_ACTIVITY_KEY, String(now));
  }, []);

  useEffect(() => {
    if (!localStorage.getItem(LOGIN_AT_KEY)) {
      localStorage.setItem(LOGIN_AT_KEY, String(Date.now()));
    }
    if (!localStorage.getItem(LAST_ACTIVITY_KEY)) {
      localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
    }

    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, touchActivity, { passive: true });
    }

    const interval = window.setInterval(() => {
      const lastActivity = Number(localStorage.getItem(LAST_ACTIVITY_KEY)) || Date.now();
      const loginAt = Number(localStorage.getItem(LOGIN_AT_KEY)) || Date.now();
      const idleFor = Date.now() - lastActivity;
      const sessionAge = Date.now() - loginAt;

      if (sessionAge >= ABSOLUTE_TIMEOUT_MS) {
        void signOut("sesion_expirada");
        return;
      }
      if (idleFor >= IDLE_TIMEOUT_MS) {
        void signOut("sesion_inactividad");
        return;
      }
      if (idleFor >= IDLE_TIMEOUT_MS - WARNING_BEFORE_MS) {
        setSecondsLeft(Math.ceil((IDLE_TIMEOUT_MS - idleFor) / 1000));
      } else {
        setSecondsLeft(null);
      }
    }, CHECK_INTERVAL_MS);

    return () => {
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, touchActivity);
      }
      window.clearInterval(interval);
    };
  }, [touchActivity, signOut]);

  function handleStaySignedIn() {
    const now = Date.now();
    localStorage.setItem(LAST_ACTIVITY_KEY, String(now));
    lastWriteRef.current = now;
    setSecondsLeft(null);
  }

  if (secondsLeft === null) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(18,30,47,.52)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 2000,
        padding: 16,
      }}
    >
      <div
        style={{
          background: "white",
          borderRadius: 12,
          boxShadow: "0 8px 32px rgba(18,30,47,.25)",
          width: "100%",
          maxWidth: 380,
          padding: 24,
          textAlign: "center",
        }}
      >
        <h3
          style={{
            margin: "0 0 8px",
            fontSize: 16,
            fontWeight: 700,
            color: "var(--color-navy)",
            fontFamily: "var(--font-display)",
          }}
        >
          Tu sesión está por cerrarse
        </h3>
        <p style={{ margin: "0 0 20px", fontSize: 13.5, color: "var(--color-slate2)", lineHeight: 1.4 }}>
          Por inactividad, en {secondsLeft}s vas a salir del panel automáticamente.
        </p>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            type="button"
            onClick={handleStaySignedIn}
            style={{
              flex: 1,
              background: "var(--color-brand)",
              color: "white",
              border: "none",
              borderRadius: 8,
              padding: "10px 16px",
              fontSize: 13.5,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "var(--font-sans)",
            }}
          >
            Seguir conectado
          </button>
          <button
            type="button"
            onClick={() => void signOut("sesion_inactividad")}
            style={{
              flex: 1,
              background: "transparent",
              color: "var(--color-slate2)",
              border: "1px solid var(--color-mist)",
              borderRadius: 8,
              padding: "10px 16px",
              fontSize: 13.5,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "var(--font-sans)",
            }}
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSupabase } from "../providers/supabase-provider";

/**
 * Session lifetime policy shared across every Nodo product. Enforced
 * app-side (not via a project-wide Supabase Auth session/inactivity
 * setting) because every product shares one Supabase auth project — a
 * global timeout would fire identically for a customer mid-form as for
 * staff, with no way to tell them apart at that layer.
 *
 * - Idle timeout: 20 min of no interaction, with a 60s warning first.
 *   Guidance for systems touching payment data (PCI-DSS) caps this at
 *   15 min; 20 min stays close to that bracket without being annoying.
 * - Absolute session lifetime: 12h regardless of activity — the same
 *   reference point admin consoles commonly use (e.g. AWS IAM Identity
 *   Center's 12h default).
 *
 * Framework-agnostic on purpose: some Nodo apps are Next.js (nodo-landing,
 * nodo-clinica), others are React Router SPAs (nodo-inmo, nodo-finanzas,
 * nodo-autos) — this uses window.location instead of either router.
 */
const DEFAULT_IDLE_TIMEOUT_MS = 20 * 60 * 1000;
const DEFAULT_ABSOLUTE_TIMEOUT_MS = 12 * 60 * 60 * 1000;
const DEFAULT_WARNING_BEFORE_MS = 60 * 1000;
const CHECK_INTERVAL_MS = 5 * 1000;
const ACTIVITY_THROTTLE_MS = 5 * 1000;
const ACTIVITY_EVENTS = ["mousemove", "keydown", "click", "scroll", "touchstart"] as const;

/**
 * Clears the idle/absolute-timeout clock for a given nodo. MUST be called from
 * every sign-out path (manual, forced, or fail-closed deny), not just this
 * component's own `signOut`. Without this, a login right after a sign-out that
 * happened somewhere else (AuthProvider's fail-closed deny, enforceNodeAccess's
 * deny path, password reset, a logout button that hits a backend session
 * endpoint instead of this component) inherits the previous session's stale
 * `_last_activity`/`_login_at` values — the periodic check then reads the new
 * session as already idle/expired and bounces the user with
 * `session_error=sesion_inactividad` within one `CHECK_INTERVAL_MS` tick,
 * even though they just logged in.
 */
export function clearSessionClock(storageKeyPrefix: string) {
  localStorage.removeItem(`${storageKeyPrefix}_last_activity`);
  localStorage.removeItem(`${storageKeyPrefix}_login_at`);
}

export interface SessionTimeoutGuardProps {
  /** Where to send the user after a forced sign-out, e.g. "/login". */
  loginPath: string;
  /** ms of no interaction before forcing sign-out. Default 20 min. */
  idleTimeoutMs?: number;
  /** ms since login before forcing sign-out regardless of activity. Default 12h. */
  absoluteTimeoutMs?: number;
  /** ms before the idle timeout to show the warning dialog. Default 60s. */
  warningBeforeMs?: number;
  /** Distinguishes localStorage keys per app, in case any ever share an origin. */
  storageKeyPrefix?: string;
  /** Query param used to tell the login page why it landed there. Default "session_error". */
  errorParam?: string;
}

export function SessionTimeoutGuard({
  loginPath,
  idleTimeoutMs = DEFAULT_IDLE_TIMEOUT_MS,
  absoluteTimeoutMs = DEFAULT_ABSOLUTE_TIMEOUT_MS,
  warningBeforeMs = DEFAULT_WARNING_BEFORE_MS,
  storageKeyPrefix = "nodo_session",
  errorParam = "session_error",
}: SessionTimeoutGuardProps) {
  const supabase = useSupabase();
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const lastWriteRef = useRef(0);

  const lastActivityKey = `${storageKeyPrefix}_last_activity`;
  const loginAtKey = `${storageKeyPrefix}_login_at`;

  const signOut = useCallback(
    async (reason: "sesion_inactividad" | "sesion_expirada") => {
      clearSessionClock(storageKeyPrefix);
      await supabase.auth.signOut({ scope: "local" });
      const url = new URL(loginPath, window.location.origin);
      url.searchParams.set(errorParam, reason);
      window.location.href = url.toString();
    },
    [supabase, loginPath, storageKeyPrefix, errorParam],
  );

  const touchActivity = useCallback(() => {
    const now = Date.now();
    if (now - lastWriteRef.current < ACTIVITY_THROTTLE_MS) return;
    lastWriteRef.current = now;
    localStorage.setItem(lastActivityKey, String(now));
  }, [lastActivityKey]);

  useEffect(() => {
    if (!localStorage.getItem(loginAtKey)) {
      localStorage.setItem(loginAtKey, String(Date.now()));
    }
    if (!localStorage.getItem(lastActivityKey)) {
      localStorage.setItem(lastActivityKey, String(Date.now()));
    }

    // Defense-in-depth: if a fresh sign-in happens while this guard is already
    // mounted (e.g. same-tab re-login after a sign-out that didn't go through
    // this component's own signOut), reset the clock instead of leaving the
    // previous session's stale login_at/last_activity in place — otherwise the
    // periodic check below can read the brand-new session as already idle.
    // INITIAL_SESSION always fires on subscribe, even for an existing valid
    // session, so it's deliberately excluded here — only a real subsequent
    // SIGNED_IN should reset the clock.
    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") {
        const now = Date.now();
        localStorage.setItem(loginAtKey, String(now));
        localStorage.setItem(lastActivityKey, String(now));
        lastWriteRef.current = now;
      }
    });

    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, touchActivity, { passive: true });
    }

    const interval = window.setInterval(() => {
      const lastActivity = Number(localStorage.getItem(lastActivityKey)) || Date.now();
      const loginAt = Number(localStorage.getItem(loginAtKey)) || Date.now();
      const idleFor = Date.now() - lastActivity;
      const sessionAge = Date.now() - loginAt;

      if (sessionAge >= absoluteTimeoutMs) {
        void signOut("sesion_expirada");
        return;
      }
      if (idleFor >= idleTimeoutMs) {
        void signOut("sesion_inactividad");
        return;
      }
      if (idleFor >= idleTimeoutMs - warningBeforeMs) {
        setSecondsLeft(Math.ceil((idleTimeoutMs - idleFor) / 1000));
      } else {
        setSecondsLeft(null);
      }
    }, CHECK_INTERVAL_MS);

    return () => {
      authListener.subscription.unsubscribe();
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, touchActivity);
      }
      window.clearInterval(interval);
    };
  }, [
    supabase,
    touchActivity,
    signOut,
    idleTimeoutMs,
    absoluteTimeoutMs,
    warningBeforeMs,
    lastActivityKey,
    loginAtKey,
  ]);

  function handleStaySignedIn() {
    const now = Date.now();
    localStorage.setItem(lastActivityKey, String(now));
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
          Por inactividad, en {secondsLeft}s vas a salir automáticamente.
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

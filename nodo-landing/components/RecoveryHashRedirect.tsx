"use client";

import { useEffect, useRef } from "react";
import { RECOVERY_RETURN_COOKIE } from "@/lib/auth/recovery-cookies";
import { isRecoveryHash } from "@nodocore/shared-components";

function readCookie(name: string): string | null {
  const prefix = `${name}=`;
  const entry = document.cookie.split("; ").find((row) => row.startsWith(prefix));
  if (!entry) return null;
  try {
    return decodeURIComponent(entry.slice(prefix.length));
  } catch {
    return entry.slice(prefix.length);
  }
}

/**
 * Supabase recovery emails sometimes land on Site URL (/) with tokens in the hash
 * when redirectTo is not allow-listed. Forward hash to the node login saved at forgot-password time.
 */
export function RecoveryHashRedirect() {
  const redirected = useRef(false);

  useEffect(() => {
    if (redirected.current) return;

    const hash = window.location.hash;
    if (!isRecoveryHash(hash)) return;

    const { pathname, search } = window.location;

    // Already on a login page with recovery tokens — LoginForm handles bootstrap.
    if (pathname.endsWith("/login")) {
      if (search.includes("mode=reset-password") || isRecoveryHash(hash)) return;
    }

    const returnPath =
      readCookie(RECOVERY_RETURN_COOKIE) ?? "/login?mode=reset-password";

    const target = new URL(returnPath, window.location.origin);
    if (!target.searchParams.has("mode")) {
      target.searchParams.set("mode", "reset-password");
    }

    const destination = `${target.pathname}${target.search}#${hash.substring(1)}`;
    if (
      `${pathname}${search}` === `${target.pathname}${target.search}` &&
      isRecoveryHash(hash)
    ) {
      return;
    }

    redirected.current = true;
    window.location.replace(destination);
  }, []);

  return null;
}

"use client";

import { useEffect } from "react";

/**
 * Forwards to the clinica app preserving the URL hash — /auth/confirm embeds
 * the recovery session as #access_token=...&refresh_token=... there, and a
 * plain server-side redirect() can't see it (hash fragments never reach the
 * server), which silently dropped the session and produced "Auth session
 * missing!" once the user landed on clinica's own /login.
 */
export function ClinicaRedirectClient({ dest }: { dest: string }) {
  useEffect(() => {
    window.location.replace(`${dest}${window.location.hash}`);
  }, [dest]);

  return (
    <div className="min-h-screen bg-navy-900 text-white flex items-center justify-center font-semibold">
      Redirigiendo...
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

type AuthMode = "login" | "register" | "forgot" | "reset-password" | "first-access";

export function isRecoveryHash(hash: string): boolean {
  if (!hash || hash.length < 2) return false;
  const params = new URLSearchParams(hash.substring(1));
  if (params.get("type") === "recovery") return true;
  return Boolean(params.get("access_token") && params.get("refresh_token"));
}

type SearchParamsLike = {
  get: (name: string) => string | null;
  has: (name: string) => boolean;
};

type Options = {
  supabase: SupabaseClient<any, string, any>;
  modeParam: string;
  searchParams: SearchParamsLike;
  initialMode: AuthMode;
  onError?: (message: string) => void;
};

/**
 * Bootstraps a Supabase recovery session from email links (code, token_hash, hash).
 * Runs once per mount — stable deps to avoid getUser() fetch loops.
 */
export function usePasswordRecoveryBootstrap({
  supabase,
  modeParam,
  searchParams,
  initialMode,
  onError,
}: Options) {
  const [authMode, setAuthMode] = useState<AuthMode>(initialMode);
  const [bootstrapping, setBootstrapping] = useState(false);
  const onErrorRef = useRef(onError);
  const bootstrapStartedRef = useRef(false);

  onErrorRef.current = onError;

  const searchKey = [
    modeParam,
    searchParams.get("code") ?? "",
    searchParams.get("token_hash") ?? "",
    searchParams.get("type") ?? "",
  ].join("|");

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setAuthMode("reset-password");
        setBootstrapping(false);
      }
    });
    return () => subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    if (bootstrapStartedRef.current) return;
    bootstrapStartedRef.current = true;

    let cancelled = false;

    async function bootstrap() {
      const tokenHash = searchParams.get("token_hash");
      const recoveryType = searchParams.get("type");
      const hash = window.location.hash;
      const shouldBootstrap =
        modeParam === "reset-password" ||
        isRecoveryHash(hash) ||
        searchParams.has("code") ||
        (tokenHash !== null && recoveryType === "recovery");

      if (!shouldBootstrap) {
        setBootstrapping(false);
        return;
      }

      setBootstrapping(true);

      if (isRecoveryHash(hash)) {
        setAuthMode("reset-password");
      }

      if (tokenHash && recoveryType === "recovery") {
        const { error } = await supabase.auth.verifyOtp({
          type: "recovery",
          token_hash: tokenHash,
        });
        if (cancelled) return;
        if (error) {
          onErrorRef.current?.(
            "El enlace de recuperación expiró o ya fue usado. Solicitá uno nuevo.",
          );
          setBootstrapping(false);
          return;
        }
        setAuthMode("reset-password");
        const url = new URL(window.location.href);
        url.searchParams.delete("token_hash");
        url.searchParams.delete("type");
        window.history.replaceState(null, "", `${url.pathname}${url.search}`);
        setBootstrapping(false);
        return;
      }

      const code = searchParams.get("code");
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (cancelled) return;
        if (error) {
          onErrorRef.current?.(
            "El enlace de recuperación expiró o ya fue usado. Solicitá uno nuevo.",
          );
          setBootstrapping(false);
          return;
        }
        setAuthMode("reset-password");
        const url = new URL(window.location.href);
        url.searchParams.delete("code");
        window.history.replaceState(null, "", `${url.pathname}${url.search}`);
        setBootstrapping(false);
        return;
      }

      const hashBody = hash.substring(1);
      if (hashBody) {
        const params = new URLSearchParams(hashBody);
        const accessToken = params.get("access_token");
        const refreshToken = params.get("refresh_token");
        const type = params.get("type");

        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (cancelled) return;
          if (error) {
            onErrorRef.current?.("No se pudo validar el enlace de recuperación.");
            setBootstrapping(false);
            return;
          }
        }

        if (type === "recovery" || modeParam === "reset-password") {
          setAuthMode("reset-password");
          window.history.replaceState(
            null,
            "",
            `${window.location.pathname}${window.location.search}`,
          );
          setBootstrapping(false);
          return;
        }
      }

      if (modeParam === "reset-password") {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (cancelled) return;
        if (user) {
          setAuthMode("reset-password");
        } else {
          await new Promise((resolve) => setTimeout(resolve, 600));
          if (cancelled) return;
          const {
            data: { user: retryUser },
          } = await supabase.auth.getUser();
          if (retryUser) setAuthMode("reset-password");
        }
      }

      if (!cancelled) setBootstrapping(false);
    }

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, [supabase, modeParam, searchKey]);

  return { authMode, setAuthMode, bootstrapping };
}

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import type {
  Session,
  User,
  AuthTokenResponsePassword,
} from "@supabase/supabase-js";
import { useSupabase } from "./supabase-provider";

// ─── Public interfaces ──────────────────────────────────────────────────────

export interface AuthConfig {
  /** Maps role strings to redirect paths on successful sign-in. */
  roleDestinations: Record<string, string>;
}

export interface AuthContextValue {
  session: Session | null;
  user: User | null;
  /** Role string decoded from JWT app_metadata (e.g. "medico", "admin"). */
  role: string | null;
  /** Organisation ID decoded from JWT app_metadata, if present. */
  orgId: string | null;
  /** Subscription plan tier decoded from JWT app_metadata, if present. */
  plan: string | null;
  /** True while the initial session is being resolved. */
  isLoading: boolean;
  /**
   * Sign in and throw on failure.
   * Use this when you only care about success/failure (no need for the raw response).
   */
  signIn: (email: string, password: string) => Promise<void>;
  /**
   * Sign in and return the full Supabase AuthTokenResponsePassword.
   * Use this when the caller needs access to the session/tokens directly (e.g. nodo-inmo).
   */
  signInWithPassword: (credentials: {
    email: string;
    password: string;
  }) => Promise<AuthTokenResponsePassword>;
  signOut: () => Promise<void>;
  /** The roleDestinations map passed to AuthProvider — available for consumers (e.g. LoginPage). */
  roleDestinations: Record<string, string>;
}

// ─── JWT claims decoder ─────────────────────────────────────────────────────

/**
 * Decodes the JWT access_token payload and extracts custom claims from
 * app_metadata. This is the canonical source of truth for role, orgId, and
 * plan — NOT session.user.app_metadata, which may not reflect claims injected
 * by the Custom Access Token Hook in Supabase.
 *
 * Uses URL-safe base64 decoding (replaces `-` → `+`, `_` → `/`) to handle
 * the standard JWT encoding correctly.
 */
function readClaims(session: Session | null): {
  role: string | null;
  orgId: string | null;
  plan: string | null;
} {
  const token = session?.access_token;
  if (!token) return { role: null, orgId: null, plan: null };
  try {
    const payload = JSON.parse(
      atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
    );
    return {
      role: payload.app_metadata?.role ?? null,
      orgId: payload.app_metadata?.org_id ?? null,
      plan: payload.app_metadata?.plan ?? null,
    };
  } catch {
    return { role: null, orgId: null, plan: null };
  }
}

// ─── Context ────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

// ─── Provider ───────────────────────────────────────────────────────────────

export function AuthProvider({
  config,
  children,
}: {
  config: AuthConfig;
  children: ReactNode;
}) {
  const supabase = useSupabase();

  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Seed session from cache
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setIsLoading(false);
    });

    // Subscribe to auth state changes — readClaims is derived from session so
    // it updates automatically on token refresh without extra logic.
    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setIsLoading(false);
    });

    return () => listener.subscription.unsubscribe();
  }, [supabase]);

  const signIn = useCallback(
    async (email: string, password: string): Promise<void> => {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
    },
    [supabase],
  );

  const signInWithPassword = useCallback(
    async (credentials: {
      email: string;
      password: string;
    }): Promise<AuthTokenResponsePassword> => {
      return supabase.auth.signInWithPassword(credentials);
    },
    [supabase],
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, [supabase]);

  const { role, orgId, plan } = readClaims(session);

  const value: AuthContextValue = {
    session,
    user: session?.user ?? null,
    role,
    orgId,
    plan,
    isLoading,
    signIn,
    signInWithPassword,
    signOut,
    roleDestinations: config.roleDestinations,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

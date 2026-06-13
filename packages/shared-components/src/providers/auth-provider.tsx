import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import type { AuthResponse, Session, User } from "@supabase/supabase-js";
import { useSupabase } from "./supabase-provider";

// ─── Public interfaces ──────────────────────────────────────────────────────

export interface AuthConfig {
  /** Maps role strings to redirect paths on successful sign-in. */
  roleDestinations: Record<string, string>;
}

export interface AuthContextValue {
  session: Session | null;
  user: User | null;
  /** Role string from JWT app_metadata claims (e.g. "admin", "agent"). */
  role: string | null;
  /** Organisation ID from JWT app_metadata claims, if present. */
  orgId: string | null;
  /** Subscription plan tier from JWT app_metadata claims, if present. */
  plan: string | null;
  isLoading: boolean;
  /** @deprecated Use isLoading instead. Kept for backward compatibility. */
  loading: boolean;
  signIn: (creds: { email: string; password: string }) => Promise<AuthResponse>;
  signInWithPassword: (creds: { email: string; password: string }) => Promise<AuthResponse>;
  signOut: () => Promise<void>;
  /** The roleDestinations map passed to AuthProvider — available for consumers (e.g. LoginPage). */
  roleDestinations: Record<string, string>;
}

// ─── Context ────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Read role/orgId/plan from the ACCESS TOKEN JWT claims, not from
 * session.user.app_metadata.
 *
 * The Custom Access Token Hook injects these into the JWT at mint time.
 * supabase-js populates `session.user.app_metadata` from the stored user
 * record (provider/providers only) — NOT from the hook-injected claims.
 * So the authorization signal lives in the decoded access_token only.
 */
function readClaims(session: Session | null): {
  role: string | null;
  orgId: string | null;
  plan: string | null;
} {
  const token = session?.access_token;
  if (!token) return { role: null, orgId: null, plan: null };
  try {
    const payloadB64 = token.split(".")[1];
    const json = atob(payloadB64.replace(/-/g, "+").replace(/_/g, "/"));
    const payload = JSON.parse(json) as {
      app_metadata?: { role?: string; org_id?: string; plan?: string };
    };
    return {
      role: payload.app_metadata?.role ?? null,
      orgId: payload.app_metadata?.org_id ?? null,
      plan: payload.app_metadata?.plan ?? null,
    };
  } catch {
    return { role: null, orgId: null, plan: null };
  }
}

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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Seed session from cache
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    // Subscribe to auth state changes (sign-in, sign-out, token refresh)
    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setLoading(false);
    });

    return () => listener.subscription.unsubscribe();
  }, [supabase]);

  const signInWithPassword = useCallback(
    (creds: { email: string; password: string }): Promise<AuthResponse> =>
      supabase.auth.signInWithPassword(creds),
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
    isLoading: loading,
    loading,
    signIn: signInWithPassword,
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

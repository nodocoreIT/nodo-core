import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { useSupabase } from "./supabase-provider";

// ─── Public interfaces ──────────────────────────────────────────────────────

export interface AuthConfig {
  /** Maps role strings to redirect paths on successful sign-in. */
  roleDestinations: Record<string, string>;
}

export interface AuthContextValue {
  session: Session | null;
  user: User | null;
  /** Role string from JWT app_metadata (e.g. "medico", "admin"). */
  role: string | null;
  /** Organisation / clinic ID from JWT app_metadata, if present. */
  orgId: string | null;
  /** Subscription plan tier from JWT app_metadata, if present. */
  plan: string | null;
  loading: boolean;
  signInWithPassword: (creds: { email: string; password: string }) => Promise<void>;
  signOut: () => Promise<void>;
  /** The roleDestinations map passed to AuthProvider — available for consumers (e.g. LoginPage). */
  roleDestinations: Record<string, string>;
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
  const [loading, setLoading] = useState(true);

  // Extract role/orgId/plan from app_metadata (set by DB trigger + Edge Function).
  function extractMeta(s: Session | null) {
    const meta = s?.user?.app_metadata ?? {};
    return {
      role: (meta.role as string) ?? null,
      orgId: (meta.org_id as string) ?? null,
      plan: (meta.plan as string) ?? null,
    };
  }

  useEffect(() => {
    // Seed session from cache
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    // Subscribe to auth state changes
    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setLoading(false);
    });

    return () => listener.subscription.unsubscribe();
  }, [supabase]);

  const signInWithPassword = useCallback(
    async (creds: { email: string; password: string }) => {
      const { error } = await supabase.auth.signInWithPassword(creds);
      if (error) throw error;
    },
    [supabase],
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, [supabase]);

  const { role, orgId, plan } = extractMeta(session);

  const value: AuthContextValue = {
    session,
    user: session?.user ?? null,
    role,
    orgId,
    plan,
    loading,
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

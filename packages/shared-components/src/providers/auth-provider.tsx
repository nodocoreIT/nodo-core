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
import {
  userHasNodeAccess,
  getNodeAccessReason,
  getNodeIdentity,
  type NodeAccessReason,
  type NodeIdentity,
} from "../lib/verify-node-access";

// ─── Public interfaces ──────────────────────────────────────────────────────

export interface AuthConfig {
  /** Maps role strings to redirect paths on successful sign-in. */
  roleDestinations: Record<string, string>;
  /** When set, session is rejected unless user_has_node_access RPC returns true. */
  unitCode?: string;
  /** When set, JWT role must be one of these values (blocks cross-nodo role bleed). */
  allowedRoles?: string[];
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
   * Machine-readable access reason from `getNodeAccessReason` (fail-open to "ok").
   * "payment_overdue" means the client_unit is impago, "trial_expired" means a
   * Finanzas demo ran out — access stays allowed in both cases, but the nodo's
   * layout should gate navigation via `useBillingLockout`.
   */
  accessReason: NodeAccessReason;
  /** Convenience flag: `accessReason === "payment_overdue" || accessReason === "trial_expired"`. */
  billingLocked: boolean;
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
 * app_metadata. These are a single value shared across every nodo for a given
 * auth user (stamped by whichever nodo the user last onboarded/synced into),
 * NOT scoped to the nodo currently being accessed — used only as a fallback
 * when `config.unitCode` is unset, or when `getNodeIdentity` (imported above,
 * the authoritative per-nodo source of truth) finds no nodo-scoped membership
 * row for this user.
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
  const [accessDenied, setAccessDenied] = useState(false);
  const [accessReason, setAccessReason] = useState<NodeAccessReason>("ok");
  // Role/org/plan resolved SCOPED TO THIS NODE (see getNodeIdentity) — null
  // when there's no session, no unitCode configured, or no team-membership
  // row for this nodo (pure client_units/node_email_access customers). The
  // effective value exposed on the context falls back to the JWT claims
  // (readClaims) whenever this is null, so client-only accounts are unaffected.
  const [nodeIdentity, setNodeIdentity] = useState<NodeIdentity | null>(null);

  useEffect(() => {
    let cancelled = false;

  async function validateSession(s: Session | null) {
      if (!s) {
        if (!cancelled) {
          setAccessDenied(false);
          setAccessReason("ok");
          setNodeIdentity(null);
        }
        return;
      }

      const claims = readClaims(s);

      if (config.unitCode) {
        const allowed = await userHasNodeAccess(supabase, config.unitCode);
        if (!allowed) {
          // Read reason before sign-out — RPC needs auth.uid().
          const reason = await getNodeAccessReason(supabase, config.unitCode);
          if (!cancelled) {
            setAccessDenied(true);
            setAccessReason(reason === "ok" ? "invalid_credentials" : reason);
            setNodeIdentity(null);
            await supabase.auth.signOut({ scope: "local" });
          }
          return;
        }

        const [reason, identity] = await Promise.all([
          getNodeAccessReason(supabase, config.unitCode),
          getNodeIdentity(supabase, config.unitCode),
        ]);

        // allowedRoles gates on the NODE-SCOPED role (identity.role) when a
        // team-membership row exists for this nodo, falling back to the JWT
        // claim only for accounts with no such row (see getNodeIdentity docs).
        const effectiveRole = identity?.role ?? claims.role;
        if (
          config.allowedRoles?.length &&
          effectiveRole &&
          !config.allowedRoles.includes(effectiveRole)
        ) {
          if (!cancelled) {
            setAccessDenied(true);
            setAccessReason("ok");
            setNodeIdentity(null);
          }
          return;
        }

        if (!cancelled) {
          setAccessDenied(false);
          setAccessReason(reason);
          setNodeIdentity(identity);
        }
        return;
      }

      // No unitCode configured for this nodo — no per-nodo table to resolve
      // against, so allowedRoles (if set) can only gate on the JWT claim.
      if (
        config.allowedRoles?.length &&
        claims.role &&
        !config.allowedRoles.includes(claims.role)
      ) {
        if (!cancelled) {
          setAccessDenied(true);
          setAccessReason("ok");
          setNodeIdentity(null);
        }
        return;
      }

      if (!cancelled) {
        setAccessDenied(false);
        setAccessReason("ok");
        setNodeIdentity(null);
      }
    }

    // Seed session from cache
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setSession(data.session);
      setIsLoading(false);
      void validateSession(data.session);
    });

    // Subscribe to auth state changes
    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => {
      if (cancelled) return;
      setSession(s);
      setIsLoading(false);
      void validateSession(s);
    });

    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, [supabase, config.unitCode]);

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
    await supabase.auth.signOut({ scope: "local" });
  }, [supabase]);

  const claims = readClaims(session);
  const effectiveRole = nodeIdentity?.role ?? claims.role;
  const effectiveOrgId = nodeIdentity?.orgId ?? claims.orgId;
  const effectivePlan = nodeIdentity?.plan ?? claims.plan;
  const denied = accessDenied;
  const effectiveAccessReason: NodeAccessReason = denied ? "ok" : accessReason;

  const value: AuthContextValue = {
    session: denied ? null : session,
    user: denied ? null : session?.user ?? null,
    role: denied ? null : effectiveRole,
    orgId: denied ? null : effectiveOrgId,
    plan: denied ? null : effectivePlan,
    isLoading,
    accessReason: effectiveAccessReason,
    billingLocked:
      effectiveAccessReason === "payment_overdue" || effectiveAccessReason === "trial_expired",
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

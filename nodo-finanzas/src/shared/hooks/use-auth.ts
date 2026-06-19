import { useEffect, useState } from 'react';
import { supabase } from '@/shared/lib/supabase';
import { redirectToLandingLogin } from '@/shared/lib/auth-redirect';
import { userHasNodeAccess } from '@nodocore/shared-components';
import type { Session } from '@supabase/supabase-js';

const FINANZAS_UNIT_CODE = 'Finanzas';

export function useAuth() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [accessDenied, setAccessDenied] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function validate(s: Session | null) {
      if (!s) {
        if (!cancelled) setAccessDenied(false);
        return;
      }
      const allowed = await userHasNodeAccess(supabase, FINANZAS_UNIT_CODE);
      if (!allowed) {
        if (!cancelled) setAccessDenied(true);
        return;
      }
      if (!cancelled) setAccessDenied(false);
    }

    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setSession(data.session);
      void validate(data.session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      if (cancelled) return;
      setSession(s);
      void validate(s);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut({ scope: "local" });
    redirectToLandingLogin();
  };

  return {
    session: accessDenied ? null : session,
    user: accessDenied ? null : session?.user ?? null,
    loading: session === undefined,
    accessDenied,
    signOut,
  };
}

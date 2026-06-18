import { useEffect, useState } from 'react';
import { supabase } from '@/shared/lib/supabase';
import { redirectToLandingLogin } from '@/shared/lib/auth-redirect';
import type { Session } from '@supabase/supabase-js';

export function useAuth() {
  const [session, setSession] = useState<Session | null | undefined>(undefined); // undefined = loading

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    redirectToLandingLogin();
  };

  return { session, loading: session === undefined, signOut };
}

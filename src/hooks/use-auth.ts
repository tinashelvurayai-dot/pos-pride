import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "manager" | "cashier";

export interface AuthProfile {
  id: string;
  full_name: string;
  cashier_id: string | null;
  active: boolean;
}

export interface AuthState {
  session: Session | null;
  profile: AuthProfile | null;
  role: AppRole | null;
  loading: boolean;
}

export function useAuth(): AuthState {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadUserData(s: Session | null) {
      if (!s) {
        setProfile(null);
        setRole(null);
        setLoading(false);
        return;
      }
      try {
        const [{ data: p }, { data: r }] = await Promise.all([
          supabase.from("profiles").select("id, full_name, cashier_id, active").eq("id", s.user.id).maybeSingle(),
          supabase.from("user_roles").select("role").eq("user_id", s.user.id).maybeSingle(),
        ]);
        if (cancelled) return;
        setProfile(p as AuthProfile | null);
        setRole((r?.role as AppRole) ?? null);
      } catch {
        // Offline or transient failure - resolve loading so gated routes render.
        if (cancelled) return;
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      loadUserData(data.session);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_evt, s) => {
      setSession(s);
      setLoading(true);
      // Defer to avoid deadlock
      setTimeout(() => loadUserData(s), 0);
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { session, profile, role, loading };
}

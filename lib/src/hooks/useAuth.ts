import { useState, useEffect } from "react";
import type { SupabaseClient, Session } from "@supabase/supabase-js";
import type { Database } from "../supabase/client.js";
import type { UserRow } from "../types/index.js";
import { getProfile } from "../supabase/auth.js";

export interface UseAuthReturn {
  session: Session | null;
  profile: UserRow | null;
  loading: boolean;
}

export function useAuth(client: SupabaseClient<Database>): UseAuthReturn {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Hydrate from persisted session
    client.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session) {
        getProfile(client, data.session.user.id)
          .then(setProfile)
          .catch(() => setProfile(null))
          .finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const { data: listener } = client.auth.onAuthStateChange(
      async (_event, newSession) => {
        setSession(newSession);
        if (newSession) {
          try {
            const p = await getProfile(client, newSession.user.id);
            setProfile(p);
          } catch {
            setProfile(null);
          }
        } else {
          setProfile(null);
        }
      }
    );

    return () => listener.subscription.unsubscribe();
  }, [client]);

  return { session, profile, loading };
}

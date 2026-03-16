import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { supabase } from "./lib/supabase";
import { useAuthStore } from "./store/auth";
import { getProfile } from "@gameboxd/lib";

// Pages (placeholders — UI phase)
import FeedPage from "./pages/FeedPage";
import SearchPage from "./pages/SearchPage";
import ProfilePage from "./pages/ProfilePage";
import AuthPage from "./pages/AuthPage";

export default function App() {
  const { userId, setUserId, setProfile } = useAuthStore();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const user = data.session?.user ?? null;
      setUserId(user?.id ?? null);
      if (user) {
        getProfile(supabase, user.id)
          .then(setProfile)
          .catch(() => setProfile(null));
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        const user = session?.user ?? null;
        setUserId(user?.id ?? null);
        if (user) {
          try {
            const profile = await getProfile(supabase, user.id);
            setProfile(profile);
          } catch {
            setProfile(null);
          }
        } else {
          setProfile(null);
        }
      }
    );

    return () => listener.subscription.unsubscribe();
  }, [setUserId, setProfile]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/auth" element={<AuthPage />} />
        <Route
          path="/"
          element={userId ? <FeedPage /> : <Navigate to="/auth" replace />}
        />
        <Route
          path="/search"
          element={userId ? <SearchPage /> : <Navigate to="/auth" replace />}
        />
        <Route
          path="/profile/:userId"
          element={userId ? <ProfilePage /> : <Navigate to="/auth" replace />}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

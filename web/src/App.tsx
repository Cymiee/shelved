import { Suspense, lazy, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import type { User } from "@supabase/supabase-js";
import { supabase } from "./lib/supabase";
import { useAuthStore } from "./store/auth";
import { useNotificationsStore } from "./store/notifications";
import { ensureProfile, getProfileTags } from "@gameboxd/lib";
import Spinner from "./components/Spinner";

import Layout from "./components/Layout";
import HomePage from "./pages/HomePage";
import ErrorBoundary from "./components/ErrorBoundary";

const AuthPage = lazy(() => import("./pages/AuthPage"));
const OnboardingPage = lazy(() => import("./pages/OnboardingPage"));
const SearchPage = lazy(() => import("./pages/SearchPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const ShelfPage = lazy(() => import("./pages/ShelfPage"));
const FeedPage = lazy(() => import("./pages/FeedPage"));
const StatsPage = lazy(() => import("./pages/StatsPage"));
const FriendsPage = lazy(() => import("./pages/FriendsPage"));
const NotificationsPage = lazy(() => import("./pages/NotificationsPage"));
const GamePage = lazy(() => import("./pages/GamePage"));
const ExplorePage = lazy(() => import("./pages/ExplorePage"));
const ListPage = lazy(() => import("./pages/ListPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const WantToPlayPage = lazy(() => import("./pages/WantToPlayPage"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage"));

/** /games → /explore, preserving any ?q= search term from old links. */
function LegacyGamesRedirect() {
  const { search } = useLocation();
  return <Navigate to={`/explore${search}`} replace />;
}

/**
 * Shows the profile-setup wizard once after a user's first login, when they
 * haven't completed (or explicitly skipped) it. Fully non-blocking: it only
 * redirects a single time per session, so the user can navigate away freely and
 * finish later from Settings.
 */
function OnboardingGate() {
  const { userId, profileTags, profileTagsLoaded } = useAuthStore();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  useEffect(() => {
    if (!userId || !profileTagsLoaded) return;
    if (profileTags?.onboarding_completed) return;
    // Don't hijack these flows.
    if (pathname.startsWith("/onboarding") || pathname === "/auth") return;
    // Only auto-prompt once per browser session.
    if (sessionStorage.getItem("onboardingPrompted")) return;
    sessionStorage.setItem("onboardingPrompted", "1");
    navigate("/onboarding", { replace: false });
  }, [userId, profileTags, profileTagsLoaded, pathname, navigate]);

  return null;
}

export default function App() {
  const { userId, initialized, setUserId, setProfile, setProfileTags, setInitialized } = useAuthStore();
  const refreshNotifications = useNotificationsStore((s) => s.refresh);
  const clearNotifications = useNotificationsStore((s) => s.clear);

  useEffect(() => {
    // Which user the profile/tags/notifications were last loaded for. Token
    // refreshes re-fire the listener for the same user; reloading everything
    // then is wasted work and a flash of stale UI.
    let loadedFor: string | null = null;

    async function loadUserData(user: User) {
      const username = (user.user_metadata?.username as string | undefined)
        ?? user.email?.split("@")[0]
        ?? "user";
      try {
        setProfile(await ensureProfile(supabase, user.id, username));
      } catch {
        setProfile(null);
      } finally {
        setInitialized();
      }
      getProfileTags(supabase, user.id).then(setProfileTags).catch(() => setProfileTags(null));
      void refreshNotifications(user.id);
    }

    // One subscription handles startup (INITIAL_SESSION) and every later
    // change, so nothing is fetched twice on load.
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      const user = session?.user ?? null;
      setUserId(user?.id ?? null);

      if (!user) {
        loadedFor = null;
        setProfile(null);
        setProfileTags(null);
        clearNotifications();
        setInitialized();
        return;
      }

      if (event === "TOKEN_REFRESHED" && loadedFor === user.id) return;
      loadedFor = user.id;

      // Never await Supabase calls inside this callback: it runs while the
      // auth client holds its session lock, and a query that waits on that
      // same lock deadlocks every later request until a full reload. Deferring
      // to the next tick lets the callback return and release the lock first.
      setTimeout(() => { void loadUserData(user); }, 0);
    });

    return () => listener.subscription.unsubscribe();
  }, [setUserId, setProfile, setProfileTags, setInitialized, refreshNotifications, clearNotifications]);

  if (!initialized) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh" }}>
        <Spinner size={44} />
      </div>
    );
  }

  return (
    <ErrorBoundary>
    <BrowserRouter>
      <OnboardingGate />
      <Suspense
        fallback={
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh" }}>
            <Spinner size={44} />
          </div>
        }
      >
      <Routes>
        <Route path="/auth" element={<AuthPage />} />
        {/* Landing page for the emailed reset link. The link itself signs the
            user in; the page only needs to collect the new password. */}
        <Route path="/reset-password" element={<ResetPasswordPage />} />

        {/* Full-screen onboarding wizard (protected, no navbar). Each step is its
            own route; bare /onboarding lands on the first step. */}
        <Route
          path="/onboarding"
          element={userId ? <Navigate to="/onboarding/avatar" replace /> : <Navigate to="/auth" replace />}
        />
        <Route
          path="/onboarding/:step"
          element={userId ? <OnboardingPage /> : <Navigate to="/auth" replace />}
        />

        {/* Public — rendered with Navbar for everyone */}
        <Route element={<Layout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/explore" element={<ExplorePage />} />
          <Route path="/game/:id" element={<GamePage />} />
          <Route path="/list/:id" element={<ListPage />} />
          <Route path="/profile/:userId" element={<ProfilePage />} />
          <Route path="/search" element={<SearchPage />} />
        </Route>

        {/* Protected — redirect to /auth if not logged in */}
        <Route element={userId ? <Layout /> : <Navigate to="/auth" replace />}>
          <Route path="/shelf" element={<ShelfPage />} />
          <Route path="/feed" element={<FeedPage />} />
          <Route path="/stats" element={<StatsPage />} />
          <Route path="/friends" element={<FriendsPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/want-to-play" element={<WantToPlayPage />} />
        </Route>

        {/* Legacy redirect — keep old links and bookmarks alive */}
        <Route path="/games" element={<LegacyGamesRedirect />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </Suspense>
    </BrowserRouter>
    </ErrorBoundary>
  );
}

import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import type { UserRow, TopGameRow, GameLogRow, IGDBGame, ActivityRow, UserProfileTagsRow } from "@gameboxd/lib";
import {
  getProfile, getTopGames, getUserGameLogs, updateProfile, setTopGame,
  removeTopGame, sendFriendRequest, getUserActivity, getFriendshipStatus, getProfileTags,
} from "@gameboxd/lib";
import { supabase } from "../lib/supabase";
import { useAuthStore } from "../store/auth";
import { useToastStore } from "../store/toast";
import { getGames, searchGames } from "../lib/igdb";
import ActivityCard from "../components/ActivityCard";
import { isPresetAvatar } from "../components/Avatar";
import Spinner from "../components/Spinner";
import TasteTags from "../components/TasteTags";
import SteamShowcase from "../components/SteamShowcase";
import AvatarPickerModal from "../components/AvatarPickerModal";
import ProfileHeader from "../components/profile/ProfileHeader";
import EditProfileForm from "../components/profile/EditProfileForm";
import FavouritesPicker from "../components/profile/FavouritesPicker";
import ProfileTabs, { type ProfileTab } from "../components/profile/ProfileTabs";
import { useIsMobile } from "../hooks/useIsMobile";

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="label" style={{ marginBottom: "var(--space-4)" }}>
      {children}
    </div>
  );
}

export default function ProfilePage() {
  const { userId: paramUserId } = useParams<{ userId: string }>();
  const { userId: myUserId, profile: myProfile, setProfile, profileTags: myTags } = useAuthStore();
  const isOwn = paramUserId === myUserId;
  const isMobile = useIsMobile();
  const navigate = useNavigate();

  const showToast = useToastStore((s) => s.show);

  const [profile, setPageProfile] = useState<UserRow | null>(null);
  const [profileTags, setProfileTags] = useState<UserProfileTagsRow | null>(null);
  const [topGames, setTopGames] = useState<TopGameRow[]>([]);
  const [topGameData, setTopGameData] = useState<Map<number, IGDBGame>>(new Map());
  const [logs, setLogs] = useState<GameLogRow[]>([]);
  const [logGameData, setLogGameData] = useState<Map<number, IGDBGame>>(new Map());
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [activityGames, setActivityGames] = useState<Map<number, Pick<IGDBGame, "id" | "name" | "cover">>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ProfileTab>("logs");
  // A short preview: the shelf below is the point of the page, and a long
  // activity wall above it buries it.
  const [activityLimit, setActivityLimit] = useState(4);

  // Edit profile state
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Top game slot assignment
  const [assigningSlot, setAssigningSlot] = useState<1 | 2 | 3 | null>(null);
  const [slotSearch, setSlotSearch] = useState("");
  const [slotResults, setSlotResults] = useState<IGDBGame[]>([]);
  const [slotSearching, setSlotSearching] = useState(false);

  const [showAvatarPicker, setShowAvatarPicker] = useState(false);

  // Friend state (for other profiles)
  const [isFriend, setIsFriend] = useState(false);
  const [friendRequestSent, setFriendRequestSent] = useState(false);
  const [friendActionLoading, setFriendActionLoading] = useState(false);

  useEffect(() => {
    if (!paramUserId) return;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [prof, tops, gameLogs, tags] = await Promise.all([
          getProfile(supabase, paramUserId!),
          getTopGames(supabase, paramUserId!),
          getUserGameLogs(supabase, paramUserId!),
          getProfileTags(supabase, paramUserId!),
        ]);
        setPageProfile(prof);
        setTopGames(tops);
        setLogs(gameLogs);
        setProfileTags(tags);

        // Fetch IGDB data for top games
        if (tops.length > 0) {
          const topData = await getGames(tops.map((t) => t.game_igdb_id));
          const m = new Map<number, IGDBGame>();
          for (const g of topData) m.set(g.id, g);
          setTopGameData(m);
        }

        // Fetch IGDB data for logs (for tabs)
        if (gameLogs.length > 0) {
          // 500 is the most IGDB returns per query; spines make a shelf that
          // size comfortable to show in full.
          const logIds = [...new Set(gameLogs.map((l) => l.game_igdb_id))].slice(0, 500);
          const logData = await getGames(logIds);
          const lm = new Map<number, IGDBGame>();
          for (const g of logData) lm.set(g.id, g);
          setLogGameData(lm);
        }

        // Fetch activity
        const actRows = await getUserActivity(supabase, paramUserId!, 20);

        if (actRows.length > 0) {
          setActivities(actRows);
          const actGameIds = [...new Set(actRows.map((a) => a.game_igdb_id))];
          const actGames = await getGames(actGameIds);
          const gm = new Map<number, Pick<IGDBGame, "id" | "name" | "cover">>();
          for (const g of actGames) gm.set(g.id, g);
          setActivityGames(gm);
        }

        // Check friendship (if not own profile)
        if (!isOwn && myUserId) {
          const friendship = await getFriendshipStatus(supabase, myUserId, paramUserId!);
          setIsFriend(friendship.status === "accepted");
          setFriendRequestSent(friendship.status === "pending_sent");
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load profile");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [paramUserId, isOwn, myUserId]);

  const stats = {
    logged: logs.length,
    avgRating:
      logs.filter((l) => l.rating != null).length > 0
        ? (
            logs.filter((l) => l.rating != null).reduce((s, l) => s + (l.rating ?? 0), 0) /
            logs.filter((l) => l.rating != null).length
          ).toFixed(1)
        : null,
    reviews: logs.filter((l) => l.review).length,
  };

  const handleSaveProfile = async ({ bio, avatarUrl }: { bio: string; avatarUrl: string }) => {
    if (!myUserId || !profile) return;
    setSaving(true);
    // An empty URL box shouldn't wipe a preset chosen in Settings › Gaming.
    const trimmedAvatar = avatarUrl.trim();
    const nextAvatarUrl = trimmedAvatar || (isPresetAvatar(profile.avatar_url) ? profile.avatar_url : null);
    try {
      const updated = await updateProfile(supabase, myUserId, {
        bio: bio.trim() || null,
        avatar_url: nextAvatarUrl,
      });
      setPageProfile(updated);
      if (isOwn) setProfile(updated);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const handleSlotSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slotSearch.trim()) return;
    setSlotSearching(true);
    try {
      const res = await searchGames(slotSearch.trim());
      setSlotResults(res);
    } finally {
      setSlotSearching(false);
    }
  };

  const handleAssignSlot = async (game: IGDBGame) => {
    if (!assigningSlot || !myUserId) return;
    await setTopGame(supabase, myUserId, assigningSlot, game.id);
    const updated = await getTopGames(supabase, myUserId);
    setTopGames(updated);
    const ids = updated.map((t) => t.game_igdb_id);
    const data = await getGames(ids);
    const m = new Map<number, IGDBGame>();
    for (const g of data) m.set(g.id, g);
    setTopGameData(m);
    setAssigningSlot(null);
    setSlotSearch("");
    setSlotResults([]);
  };

  const handleRemoveSlot = async (position: 1 | 2 | 3) => {
    if (!myUserId) return;
    await removeTopGame(supabase, myUserId, position);
    setTopGames((prev) => prev.filter((g) => g.position !== position));
    setTopGameData((prev) => {
      const entry = topGames.find((g) => g.position === position);
      if (!entry) return prev;
      const m = new Map(prev);
      m.delete(entry.game_igdb_id);
      return m;
    });
  };

  const handleFriendRequest = async () => {
    if (!myUserId || !paramUserId) return;
    setFriendActionLoading(true);
    try {
      await sendFriendRequest(supabase, myUserId, paramUserId);
      setFriendRequestSent(true);
    } catch (e) {
      // A unique violation means a request already exists, which is the state we want.
      const duplicate = typeof e === "object" && e !== null && "code" in e && e.code === "23505";
      if (duplicate) setFriendRequestSent(true);
      else showToast("Couldn't send a friend request. Try again.");
    } finally {
      setFriendActionLoading(false);
    }
  };

  if (loading) return (
    <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Spinner />
    </div>
  );
  if (error) return <div style={{ padding: "2rem", color: "var(--danger)" }}>{error}</div>;
  if (!profile) return null;

  return (
    <div
      style={{
        maxWidth: 1280,
        margin: "0 auto",
        padding: isMobile ? "1.5rem 16px 3rem" : "2.5rem 24px 4rem",
        display: "grid",
        // minmax(0, 1fr): a bare 1fr track grows to fit its widest child's
        // min-content, which pushed the whole page past the viewport on phones.
        gridTemplateColumns: isMobile ? "minmax(0, 1fr)" : "280px minmax(0, 1fr)",
        gap: isMobile ? "2rem" : "3rem",
        alignItems: "start",
      }}
    >
      {/* ── Left column (stacks above content on mobile) ── */}
      <div style={isMobile ? {} : { position: "sticky", top: 76 }}>

        <ProfileHeader
          profile={profile}
          stats={stats}
          isOwn={isOwn}
          signedIn={Boolean(myUserId)}
          editing={editing}
          editForm={
            <EditProfileForm
              initialBio={profile.bio ?? ""}
              initialAvatarUrl={isPresetAvatar(profile.avatar_url) ? "" : (profile.avatar_url ?? "")}
              saving={saving}
              onSave={handleSaveProfile}
              onCancel={() => setEditing(false)}
            />
          }
          isFriend={isFriend}
          requestSent={friendRequestSent}
          friendActionLoading={friendActionLoading}
          onEditAvatar={() => setShowAvatarPicker(true)}
          onStartEdit={() => setEditing(true)}
          onAddFriend={handleFriendRequest}
        />

        <SectionLabel>Favourites</SectionLabel>
        <FavouritesPicker
          isOwn={isOwn}
          topGames={topGames}
          gameData={topGameData}
          assigningSlot={assigningSlot}
          search={slotSearch}
          results={slotResults}
          searching={slotSearching}
          onOpenGame={(id) => navigate(`/game/${id}`)}
          onStartAssign={setAssigningSlot}
          onCancelAssign={() => { setAssigningSlot(null); setSlotResults([]); setSlotSearch(""); }}
          onRemove={handleRemoveSlot}
          onSearchChange={setSlotSearch}
          onSearchSubmit={handleSlotSearch}
          onPick={handleAssignSlot}
        />

        {/* Taste — archetypes + favourite genres (plus shared-taste on others) */}
        {((profileTags?.archetypes.length ?? 0) > 0 || (profileTags?.genres.length ?? 0) > 0 || isOwn) && (
          <div style={{ marginTop: "var(--space-5)" }}>
            <SectionLabel>Taste</SectionLabel>
            <TasteTags tags={profileTags} viewerTags={myTags} isOwn={isOwn} />
          </div>
        )}

        {/* Steam library (if linked) */}
        {profile.steam_id && paramUserId && <SteamShowcase userId={paramUserId} />}
      </div>

      {/* ── Right column ── */}
      <div>

        {/* Recent Activity */}
        {activities.length > 0 && (
          <section style={{ marginBottom: "2.5rem" }}>
            <SectionLabel>Recent activity</SectionLabel>
            <div
              className="paper-wall"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 320px), 1fr))",
                gap: "var(--space-6) var(--space-5)",
                alignItems: "start",
                paddingTop: "var(--space-3)",
              }}
            >
              {activities.slice(0, activityLimit).map((activity) => {
                const game = activityGames.get(activity.game_igdb_id);
                if (!game) return null;
                return (
                  <ActivityCard
                    key={activity.id}
                    activity={activity}
                    user={profile}
                    game={game}
                    log={logs.find((l) => l.game_igdb_id === activity.game_igdb_id)}
                  />
                );
              })}
            </div>
            {activities.length > activityLimit && (
              <button
                type="button"
                className="btn-key btn-key--wall"
                onClick={() => setActivityLimit((n) => n + 20)}
                style={{ marginTop: "var(--space-5)" }}
              >
                Show more activity
              </button>
            )}
          </section>
        )}

        <ProfileTabs
          userId={paramUserId ?? ""}
          username={profile.username}
          isOwn={isOwn}
          logs={logs}
          gameData={logGameData}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />
      </div>


      {showAvatarPicker && myUserId && (
        <AvatarPickerModal
          userId={myUserId}
          currentAvatarId={profileTags?.avatar_id ?? null}
          onClose={() => setShowAvatarPicker(false)}
          onSaved={(updated, avatarId) => {
            setPageProfile(updated);
            setProfile(updated);
            setProfileTags((prev) => (prev ? { ...prev, avatar_id: avatarId } : prev));
          }}
        />
      )}
    </div>
  );
}
import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuthStore } from "../store/auth";
import { useFriendsFeed } from "../hooks/useFriendsFeed";
import FriendsActivityWall from "../components/FriendsActivityWall";
import { PageSpinner } from "../components/Spinner";

const PAGE_SIZE = 24;
const MAX_ITEMS = 120;

export default function FeedPage() {
  const userId = useAuthStore((s) => s.userId);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const { items, loading, hasMore } = useFriendsFeed(userId, limit);

  const firstLoad = loading && items.length === 0;
  const empty = !loading && items.length === 0;

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto", padding: "2.5rem clamp(16px, 3vw, 24px) 4rem" }}>
      <div style={{ marginBottom: "var(--space-6)" }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontStretch: "104%", fontSize: "clamp(2rem, 6vw, 3.25rem)", fontWeight: 900, letterSpacing: "-0.03em", lineHeight: 1 }}>Friends feed</h1>
        <p style={{ marginTop: "var(--space-2)", color: "var(--text-secondary)" }}>What your friends have been logging, rating and reviewing.</p>
      </div>

      {firstLoad && <PageSpinner />}

      {empty && (
        <div style={{ padding: "var(--space-5)", background: "var(--bg-card)", border: "1.5px dashed var(--border-strong)", borderRadius: "var(--radius-lg)" }}>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-xl)", fontWeight: 800, lineHeight: 1.2 }}>Nothing here yet</h2>
          <p style={{ color: "var(--text-secondary)", margin: "var(--space-2) 0 var(--space-4)", maxWidth: "48ch" }}>
            When your friends log, rate or review a game, it shows up here.
          </p>
          <Link className="btn-key" to="/friends">Find friends</Link>
        </div>
      )}

      {items.length > 0 && (
        <>
          <FriendsActivityWall items={items} />
          {hasMore && limit < MAX_ITEMS && (
            <div style={{ display: "flex", justifyContent: "center", marginTop: "var(--space-6)" }}>
              <button
                type="button"
                className="btn-key btn-key--wall"
                disabled={loading}
                onClick={() => setLimit((l) => Math.min(l + PAGE_SIZE, MAX_ITEMS))}
              >
                {loading ? "Loading…" : "Show more"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

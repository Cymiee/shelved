import { Link } from "react-router-dom";
import type { GameLogRow, IGDBGame } from "@gameboxd/lib";
import GameCover from "../GameCover";
import ShelfLibrary from "../ShelfLibrary";
import UserLists from "../UserLists";

export type ProfileTab = "logs" | "reviews" | "lists";

interface ProfileTabsProps {
  userId: string;
  username: string;
  isOwn: boolean;
  logs: GameLogRow[];
  gameData: Map<number, IGDBGame>;
  activeTab: ProfileTab;
  onTabChange: (tab: ProfileTab) => void;
}

const TABS: ProfileTab[] = ["logs", "reviews", "lists"];

export default function ProfileTabs({ userId, username, isOwn, logs, gameData, activeTab, onTabChange }: ProfileTabsProps) {
  const reviewLogs = logs.filter((l) => l.review);

  const labelFor = (tab: ProfileTab): string =>
    tab === "logs"
      ? `${isOwn ? "Shelf" : `${username}'s shelf`} (${logs.length})`
      : tab === "reviews"
        ? `Reviews (${reviewLogs.length})`
        : "Lists";

  return (
    <div>
      <div style={{ display: "flex", gap: "0.25rem", marginBottom: "1.5rem", borderBottom: "1px solid var(--border)", paddingBottom: 0 }}>
        {TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => onTabChange(tab)}
            style={{
              padding: "0.5rem 1.25rem",
              background: "none",
              border: "none",
              borderBottom: `2px solid ${activeTab === tab ? "var(--accent)" : "transparent"}`,
              color: activeTab === tab ? "var(--text-primary)" : "var(--text-muted)",
              cursor: "pointer",
              fontSize: "0.9rem",
              fontWeight: activeTab === tab ? 600 : 400,
              marginBottom: -1,
              fontFamily: "var(--font-display)",
              whiteSpace: "nowrap",
              transition: "color 0.15s, border-color 0.15s",
            }}
          >
            {labelFor(tab)}
          </button>
        ))}
      </div>

      {/* Shelf tab: the same library view as /shelf */}
      {activeTab === "logs" && <ShelfLibrary logs={logs} games={gameData} />}

      {activeTab === "reviews" && (
        reviewLogs.length === 0 ? (
          <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>No reviews yet.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {reviewLogs.map((log) => {
              const game = gameData.get(log.game_igdb_id);
              if (!game || !log.review) return null;
              const excerpt = log.review.length > 180
                ? log.review.slice(0, 180).trimEnd() + "…"
                : log.review;
              return (
                <Link
                  key={log.id}
                  to={`/game/${log.game_igdb_id}`}
                  style={{
                    display: "flex",
                    gap: "var(--space-4)",
                    textDecoration: "none",
                    background: "var(--bg-card)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-lg)",
                    padding: "var(--space-4)",
                    transition: "border-color var(--transition)",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--accent-ring)")}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
                >
                  <div style={{ width: 52, flexShrink: 0 }}>
                    <GameCover name={game.name} imageId={game.cover?.image_id} size="cover_small" rounding="sm" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontFamily: "var(--font-display)",
                        fontWeight: 600,
                        fontSize: "var(--text-base)",
                        color: "var(--text-primary)",
                        marginBottom: "var(--space-1)",
                      }}
                    >
                      {game.name}
                    </div>
                    {log.rating != null && (
                      <div style={{ fontSize: "var(--text-xs)", color: "var(--accent)", marginBottom: "var(--space-2)", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                        {log.rating}/10
                      </div>
                    )}
                    <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", lineHeight: 1.6, margin: 0 }}>
                      {excerpt}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        )
      )}

      {activeTab === "lists" && <UserLists userId={userId} isOwn={isOwn} />}
    </div>
  );
}

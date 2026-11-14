import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import type { ListWithGames, IGDBGame } from "@gameboxd/lib";
import {
  getListWithGames,
  updateList,
  deleteList,
  removeGameFromList,
} from "@gameboxd/lib";
import { supabase } from "../lib/supabase";
import { getGames } from "../lib/igdb";
import { useAuthStore } from "../store/auth";
import { PageSpinner } from "../components/Spinner";
import GameCover from "../components/GameCover";
import Avatar from "../components/Avatar";
import ListFormModal from "../components/ListFormModal";

export default function ListPage() {
  const { id } = useParams<{ id: string }>();
  const { userId } = useAuthStore();
  const navigate = useNavigate();

  const [list, setList] = useState<ListWithGames | null>(null);
  const [games, setGames] = useState<Map<number, IGDBGame>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showEdit, setShowEdit] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const isOwner = list != null && userId === list.user_id;

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const l = await getListWithGames(supabase, id!);
        if (cancelled) return;
        setList(l);
        if (l.games.length > 0) {
          const gameList = await getGames(l.games.map((g) => g.game_igdb_id));
          if (cancelled) return;
          setGames(new Map(gameList.map((g) => [g.id, g])));
        }
      } catch {
        if (!cancelled) setError("Couldn't load this list. Reload to try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [id]);

  const handleEdit = async (title: string, description: string | null) => {
    if (!list) return;
    const updated = await updateList(supabase, list.id, { title, description });
    setList({ ...list, ...updated });
  };

  const handleDelete = async () => {
    if (!list) return;
    setBusy(true);
    setActionError(null);
    try {
      await deleteList(supabase, list.id);
      navigate(`/profile/${list.user_id}`);
    } catch {
      setActionError("Couldn't delete this list. Try again.");
      setConfirmDelete(false);
    } finally {
      setBusy(false);
    }
  };

  const handleRemoveGame = async (gameIgdbId: number) => {
    if (!list) return;
    setBusy(true);
    setActionError(null);
    try {
      await removeGameFromList(supabase, list.id, gameIgdbId);
      setList({ ...list, games: list.games.filter((g) => g.game_igdb_id !== gameIgdbId) });
    } catch {
      setActionError("Couldn't remove that game. Try again.");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <PageSpinner />;
  if (error) {
    return (
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "2.5rem clamp(16px, 3vw, 24px) 4rem" }}>
        <p role="alert" style={{ color: "var(--danger)" }}>{error}</p>
      </div>
    );
  }
  if (!list) return null;

  const gameCount = `${list.games.length} ${list.games.length === 1 ? "game" : "games"}`;

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto", padding: "2.5rem clamp(16px, 3vw, 24px) 4rem" }}>
      <header
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: "var(--space-4)",
          marginBottom: "var(--space-6)",
        }}
      >
        <div style={{ minWidth: 0, flex: "1 1 280px" }}>
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontStretch: "104%",
              fontSize: "clamp(2rem, 6vw, 3.25rem)",
              fontWeight: 900,
              letterSpacing: "-0.03em",
              lineHeight: 1,
              overflowWrap: "anywhere",
            }}
          >
            {list.title}
          </h1>
          {list.description && (
            <p style={{ marginTop: "var(--space-2)", color: "var(--text-secondary)", maxWidth: "68ch", overflowWrap: "anywhere" }}>
              {list.description}
            </p>
          )}
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "var(--space-3)", marginTop: "var(--space-3)" }}>
            <Link
              to={`/profile/${list.user_id}`}
              style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-2)", color: "var(--text-primary)", textDecoration: "none", fontWeight: 600 }}
            >
              <Avatar username={list.user.username} avatarUrl={null} size={28} variant="solid" />
              {list.user.username}
            </Link>
            <span style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>{gameCount}</span>
          </div>
        </div>

        {isOwner && (
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "var(--space-3)" }}>
            <button type="button" className="btn-key btn-key--wall" onClick={() => setShowEdit(true)} disabled={busy}>
              Edit list
            </button>
            {!confirmDelete && (
              <button type="button" className="text-btn text-btn--danger" onClick={() => setConfirmDelete(true)} disabled={busy}>
                Delete list
              </button>
            )}
          </div>
        )}
      </header>

      {isOwner && confirmDelete && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "var(--space-3)",
            padding: "0.6rem 0.85rem",
            marginBottom: "var(--space-5)",
            background: "var(--bg-card)",
            border: "1.5px solid var(--border)",
            borderRadius: "var(--radius-lg)",
            fontSize: "var(--text-sm)",
            color: "var(--text-secondary)",
          }}
        >
          <span>Delete this list? This can't be undone.</span>
          <span style={{ display: "flex", gap: "var(--space-2)" }}>
            <button type="button" className="btn-key btn-key--wall" onClick={() => setConfirmDelete(false)} disabled={busy}>
              Keep
            </button>
            <button type="button" className="btn-key btn-key--wall" onClick={handleDelete} disabled={busy} style={{ color: "var(--danger)" }}>
              Delete
            </button>
          </span>
        </div>
      )}

      {actionError && (
        <p role="alert" style={{ color: "var(--danger)", marginBottom: "var(--space-4)" }}>{actionError}</p>
      )}

      {list.games.length === 0 ? (
        <div
          style={{
            padding: "var(--space-5)",
            background: "var(--bg-card)",
            border: "1.5px dashed var(--border-strong)",
            borderRadius: "var(--radius-lg)",
          }}
        >
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-xl)", fontWeight: 800, lineHeight: 1.2 }}>
            No games in this list yet
          </h2>
          <p style={{ margin: "var(--space-2) 0 var(--space-4)", color: "var(--text-secondary)", maxWidth: "48ch" }}>
            {isOwner
              ? "Open any game's page and choose \u201cAdd to list\u201d to put it here."
              : "Check back later, the owner hasn't added any yet."}
          </p>
          {isOwner && <Link className="btn-key" to="/explore">Explore games</Link>}
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(min(45%, 150px), 1fr))",
            gap: "var(--space-5) var(--space-4)",
          }}
        >
          {list.games.map((entry) => {
            const game = games.get(entry.game_igdb_id);
            const name = game?.name ?? "Game";
            return (
              <div key={entry.id} className="game-card">
                <div className="on-plank">
                  <GameCover
                    name={name}
                    imageId={game?.cover?.image_id}
                    interactive
                    onClick={() => navigate(`/game/${entry.game_igdb_id}`)}
                  />
                  {isOwner && (
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={() => handleRemoveGame(entry.game_igdb_id)}
                      disabled={busy}
                      aria-label={`Remove ${name} from list`}
                      style={{
                        position: "absolute",
                        top: 5,
                        right: 5,
                        // above the cover even while it is lifted on hover
                        zIndex: 6,
                        width: 28,
                        height: 28,
                        borderRadius: "50%",
                        background: "var(--bg-base)",
                        fontSize: "0.7rem",
                      }}
                    >
                      ✕
                    </button>
                  )}
                </div>
                <div
                  className="game-card-title"
                  style={{
                    paddingTop: "var(--space-2)",
                    fontFamily: "var(--font-display)",
                    fontStretch: "78%",
                    fontWeight: 700,
                    fontSize: "var(--text-sm)",
                    lineHeight: 1.2,
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                    overflowWrap: "anywhere",
                  }}
                >
                  {name}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showEdit && (
        <ListFormModal
          initial={{ title: list.title, description: list.description }}
          onClose={() => setShowEdit(false)}
          onSave={handleEdit}
        />
      )}
    </div>
  );
}

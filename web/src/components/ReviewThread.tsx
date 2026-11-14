import { useCallback, useEffect, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import { Link, useLocation } from "react-router-dom";
import { addReviewComment, deleteReviewComment, getReviewComments, REVIEW_COMMENT_MAX } from "@gameboxd/lib";
import type { ReviewCommentWithUser } from "@gameboxd/lib";
import Avatar from "./Avatar";
import { supabase } from "../lib/supabase";
import { timeAgo } from "../lib/format";
import { useAuthStore } from "../store/auth";
import { useEngagementStore } from "../store/engagement";
import { useToastStore } from "../store/toast";
import { color, space } from "../theme";

interface Props {
  logId: string;
}

type LoadState = "loading" | "error" | "ready";

/** The comments under one review, with a composer for signed-in people. */
export default function ReviewThread({ logId }: Props) {
  const userId = useAuthStore((s) => s.userId);
  const profile = useAuthStore((s) => s.profile);
  const adjustComments = useEngagementStore((s) => s.adjustComments);
  const showToast = useToastStore((s) => s.show);
  const location = useLocation();

  const [comments, setComments] = useState<ReviewCommentWithUser[]>([]);
  const [state, setState] = useState<LoadState>("loading");
  const [attempt, setAttempt] = useState(0);
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setState("loading");
      try {
        const rows = await getReviewComments(supabase, logId);
        if (cancelled) return;
        setComments(rows);
        setState("ready");
      } catch {
        if (!cancelled) setState("error");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [logId, attempt]);

  const submit = useCallback(async () => {
    const body = text.trim();
    if (!userId || !profile || !body || posting) return;
    setPosting(true);
    setPostError(null);
    try {
      const created = await addReviewComment(supabase, logId, userId, body);
      setComments((list) => [
        ...list,
        { ...created, user: { id: profile.id, username: profile.username, avatar_url: profile.avatar_url } },
      ]);
      setText("");
      adjustComments(logId, 1);
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      setPostError(
        message.includes("too fast")
          ? "You're commenting too fast. Wait a minute and try again."
          : "Couldn't post your comment. Try again."
      );
    } finally {
      setPosting(false);
    }
  }, [text, userId, profile, posting, logId, adjustComments]);

  async function remove(comment: ReviewCommentWithUser) {
    if (!userId) return;
    const index = comments.findIndex((c) => c.id === comment.id);
    setComments((list) => list.filter((c) => c.id !== comment.id));
    adjustComments(logId, -1);
    let ok = false;
    try {
      ok = await deleteReviewComment(supabase, comment.id, userId);
    } catch {
      ok = false;
    }
    if (!ok) {
      // Put it back where it was; the list may have grown meanwhile.
      setComments((list) => {
        const next = [...list];
        next.splice(Math.min(Math.max(index, 0), next.length), 0, comment);
        return next;
      });
      adjustComments(logId, 1);
      showToast("Couldn't delete that comment. Try again.");
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void submit();
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      void submit();
    }
  }

  const smallText = { fontSize: "var(--text-sm)", color: color.inkSoft } as const;
  const authPath = `/auth?from=${encodeURIComponent(location.pathname + location.search)}`;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: space[3],
        borderTop: `1px dashed ${color.inkFaint}`,
        paddingTop: space[3],
        minWidth: 0,
      }}
    >
      {state === "loading" && <p style={{ margin: 0, ...smallText }}>Loading comments…</p>}

      {state === "error" && (
        <p style={{ margin: 0, ...smallText }}>
          Couldn't load comments.{" "}
          <button type="button" className="paper-link" onClick={() => setAttempt((n) => n + 1)}>
            Try again
          </button>
        </p>
      )}

      {state === "ready" && comments.length === 0 && <p style={{ margin: 0, ...smallText }}>No comments yet.</p>}

      {state === "ready" &&
        comments.map((c) => (
          <div key={c.id} style={{ display: "flex", gap: space[3], minWidth: 0 }}>
            <Link to={`/profile/${c.user.id}`} style={{ display: "flex", flexShrink: 0, alignSelf: "flex-start" }} aria-label={c.user.username}>
              <Avatar username={c.user.username} avatarUrl={c.user.avatar_url} size={28} variant="solid" />
            </Link>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  flexWrap: "wrap",
                  columnGap: space[2],
                  fontSize: "var(--text-xs)",
                  color: color.inkSoft,
                }}
              >
                <Link
                  to={`/profile/${c.user.id}`}
                  style={{ fontWeight: 700, fontSize: "var(--text-sm)", overflowWrap: "anywhere" }}
                >
                  {c.user.username}
                </Link>
                <span>{timeAgo(c.created_at)}</span>
                {c.user_id === userId && (
                  <button
                    type="button"
                    className="paper-link"
                    onClick={() => void remove(c)}
                    // Padding grows the tap target without growing the row.
                    style={{ fontSize: "var(--text-xs)", padding: "0.6rem 0.4rem", margin: "-0.6rem 0" }}
                  >
                    Delete
                  </button>
                )}
              </div>
              <p
                style={{
                  margin: 0,
                  fontSize: "var(--text-sm)",
                  lineHeight: 1.5,
                  whiteSpace: "pre-wrap",
                  overflowWrap: "anywhere",
                }}
              >
                {c.body}
              </p>
            </div>
          </div>
        ))}

      {userId && profile ? (
        <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: space[2] }}>
          <textarea
            className="paper-field"
            rows={2}
            maxLength={REVIEW_COMMENT_MAX}
            placeholder="Add a comment"
            aria-label="Add a comment"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKeyDown}
            style={{ width: "100%", boxSizing: "border-box", padding: "0.5rem 0.65rem", resize: "vertical" }}
          />
          {postError && (
            <p role="alert" style={{ margin: 0, alignSelf: "stretch", fontSize: "var(--text-sm)", color: "#B3261E" }}>
              {postError}
            </p>
          )}
          <button type="submit" className="btn-key btn-key--sm" disabled={posting || text.trim() === ""}>
            {posting ? "Posting…" : "Post"}
          </button>
        </form>
      ) : (
        <p style={{ margin: 0, ...smallText }}>
          <Link to={authPath} style={{ fontWeight: 700 }}>
            Sign in
          </Link>{" "}
          to comment
        </p>
      )}
    </div>
  );
}

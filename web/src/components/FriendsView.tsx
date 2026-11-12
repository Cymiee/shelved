import { useState } from "react";
import { Link } from "react-router-dom";
import type { UserRow, UserProfileTagsRow } from "@gameboxd/lib";
import { ARCHETYPES, GENRE_LABELS } from "@gameboxd/lib";
import Avatar from "./Avatar";
import Spinner from "./Spinner";
import { ShelfHeader } from "./Shelf";
import { SearchIcon } from "./icons";
import { color, font, space } from "../theme";

export type Person = Pick<UserRow, "id" | "username" | "avatar_url" | "bio">;

/** How the signed-in user currently stands with someone. */
export type Relation = "none" | "friends" | "sent" | "incoming";

export interface FriendEntry {
  user: Person;
  tags?: UserProfileTagsRow | undefined;
}

interface Props {
  loading: boolean;
  friends: FriendEntry[];
  /** People who asked to be friends and are waiting on an answer. */
  incoming: Person[];
  /** People the user asked, who haven't answered yet. */
  sent: Person[];
  myTags: UserProfileTagsRow | null;

  query: string;
  onQueryChange: (value: string) => void;
  searching: boolean;
  /** null = no search has run for the current query yet. */
  results: Person[] | null;
  relationOf: (userId: string) => Relation;

  /** User ids with a request in flight; their buttons are disabled. */
  busy: ReadonlySet<string>;
  onAdd: (person: Person) => void;
  onAccept: (userId: string) => void;
  onDecline: (userId: string) => void;
  onCancelRequest: (userId: string) => void;
  onRemove: (userId: string) => void;
  onCopyProfileLink: () => void;
}

const ARCH_BY_ID = new Map<string, (typeof ARCHETYPES)[number]>(ARCHETYPES.map((a) => [a.id, a]));
const genreLabel = (g: string) => GENRE_LABELS[g as keyof typeof GENRE_LABELS] ?? g;

const cardStyle: React.CSSProperties = {
  background: color.bgCard,
  border: `1.5px solid ${color.border}`,
  borderRadius: "var(--radius-lg)",
};

/**
 * The Friends page, as a pure view: everything it shows and every action it
 * offers comes in through props, so the page container owns the data and this
 * file owns the layout.
 *
 * Three jobs, in the order people need them: find someone, answer requests,
 * see your friends.
 */
export default function FriendsView(props: Props) {
  const { loading, friends, incoming, sent, query, onQueryChange, searching, results } = props;
  const term = query.trim();

  const summary = loading
    ? null
    : friends.length === 0
      ? "No friends yet"
      : `${friends.length} ${friends.length === 1 ? "friend" : "friends"}` +
        (incoming.length > 0 ? `, ${incoming.length} ${incoming.length === 1 ? "request" : "requests"} waiting` : "");

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto", padding: "2.5rem clamp(16px, 3vw, 24px) 4rem" }}>
      <header
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: space[4],
          marginBottom: space[5],
        }}
      >
        <div>
          <h1
            style={{
              fontFamily: font.display,
              fontStretch: "104%",
              fontSize: "clamp(2rem, 6vw, 3.25rem)",
              fontWeight: 900,
              letterSpacing: "-0.03em",
              lineHeight: 1,
            }}
          >
            Friends
          </h1>
          {summary && <p style={{ marginTop: space[2], color: color.textSecondary }}>{summary}</p>}
        </div>
        <button type="button" className="btn-key btn-key--wall" onClick={props.onCopyProfileLink}>
          Copy my profile link
        </button>
      </header>

      {/* ── Find people ── */}
      <section style={{ marginBottom: space[7] }}>
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: space[3],
            maxWidth: 520,
            padding: "0 0.9rem",
            background: "var(--bg-inset)",
            border: `1.5px solid ${color.borderStrong}`,
            borderRadius: "var(--radius-md)",
          }}
        >
          <SearchIcon size={18} color="var(--text-muted)" />
          <input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Find people by username"
            aria-label="Find people by username"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            style={{
              flex: 1,
              minWidth: 0,
              padding: "0.75rem 0",
              background: "none",
              border: 0,
              outline: "none",
              color: color.text,
              fontFamily: font.body,
              fontSize: "var(--text-base)",
            }}
          />
          {searching && <Spinner size={16} />}
        </label>

        {term.length >= 2 && results !== null && (
          <div style={{ maxWidth: 520, marginTop: space[3], display: "flex", flexDirection: "column", gap: space[2] }}>
            {results.length === 0 && !searching ? (
              <p style={{ color: color.textMuted, fontSize: "var(--text-sm)" }}>
                No one called &ldquo;{term}&rdquo;. Check the spelling of their username.
              </p>
            ) : (
              results.map((person) => (
                <PersonRow key={person.id} person={person} subtitle={person.bio}>
                  <RelationAction person={person} {...props} />
                </PersonRow>
              ))
            )}
          </div>
        )}
      </section>

      {loading ? (
        <div
          aria-busy="true"
          aria-label="Loading friends"
          style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 300px), 1fr))", gap: space[3] }}
        >
          {Array.from({ length: 6 }, (_, i) => (
            <div
              key={i}
              style={{ ...cardStyle, height: 74, animation: "skeletonPulse 1.5s ease-in-out infinite", animationDelay: `${i * 80}ms` }}
            />
          ))}
        </div>
      ) : (
        <>
          {/* ── Requests waiting on you — notes from people, so they're on paper ── */}
          {incoming.length > 0 && (
            <section style={{ marginBottom: space[7] }}>
              <ShelfHeader title="Requests" count={incoming.length} accent="var(--sticker-pink)" />
              <div
                className="paper-wall"
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 300px), 1fr))",
                  gap: `${space[6]} ${space[5]}`,
                  paddingTop: space[3],
                }}
              >
                {incoming.map((person) => (
                  <article
                    key={person.id}
                    className="paper"
                    style={{ padding: `${space[5]} ${space[4]} ${space[4]}`, display: "flex", flexDirection: "column", gap: space[3] }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: space[3], minWidth: 0 }}>
                      <Link to={`/profile/${person.id}`} style={{ display: "flex", flexShrink: 0 }} aria-label={person.username}>
                        <Avatar username={person.username} avatarUrl={person.avatar_url} size={40} variant="solid" />
                      </Link>
                      <p style={{ minWidth: 0, lineHeight: 1.35, overflowWrap: "anywhere" }}>
                        <Link to={`/profile/${person.id}`} style={{ fontWeight: 700 }}>{person.username}</Link>{" "}
                        <span style={{ color: color.inkSoft }}>wants to be friends</span>
                      </p>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: space[4] }}>
                      <button
                        type="button"
                        className="btn-key"
                        disabled={props.busy.has(person.id)}
                        onClick={() => props.onAccept(person.id)}
                      >
                        Accept
                      </button>
                      <button
                        type="button"
                        className="paper-link"
                        disabled={props.busy.has(person.id)}
                        onClick={() => props.onDecline(person.id)}
                      >
                        Decline
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}

          {/* ── Friends ── */}
          <section style={{ marginBottom: space[7] }}>
            <ShelfHeader title="Your friends" {...(friends.length > 0 ? { count: friends.length } : {})} />
            {friends.length === 0 ? (
              <div style={{ ...cardStyle, borderStyle: "dashed", borderColor: color.borderStrong, padding: space[5] }}>
                <h2 style={{ fontFamily: font.display, fontSize: "var(--text-xl)", fontWeight: 800, lineHeight: 1.2 }}>
                  It&rsquo;s quiet in here
                </h2>
                <p style={{ margin: `${space[2]} 0 0`, color: color.textSecondary, maxWidth: "50ch" }}>
                  Search for someone by username above, or copy your profile link and send it to a friend so they can add you.
                </p>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 300px), 1fr))", gap: space[3] }}>
                {friends.map((entry) => (
                  <FriendCard
                    key={entry.user.id}
                    entry={entry}
                    myTags={props.myTags}
                    busy={props.busy.has(entry.user.id)}
                    onRemove={() => props.onRemove(entry.user.id)}
                  />
                ))}
              </div>
            )}
          </section>

          {/* ── Requests you sent ── */}
          {sent.length > 0 && (
            <section>
              <ShelfHeader title="Waiting for an answer" count={sent.length} accent="var(--sticker-lilac)" />
              <div style={{ maxWidth: 520, display: "flex", flexDirection: "column", gap: space[2] }}>
                {sent.map((person) => (
                  <PersonRow key={person.id} person={person} subtitle="Request sent">
                    <button
                      type="button"
                      className="btn-key btn-key--wall"
                      disabled={props.busy.has(person.id)}
                      onClick={() => props.onCancelRequest(person.id)}
                    >
                      Cancel
                    </button>
                  </PersonRow>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

// ── Pieces ───────────────────────────────────────────────────────────────────

/** One person on a line: face, name, a line of context, and an action on the right. */
function PersonRow({ person, subtitle, children }: { person: Person; subtitle: string | null; children: React.ReactNode }) {
  return (
    <div style={{ ...cardStyle, display: "flex", alignItems: "center", gap: space[3], padding: "0.6rem 0.75rem", minWidth: 0 }}>
      <Link to={`/profile/${person.id}`} style={{ display: "flex", flexShrink: 0 }} aria-label={person.username}>
        <Avatar username={person.username} avatarUrl={person.avatar_url} size={38} variant="solid" />
      </Link>
      <div style={{ flex: 1, minWidth: 0 }}>
        <Link
          to={`/profile/${person.id}`}
          style={{
            display: "block",
            color: color.text,
            fontWeight: 700,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {person.username}
        </Link>
        {subtitle && (
          <p style={{ fontSize: "var(--text-xs)", color: color.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {subtitle}
          </p>
        )}
      </div>
      <div style={{ flexShrink: 0 }}>{children}</div>
    </div>
  );
}

/** The right button for a search result, given how you already stand with them. */
function RelationAction({ person, relationOf, busy, onAdd, onAccept, onCancelRequest }: Props & { person: Person }) {
  const disabled = busy.has(person.id);
  switch (relationOf(person.id)) {
    case "friends":
      return <span style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: "var(--status-completed)" }}>Friends</span>;
    case "incoming":
      return (
        <button type="button" className="btn-key" disabled={disabled} onClick={() => onAccept(person.id)}>
          Accept
        </button>
      );
    case "sent":
      return (
        <button type="button" className="btn-key btn-key--wall" disabled={disabled} onClick={() => onCancelRequest(person.id)}>
          Cancel request
        </button>
      );
    default:
      return (
        <button type="button" className="btn-key" disabled={disabled} onClick={() => onAdd(person)}>
          Add friend
        </button>
      );
  }
}

function FriendCard({
  entry,
  myTags,
  busy,
  onRemove,
}: {
  entry: FriendEntry;
  myTags: UserProfileTagsRow | null;
  busy: boolean;
  onRemove: () => void;
}) {
  const [managing, setManaging] = useState(false);
  const { user, tags } = entry;

  return (
    <div style={{ ...cardStyle, minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: space[2], padding: "0.7rem 0.6rem 0.7rem 0.85rem" }}>
        <Link
          to={`/profile/${user.id}`}
          style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: space[3], color: "inherit", textDecoration: "none" }}
        >
          <Avatar username={user.username} avatarUrl={user.avatar_url} size={46} variant="solid" />
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontFamily: font.display,
                fontWeight: 800,
                fontSize: "var(--text-lg)",
                lineHeight: 1.15,
                color: color.text,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {user.username}
            </div>
            <FriendVibe tags={tags} myTags={myTags} bio={user.bio} />
          </div>
        </Link>
        <button
          type="button"
          className="icon-btn"
          aria-label={`Manage ${user.username}`}
          aria-expanded={managing}
          onClick={() => setManaging((v) => !v)}
          style={{ width: 36, height: 36, border: 0 }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <circle cx="5" cy="12" r="1.9" />
            <circle cx="12" cy="12" r="1.9" />
            <circle cx="19" cy="12" r="1.9" />
          </svg>
        </button>
      </div>

      {managing && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: space[3],
            padding: "0.6rem 0.85rem",
            borderTop: `1px solid ${color.border}`,
            fontSize: "var(--text-sm)",
            color: color.textSecondary,
          }}
        >
          <span>Remove {user.username} from your friends?</span>
          <span style={{ display: "flex", gap: space[2] }}>
            <button type="button" className="btn-key btn-key--wall" onClick={() => setManaging(false)}>
              Keep
            </button>
            <button
              type="button"
              className="btn-key btn-key--wall"
              disabled={busy}
              onClick={onRemove}
              style={{ color: "var(--danger)" }}
            >
              Remove
            </button>
          </span>
        </div>
      )}
    </div>
  );
}

/** A friend's taste at a glance: top archetype, a couple of genres, and how much you share. */
function FriendVibe({
  tags,
  myTags,
  bio,
}: {
  tags: UserProfileTagsRow | undefined;
  myTags: UserProfileTagsRow | null;
  bio: string | null;
}) {
  const arch = tags?.archetypes[0] ? ARCH_BY_ID.get(tags.archetypes[0]) : undefined;
  const genres = (tags?.genres ?? []).slice(0, 2);
  const shared = myTags && tags
    ? tags.genres.filter((g) => myTags.genres.includes(g)).length +
      tags.archetypes.filter((a) => myTags.archetypes.includes(a)).length
    : 0;

  if (!arch && genres.length === 0) {
    return bio ? (
      <p style={{ fontSize: "var(--text-xs)", color: color.textMuted, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {bio}
      </p>
    ) : null;
  }

  const chip: React.CSSProperties = {
    padding: "1px 7px",
    borderRadius: 4,
    fontSize: "0.6875rem",
    fontWeight: 600,
    lineHeight: 1.5,
    whiteSpace: "nowrap",
  };

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 5, alignItems: "center" }}>
      {shared > 0 && (
        <span style={{ ...chip, background: color.accent, color: color.onAccent, fontWeight: 800 }}>
          {shared} in common
        </span>
      )}
      {arch && (
        <span style={{ ...chip, background: "var(--bg-inset)", border: `1px solid ${color.borderStrong}`, color: color.text }}>
          {arch.emoji} {arch.label}
        </span>
      )}
      {genres.map((g) => (
        <span key={g} style={{ ...chip, border: `1px solid ${color.border}`, color: color.textSecondary }}>
          {genreLabel(g)}
        </span>
      ))}
    </div>
  );
}

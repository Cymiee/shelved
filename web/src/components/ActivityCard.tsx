import type { ActivityRow, UserRow, IGDBGame, GameLogRow, GameStatus } from "@gameboxd/lib";
import PaperPost from "./PaperPost";
import { STATUS_META } from "../theme";
import { timeAgo } from "../lib/format";

interface Props {
  activity: ActivityRow;
  user: Pick<UserRow, "id" | "username" | "avatar_url">;
  game: Pick<IGDBGame, "id" | "name" | "cover">;
  /**
   * The user's current log for this game, when the caller has it. Rating and
   * review then reflect the latest edit rather than the moment the activity
   * was written. Falls back to the activity's own metadata.
   */
  log?: Pick<GameLogRow, "status" | "rating" | "review"> | undefined;
  /** Characters of review shown before the "Read more" fold. */
  excerptLength?: number;
}

/** What the person did, phrased the way a friend would say it. */
function verb(activity: ActivityRow, status: GameStatus | null): string {
  switch (activity.type) {
    case "reviewed": return "reviewed";
    case "rated":    return "rated";
    case "topped":   return "added to their favourites";
    default:
      switch (status) {
        case "completed":    return "finished";
        case "played":       return "played";
        case "dropped":      return "dropped";
        case "playing":      return "started playing";
        case "want_to_play": return "wants to play";
        default:             return "logged";
      }
  }
}

function isStatus(value: unknown): value is GameStatus {
  return typeof value === "string" && value in STATUS_META;
}

/**
 * One item in the activity feed. Shares its layout with ReviewCard (both are
 * a PaperPost) so the feed and the review lists read as one system.
 */
export default function ActivityCard({ activity, user, game, log, excerptLength = 200 }: Props) {
  const meta = activity.metadata;

  const status: GameStatus | null = log?.status ?? (isStatus(meta.status) ? meta.status : null);
  const rating: number | null =
    log?.rating ?? (typeof meta.rating === "number" ? meta.rating : null);
  const review: string | null =
    activity.type === "topped" ? null : (log?.review ?? (typeof meta.review === "string" ? meta.review : null)) || null;

  return (
    <PaperPost
      user={user}
      verb={verb(activity, status)}
      time={timeAgo(activity.created_at)}
      rating={rating}
      game={game}
      status={activity.type === "topped" ? null : status}
      body={review}
      excerptLength={excerptLength}
    />
  );
}

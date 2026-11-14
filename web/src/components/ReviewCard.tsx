import type { ReviewWithUser, IGDBGame } from "@gameboxd/lib";
import PaperPost from "./PaperPost";
import { timeAgo } from "../lib/format";

interface Props {
  review: ReviewWithUser;
  /** The game being reviewed. Omit when the card sits on that game's own page. */
  game?: Pick<IGDBGame, "id" | "name" | "cover"> | undefined;
  /** Characters shown before the "Read more" fold. */
  excerptLength?: number;
}

/**
 * A review as a paper card on the wall: who wrote it, what they played, their
 * words. Used on Home (community feed) and GamePage (per-game reviews).
 */
export default function ReviewCard({ review, game, excerptLength = 220 }: Props) {
  return (
    <PaperPost
      user={review.user}
      time={timeAgo(review.updated_at)}
      rating={review.rating}
      game={game}
      status={review.status}
      body={review.review}
      excerptLength={excerptLength}
      logId={review.id}
      ownerId={review.user_id}
    />
  );
}

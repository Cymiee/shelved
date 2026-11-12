import ActivityCard from "./ActivityCard";
import type { FeedItem } from "../hooks/useFriendsFeed";
import { space } from "../theme";

interface FriendsActivityWallProps {
  items: FeedItem[];
}

/**
 * Recent friend activity as posts. A wrapping grid rather than a scroll row:
 * a feed is read down, not sideways, and each card now carries the review.
 */
export default function FriendsActivityWall({ items }: FriendsActivityWallProps) {
  return (
    <div
      className="paper-wall"
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 340px), 1fr))",
        gap: `${space[6]} ${space[5]}`,
        alignItems: "start",
        // room for the tape and the corner sticker that overhang each card
        paddingTop: space[3],
      }}
    >
      {items.map((item) => (
        <ActivityCard
          key={item.activity.id}
          activity={item.activity}
          user={item.user}
          game={item.game}
          log={item.log}
        />
      ))}
    </div>
  );
}

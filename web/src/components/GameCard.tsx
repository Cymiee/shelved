import type { IGDBGame } from "@gameboxd/lib";
import GameCover from "./GameCover";
import { PlusIcon } from "./icons";
import { color, font, space } from "../theme";

interface Props {
  game: IGDBGame;
  onSelect?: (game: IGDBGame) => void;
  onQuickLog?: (game: IGDBGame) => void;
}

/**
 * A game as it sits in the shop: the case standing on the shelf plank, with
 * its name on the shelf-edge label underneath.
 */
export default function GameCard({ game, onSelect, onQuickLog }: Props) {
  const year = game.first_release_date
    ? new Date(game.first_release_date * 1000).getFullYear()
    : null;

  return (
    <div className="game-card">
      <div className="on-plank">
        <GameCover
          name={game.name}
          imageId={game.cover?.image_id}
          interactive
          {...(onSelect ? { onClick: () => onSelect(game) } : {})}
          {...(onQuickLog
            ? {
                badge: (
                  <button
                    type="button"
                    className="quick-log"
                    aria-label={`Log ${game.name}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onQuickLog(game);
                    }}
                    onKeyDown={(e) => e.stopPropagation()}
                  >
                    <PlusIcon size={18} />
                  </button>
                ),
              }
            : {})}
        />
      </div>

      <div style={{ paddingTop: space[2] }}>
        <div
          className="game-card-title"
          style={{
            fontFamily: font.display,
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
          {game.name}
        </div>
        {year && (
          <div
            style={{
              fontSize: "var(--text-xs)",
              color: color.textMuted,
              marginTop: 2,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {year}
          </div>
        )}
      </div>
    </div>
  );
}

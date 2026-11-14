import { useEffect, useRef, useState } from "react";
import type { IGDBGame } from "@gameboxd/lib";
import { ShelfHeader, shelfRowStyle } from "./Shelf";
import { CloseIcon } from "./icons";
import { space } from "../theme";

interface Props {
  game: IGDBGame;
}

const MAX_IMAGES = 12;
const imageUrl = (id: string, size: "screenshot_med" | "1080p") =>
  `https://images.igdb.com/igdb/image/upload/t_${size}/${id}.jpg`;

/**
 * The game's screenshots (then key art) as a scrolling strip; tapping one
 * opens it full screen, with previous/next and the arrow keys.
 */
export default function GameGallery({ game }: Props) {
  const ids = [...new Set([...(game.screenshots ?? []), ...(game.artworks ?? [])].map((i) => i.image_id))].slice(0, MAX_IMAGES);
  const [open, setOpen] = useState<number | null>(null);
  const opener = useRef<HTMLButtonElement | null>(null);

  if (ids.length === 0) return null;

  const close = () => {
    setOpen(null);
    opener.current?.focus();
  };

  return (
    <section style={{ marginTop: space[8] }}>
      <ShelfHeader title="Screenshots" count={ids.length} />
      <div className="no-scrollbar" style={shelfRowStyle}>
        {ids.map((id, i) => (
          <button
            key={id}
            type="button"
            className="press"
            aria-label={`View screenshot ${i + 1} of ${ids.length}`}
            onClick={(e) => {
              opener.current = e.currentTarget;
              setOpen(i);
            }}
            style={{
              flex: "0 0 clamp(220px, 60vw, 340px)",
              aspectRatio: "16 / 9",
              padding: 0,
              border: 0,
              borderRadius: "var(--radius-md)",
              overflow: "hidden",
              background: "var(--bg-card)",
              cursor: "zoom-in",
              scrollSnapAlign: "start",
              boxShadow: "var(--shadow-card)",
            }}
          >
            <img
              src={imageUrl(id, "screenshot_med")}
              alt=""
              loading="lazy"
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            />
          </button>
        ))}
      </div>

      {open !== null && (
        <Lightbox
          name={game.name}
          ids={ids}
          index={open}
          onIndex={setOpen}
          onClose={close}
        />
      )}
    </section>
  );
}

interface LightboxProps {
  name: string;
  ids: string[];
  index: number;
  onIndex: (index: number) => void;
  onClose: () => void;
}

function Lightbox({ name, ids, index, onIndex, onClose }: LightboxProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const id = ids[index];
  const step = (by: number) => onIndex((index + by + ids.length) % ids.length);

  useEffect(() => {
    closeRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") step(1);
      else if (e.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!id) return null;

  const navButton = (label: string, by: number, side: "left" | "right") => (
    <button
      type="button"
      className="icon-btn"
      aria-label={label}
      onClick={(e) => { e.stopPropagation(); step(by); }}
      style={{
        position: "absolute",
        top: "50%",
        [side]: 12,
        transform: "translateY(-50%)",
        width: 48,
        height: 48,
        background: "rgba(4, 7, 26, 0.7)",
        borderColor: "rgba(255, 255, 255, 0.35)",
        color: "#fff",
      }}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d={by > 0 ? "m9 5 7 7-7 7" : "m15 5-7 7 7 7"} stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${name}, screenshot ${index + 1} of ${ids.length}`}
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 400,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "56px 12px",
        background: "rgba(4, 7, 26, 0.92)",
      }}
    >
      <img
        src={imageUrl(id, "1080p")}
        alt={`${name}, screenshot ${index + 1} of ${ids.length}`}
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", borderRadius: "var(--radius-md)", boxShadow: "var(--shadow-modal)" }}
      />

      <button
        ref={closeRef}
        type="button"
        className="icon-btn"
        aria-label="Close"
        onClick={onClose}
        style={{ position: "absolute", top: 12, right: 12, background: "rgba(4, 7, 26, 0.7)", borderColor: "rgba(255, 255, 255, 0.35)", color: "#fff" }}
      >
        <CloseIcon size={18} />
      </button>
      <span
        aria-hidden
        style={{ position: "absolute", top: 22, left: 16, color: "rgba(255,255,255,0.8)", fontSize: "var(--text-sm)", fontVariantNumeric: "tabular-nums" }}
      >
        {index + 1} of {ids.length}
      </span>

      {ids.length > 1 && navButton("Previous screenshot", -1, "left")}
      {ids.length > 1 && navButton("Next screenshot", 1, "right")}
    </div>
  );
}

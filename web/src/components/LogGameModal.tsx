import { useEffect, useState } from "react";
import type { IGDBGame, GameLogRow, GameStatus } from "@gameboxd/lib";
import GameCover from "./GameCover";
import RatingSticker from "./Sticker";
import { useIsMobile } from "../hooks/useIsMobile";
import { STATUS_META, STATUS_ORDER } from "../theme";

interface Props {
  game: IGDBGame;
  existingLog?: GameLogRow;
  onClose: () => void;
  onSave: (status: GameStatus, rating?: number | null, review?: string | null, playtimeMin?: number | null) => Promise<void>;
}

export default function LogGameModal({ game, existingLog, onClose, onSave }: Props) {
  const isMobile = useIsMobile();
  const [status, setStatus] = useState<GameStatus>(existingLog?.status ?? "playing");
  const [rating, setRating] = useState<number | null>(existingLog?.rating ?? null);
  const [review, setReview] = useState(existingLog?.review ?? "");
  const [hours, setHours] = useState(
    existingLog?.playtime_min != null ? String(+(existingLog.playtime_min / 60).toFixed(1)) : ""
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Track whether the user picked a status themselves, so we only auto-assume.
  const [statusTouched, setStatusTouched] = useState(false);
  // Only write hours if the user actually changed the field (preserves exact
  // Steam minutes when they don't touch it).
  const [hoursTouched, setHoursTouched] = useState(false);

  // Escape closes
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const pickStatus = (value: GameStatus) => {
    setStatus(value);
    setStatusTouched(true);
  };

  const pickRating = (n: number) => {
    const next = rating === n ? null : n;
    setRating(next);
    // Rating a game implies you've played it — assume "completed" so users
    // back-logging past games don't have to set status every time. Only when
    // logging fresh and the user hasn't chosen a status themselves.
    if (next != null && !statusTouched && !existingLog) {
      setStatus("completed");
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    // Convert the hours field to minutes only if the user edited it.
    let playtimeMin: number | null | undefined = undefined;
    if (hoursTouched) {
      const t = hours.trim();
      if (t === "") playtimeMin = null;
      else {
        const h = parseFloat(t);
        playtimeMin = Number.isFinite(h) ? Math.max(0, Math.round(h * 60)) : undefined;
      }
    }
    try {
      await onSave(status, rating, review.trim() || null, playtimeMin);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save your log. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(4, 7, 26, 0.78)",
        display: "flex",
        // A bottom sheet on phones: every control lands within thumb reach
        alignItems: isMobile ? "flex-end" : "center",
        justifyContent: "center",
        padding: isMobile ? 0 : "1rem",
        zIndex: 300,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={existingLog ? `Update your log for ${game.name}` : `Log ${game.name}`}
        className={isMobile ? undefined : "reveal-pop"}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--bg-card)",
          border: "1.5px solid var(--border-strong)",
          borderRadius: isMobile ? "var(--radius-lg) var(--radius-lg) 0 0" : "var(--radius-lg)",
          ...(isMobile ? { borderBottom: 0, animation: "sheetUp 280ms var(--ease-out) both" } : {}),
          padding: isMobile ? "1.25rem 16px calc(1.25rem + env(safe-area-inset-bottom))" : "1.5rem",
          width: isMobile ? "100%" : "min(500px, 100%)",
          maxHeight: "92dvh",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: "1.25rem",
          boxShadow: "var(--shadow-modal)",
        }}
      >
        {/* Header — the case, with your rating stuck on it as you choose */}
        <div style={{ display: "flex", gap: "var(--space-4)", alignItems: "center" }}>
          <div style={{ width: 64, flexShrink: 0 }}>
            <GameCover
              name={game.name}
              imageId={game.cover?.image_id}
              size="cover_small"
              rounding="md"
              {...(rating != null
                ? {
                    badge: (
                      <RatingSticker
                        // Re-keyed per value so the slap replays on every change
                        key={rating}
                        rating={rating}
                        size={34}
                        tilt={10}
                        slap
                        style={{ position: "absolute", top: -10, right: -12 }}
                      />
                    ),
                  }
                : {})}
            />
          </div>
          <div style={{ minWidth: 0 }}>
            <h2
              style={{
                fontSize: "var(--text-xl)",
                fontWeight: 800,
                fontFamily: "var(--font-display)",
                lineHeight: 1.15,
                overflowWrap: "anywhere",
              }}
            >
              {game.name}
            </h2>
            <p style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)", marginTop: 4 }}>
              {existingLog ? "Update your log" : "Add it to your shelf"}
            </p>
          </div>
        </div>

        {/* Status — each one is its own sticker colour */}
        <div>
          <div className="label" id="log-status-label" style={{ marginBottom: "var(--space-2)" }}>
            Status
          </div>
          <div role="group" aria-labelledby="log-status-label" style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
            {STATUS_ORDER.map((value) => {
              const meta = STATUS_META[value];
              const active = status === value;
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => pickStatus(value)}
                  style={{
                    padding: "0.45rem 0.9rem",
                    borderRadius: "var(--radius-sm)",
                    border: `1.5px solid ${active ? meta.color : "var(--border-strong)"}`,
                    background: active ? meta.color : "transparent",
                    color: active ? "var(--ink)" : "var(--text-secondary)",
                    cursor: "pointer",
                    fontFamily: "var(--font-display)",
                    fontSize: "var(--text-sm)",
                    fontWeight: active ? 800 : 600,
                    transition: "background var(--transition), border-color var(--transition), color var(--transition)",
                  }}
                >
                  {meta.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Rating — ten dots; the chosen one becomes the sticker */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "var(--space-2)" }}>
            <span className="label" id="log-rating-label">Rating</span>
            <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", fontVariantNumeric: "tabular-nums" }}>
              {rating ? `${rating} out of 10` : "Not rated"}
            </span>
          </div>
          <div
            role="group"
            aria-labelledby="log-rating-label"
            style={{ display: "grid", gridTemplateColumns: "repeat(10, minmax(0, 1fr))", gap: 5 }}
          >
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
              const active = rating === n;
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => pickRating(n)}
                  aria-label={`Rate ${n} out of 10`}
                  aria-pressed={active}
                  style={{
                    aspectRatio: "1",
                    minHeight: 30,
                    borderRadius: "50%",
                    border: `1.5px solid ${active ? "var(--accent)" : "var(--border-strong)"}`,
                    background: active ? "var(--accent)" : "var(--bg-inset)",
                    color: active ? "var(--on-accent)" : "var(--text-secondary)",
                    cursor: "pointer",
                    fontFamily: "var(--font-display)",
                    fontWeight: active ? 900 : 700,
                    fontSize: "var(--text-sm)",
                    fontVariantNumeric: "tabular-nums",
                    padding: 0,
                    transform: active ? "rotate(-8deg) scale(1.12)" : "none",
                    boxShadow: active ? "0 2px 0 var(--accent-edge)" : "none",
                    transition: "transform var(--transition), background var(--transition), border-color var(--transition)",
                  }}
                >
                  {n}
                </button>
              );
            })}
          </div>
        </div>

        {/* Hours played */}
        <div>
          <label className="label" htmlFor="log-hours" style={{ display: "block", marginBottom: "var(--space-2)" }}>
            Hours played
          </label>
          <input
            id="log-hours"
            className="field"
            type="number"
            inputMode="decimal"
            min={0}
            step={0.5}
            value={hours}
            onChange={(e) => { setHours(e.target.value); setHoursTouched(true); }}
            placeholder="42"
            style={{ width: 140, padding: "0.5rem 0.75rem", fontVariantNumeric: "tabular-nums" }}
          />
          {existingLog?.playtime_min != null && !existingLog.playtime_manual && (
            <p style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", margin: "0.4rem 0 0" }}>
              Imported from Steam. Edit to include other platforms.
            </p>
          )}
        </div>

        {/* Review */}
        <div>
          <label className="label" htmlFor="log-review" style={{ display: "block", marginBottom: "var(--space-2)" }}>
            Review
          </label>
          <textarea
            id="log-review"
            className="field"
            value={review}
            onChange={(e) => setReview(e.target.value)}
            placeholder="What did you think?"
            rows={4}
            style={{ width: "100%", padding: "var(--space-3)", resize: "vertical", lineHeight: 1.6 }}
          />
        </div>

        {error && <p role="alert" style={{ color: "var(--danger)", fontSize: "var(--text-sm)" }}>{error}</p>}

        {/* Actions */}
        <div style={{ display: "flex", gap: "var(--space-3)", justifyContent: "flex-end", paddingBottom: 4 }}>
          <button type="button" className="btn-key btn-key--wall" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn-key" onClick={handleSave} disabled={saving} style={isMobile ? { flex: 1 } : {}}>
            {saving ? "Saving…" : existingLog ? "Save changes" : "Log game"}
          </button>
        </div>
      </div>
    </div>
  );
}

import type { ShelfStats } from "./stats";
import { formatHoursTotal } from "./format";

/**
 * Draws a shelf's stats receipt as a PNG for sharing: 1080 wide and at least
 * 1350 tall (the portrait size social apps crop least), taller if the receipt
 * needs it. It is drawn directly onto a canvas rather than
 * screenshotted from the page: no library, nothing cross-origin, so the canvas
 * can always be exported. Colours come from the design tokens at draw time.
 */

const WIDTH = 1080;
const MIN_HEIGHT = 1350;
const MARGIN = 72;
const PAPER_W = 760;
const PAD = 52;
const DOT_GRID = 28;
const TEETH = 22;

interface Palette {
  wall: string;
  paper: string;
  ink: string;
  inkSoft: string;
  inkFaint: string;
  accent: string;
  onAccent: string;
  accentEdge: string;
  textMuted: string;
}

function readPalette(): Palette {
  const css = getComputedStyle(document.documentElement);
  const token = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
  return {
    wall: token("--bg-base", "#101737"),
    paper: token("--paper", "#FBF6E3"),
    ink: token("--ink", "#161B3D"),
    inkSoft: token("--ink-soft", "#4A5182"),
    inkFaint: token("--ink-faint", "rgba(22, 27, 61, 0.14)"),
    accent: token("--accent", "#FFD60A"),
    onAccent: token("--on-accent", "#101737"),
    accentEdge: token("--accent-edge", "#B38F00"),
    textMuted: token("--text-muted", "#8690C4"),
  };
}

// Canvas font shorthand takes width keywords, which map onto Anybody's width axis.
const display = (size: number, weight = 800, width = "semi-condensed") => `${width} ${weight} ${size}px Anybody, "Arial Narrow", sans-serif`;
const body = (size: number, weight = 500) => `${weight} ${size}px Figtree, system-ui, sans-serif`;

async function fontsReady(): Promise<void> {
  try {
    await Promise.all([
      document.fonts.load(display(40, 900)),
      document.fonts.load(display(40, 900, "semi-expanded")),
      document.fonts.load(body(28)),
      document.fonts.load(body(28, 800)),
    ]);
  } catch {
    // Fallback fonts still produce a readable image.
  }
}

/** Ellipsise `text` to fit `max` pixels in the current font. */
function fit(ctx: CanvasRenderingContext2D, text: string, max: number): string {
  if (ctx.measureText(text).width <= max) return text;
  let cut = text;
  while (cut.length > 1 && ctx.measureText(`${cut}…`).width > max) cut = cut.slice(0, -1);
  return `${cut.trimEnd()}…`;
}

export async function renderReceiptImage(username: string, stats: ShelfStats): Promise<Blob> {
  await fontsReady();
  const c = readPalette();
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = MIN_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser can't draw the image.");

  // ── Receipt content, measured first so the paper can be sized to it ──
  const left = (WIDTH - PAPER_W) / 2 + PAD;
  const right = (WIDTH + PAPER_W) / 2 - PAD;
  const inner = right - left;

  const ops: ((y: number) => number)[] = [];
  const add = (op: (y: number) => number) => ops.push(op);

  // Wordmark sticker
  add((y) => {
    ctx.font = display(40, 900, "semi-expanded");
    const label = "shelved";
    const w = ctx.measureText(label).width + 40;
    ctx.save();
    ctx.translate(WIDTH / 2, y + 30);
    ctx.rotate((-3 * Math.PI) / 180);
    ctx.fillStyle = c.accentEdge;
    ctx.fillRect(-w / 2, -26 + 5, w, 56);
    ctx.fillStyle = c.accent;
    ctx.fillRect(-w / 2, -26, w, 56);
    ctx.fillStyle = c.onAccent;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, 0, 3);
    ctx.restore();
    return y + 92;
  });

  add((y) => {
    ctx.fillStyle = c.ink;
    ctx.font = display(44, 900);
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(fit(ctx, `Receipt for ${username}`, inner), WIDTH / 2, y + 40);
    ctx.font = body(24);
    ctx.fillStyle = c.inkSoft;
    ctx.fillText(new Date().toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }), WIDTH / 2, y + 80);
    return y + 104;
  });

  const rule = () =>
    add((y) => {
      ctx.strokeStyle = c.inkFaint;
      ctx.lineWidth = 3;
      ctx.setLineDash([10, 8]);
      ctx.beginPath();
      ctx.moveTo(left, y + 18);
      ctx.lineTo(right, y + 18);
      ctx.stroke();
      ctx.setLineDash([]);
      return y + 36;
    });

  const line = (label: string, value: string, opts: { strong?: boolean; indent?: boolean } = {}) =>
    add((y) => {
      const size = opts.indent ? 26 : 30;
      const x = left + (opts.indent ? 26 : 0);
      ctx.font = body(size, opts.strong ? 800 : 500);
      ctx.fillStyle = opts.indent ? c.inkSoft : c.ink;
      ctx.textBaseline = "alphabetic";
      ctx.textAlign = "left";
      ctx.fillText(label, x, y + size);
      ctx.textAlign = "right";
      ctx.fillText(value, right, y + size);
      const from = x + ctx.measureText(label).width + 12;
      const to = right - ctx.measureText(value).width - 12;
      if (to > from) {
        ctx.strokeStyle = c.inkFaint;
        ctx.lineWidth = 3;
        ctx.setLineDash([2, 7]);
        ctx.beginPath();
        ctx.moveTo(from, y + size - 6);
        ctx.lineTo(to, y + size - 6);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      return y + size + 20;
    });

  const { byStatus } = stats;
  rule();
  line("On the shelf", String(stats.onShelf), { strong: true });
  line("Completed", String(byStatus.completed), { indent: true });
  line("Played", String(byStatus.played), { indent: true });
  line("Playing", String(byStatus.playing), { indent: true });
  line("Dropped", String(byStatus.dropped), { indent: true });
  line("On the wishlist", String(byStatus.want_to_play));
  rule();
  line("Time played", stats.minutes > 0 ? formatHoursTotal(stats.minutes) : "none logged");
  line("Reviews written", String(stats.reviews));
  line("Average rating", stats.average != null ? `${stats.average.toFixed(1)} / 10` : "nothing rated", { strong: true });

  if (stats.rated > 0) {
    rule();
    add((y) => {
      ctx.font = display(28, 800);
      ctx.fillStyle = c.ink;
      ctx.textAlign = "left";
      ctx.fillText("How you rate", left, y + 28);
      const plotTop = y + 74;
      const plotH = 150;
      const gap = 10;
      const barW = (inner - gap * 9) / 10;
      const max = Math.max(...stats.ratingSpread, 1);
      const peak = stats.ratingSpread.indexOf(max);
      stats.ratingSpread.forEach((count, i) => {
        const x = left + i * (barW + gap);
        const h = count > 0 ? Math.max(5, Math.round((count / max) * plotH)) : 0;
        ctx.fillStyle = c.ink;
        ctx.fillRect(x, plotTop + plotH - h, barW, h);
        if (i === peak) {
          ctx.font = body(22, 800);
          ctx.textAlign = "center";
          ctx.fillText(String(count), x + barW / 2, plotTop + plotH - h - 10);
        }
        ctx.font = body(22, 600);
        ctx.fillStyle = c.inkSoft;
        ctx.textAlign = "center";
        ctx.fillText(String(i + 1), x + barW / 2, plotTop + plotH + 32);
      });
      ctx.fillStyle = c.ink;
      ctx.fillRect(left, plotTop + plotH, inner, 3);
      return plotTop + plotH + 44;
    });
  }

  const genres = stats.topGenres.slice(0, 3);
  if (genres.length > 0) {
    rule();
    add((y) => {
      ctx.font = display(28, 800);
      ctx.fillStyle = c.ink;
      ctx.textAlign = "left";
      ctx.fillText("Top genres", left, y + 28);
      return y + 44;
    });
    const most = Math.max(...genres.map((g) => g.games), 1);
    for (const genre of genres) {
      line(genre.name, `${genre.games} ${genre.games === 1 ? "game" : "games"}`);
      add((y) => {
        ctx.fillStyle = c.ink;
        ctx.fillRect(left, y - 8, Math.max(0.04, genre.games / most) * inner, 7);
        return y + 14;
      });
    }
  }

  rule();
  add((y) => {
    ctx.font = display(30, 800);
    ctx.fillStyle = c.ink;
    ctx.textAlign = "center";
    ctx.fillText(byStatus.dropped > 0 ? "No refunds on dropped games." : "Thanks for playing.", WIDTH / 2, y + 30);
    // Barcode: widths from the username, so each person's is their own.
    const bars = Array.from({ length: 40 }, (_, i) => 2 + ((username.charCodeAt(i % Math.max(username.length, 1)) || 7) * (i + 3)) % 5);
    const total = bars.reduce((sum, w) => sum + w * 2 + 3, 0);
    let x = WIDTH / 2 - total / 2;
    for (const w of bars) {
      ctx.fillRect(x, y + 54, w * 2, 64);
      x += w * 2 + 3;
    }
    ctx.font = body(22, 600);
    ctx.fillStyle = c.inkSoft;
    ctx.fillText(window.location.host, WIDTH / 2, y + 152);
    return y + 172;
  });

  // Dry run to find the receipt's height (text measuring needs a real
  // context, so it draws invisibly), then size the canvas to fit. Resizing
  // clears the canvas and resets the context, so the real drawing starts after.
  ctx.save();
  ctx.globalAlpha = 0;
  let measured = 40;
  for (const op of ops) measured = op(measured);
  ctx.restore();

  const paperH = measured + 24;
  const height = Math.max(MIN_HEIGHT, paperH + TEETH + MARGIN * 2);
  canvas.height = height;
  const paperTop = Math.round((height - paperH - TEETH) / 2);
  const paperLeft = (WIDTH - PAPER_W) / 2;

  // ── The wall ──
  ctx.fillStyle = c.wall;
  ctx.fillRect(0, 0, WIDTH, height);
  ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
  for (let y = DOT_GRID / 2; y < height; y += DOT_GRID) {
    for (let x = DOT_GRID / 2; x < WIDTH; x += DOT_GRID) {
      ctx.beginPath();
      ctx.arc(x, y, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Paper with a torn (zigzag) bottom edge and a soft drop shadow.
  ctx.save();
  ctx.shadowColor = "rgba(4, 7, 26, 0.6)";
  ctx.shadowBlur = 40;
  ctx.shadowOffsetY = 18;
  ctx.fillStyle = c.paper;
  ctx.beginPath();
  ctx.moveTo(paperLeft, paperTop);
  ctx.lineTo(paperLeft + PAPER_W, paperTop);
  ctx.lineTo(paperLeft + PAPER_W, paperTop + paperH);
  for (let x = paperLeft + PAPER_W; x > paperLeft; x -= TEETH) {
    ctx.lineTo(x - TEETH / 2, paperTop + paperH + TEETH / 2);
    ctx.lineTo(Math.max(paperLeft, x - TEETH), paperTop + paperH);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  let y = paperTop + 40;
  for (const op of ops) y = op(y);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Couldn't create the image."))), "image/png");
  });
}

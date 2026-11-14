/** Compact playtime label from minutes: "45m", "2.5h", "128h". */
export function formatPlaytime(min: number): string {
  if (min <= 0) return "0h";
  if (min < 60) return `${min}m`;
  const h = min / 60;
  return h >= 10 ? `${Math.round(h)}h` : `${h.toFixed(1)}h`;
}

/** Relative timestamp for feed items: "just now", "5m ago", "3h ago", "2d ago", else a short date. */
export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** Playtime totals, which can run to thousands of hours: "3,257h". Short spans keep the compact form. */
export function formatHoursTotal(minutes: number): string {
  return minutes >= 600 ? `${Math.round(minutes / 60).toLocaleString()}h` : formatPlaytime(minutes);
}

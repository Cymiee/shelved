import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatPlaytime, timeAgo } from "./format";

describe("formatPlaytime", () => {
  it("returns 0h for zero or negative", () => {
    expect(formatPlaytime(0)).toBe("0h");
    expect(formatPlaytime(-5)).toBe("0h");
  });
  it("uses minutes under an hour", () => {
    expect(formatPlaytime(45)).toBe("45m");
    expect(formatPlaytime(59)).toBe("59m");
  });
  it("uses one decimal under 10 hours", () => {
    expect(formatPlaytime(60)).toBe("1.0h");
    expect(formatPlaytime(150)).toBe("2.5h");
  });
  it("rounds to whole hours from 10 hours", () => {
    expect(formatPlaytime(600)).toBe("10h");
    expect(formatPlaytime(128 * 60 + 20)).toBe("128h");
  });
});

describe("timeAgo", () => {
  const now = new Date("2026-06-15T12:00:00Z");
  const ago = (ms: number): string => new Date(now.getTime() - ms).toISOString();
  const MIN = 60_000;
  const HOUR = 60 * MIN;
  const DAY = 24 * HOUR;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("says just now under a minute", () => {
    expect(timeAgo(ago(30_000))).toBe("just now");
  });
  it("says just now for future timestamps", () => {
    expect(timeAgo(ago(-5 * MIN))).toBe("just now");
  });
  it("uses minutes", () => {
    expect(timeAgo(ago(5 * MIN))).toBe("5m ago");
    expect(timeAgo(ago(59 * MIN))).toBe("59m ago");
  });
  it("uses hours", () => {
    expect(timeAgo(ago(HOUR))).toBe("1h ago");
    expect(timeAgo(ago(23 * HOUR))).toBe("23h ago");
  });
  it("uses days under 30", () => {
    expect(timeAgo(ago(DAY))).toBe("1d ago");
    expect(timeAgo(ago(29 * DAY))).toBe("29d ago");
  });
  it("falls back to a short date from 30 days", () => {
    const iso = ago(30 * DAY);
    const expected = new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
    expect(timeAgo(iso)).toBe(expected);
    expect(timeAgo(iso)).not.toMatch(/ago$/);
  });
});

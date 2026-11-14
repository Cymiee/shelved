import { describe, expect, it } from "vitest";
import { collapseActivity } from "./activity";

interface Row {
  id: string;
  user_id: string;
  game_igdb_id: number;
}

const row = (id: string, user_id: string, game_igdb_id: number): Row => ({ id, user_id, game_igdb_id });

describe("collapseActivity", () => {
  it("returns an empty array for no rows", () => {
    expect(collapseActivity([])).toEqual([]);
  });

  it("keeps the first (newest) row per user and game", () => {
    const rows = [row("new", "u1", 1), row("mid", "u1", 1), row("old", "u1", 1)];
    expect(collapseActivity(rows).map((r) => r.id)).toEqual(["new"]);
  });

  it("keeps rows for different games or users", () => {
    const rows = [row("a", "u1", 1), row("b", "u1", 2), row("c", "u2", 1)];
    expect(collapseActivity(rows).map((r) => r.id)).toEqual(["a", "b", "c"]);
  });

  it("preserves input order", () => {
    const rows = [row("a", "u1", 1), row("b", "u2", 1), row("c", "u1", 1), row("d", "u1", 2), row("e", "u2", 1)];
    expect(collapseActivity(rows).map((r) => r.id)).toEqual(["a", "b", "d"]);
  });

  it("does not mutate the input", () => {
    const rows = [row("a", "u1", 1), row("b", "u1", 1)];
    collapseActivity(rows);
    expect(rows).toHaveLength(2);
  });

  it("does not confuse keys that concatenate alike", () => {
    const rows = [row("a", "u1", 12), row("b", "u1:1", 2)];
    expect(collapseActivity(rows)).toHaveLength(2);
  });
});

import { describe, it, expect } from "vitest";
import { AVATAR_IMAGE_HOSTS, isAllowedAvatarUrl } from "./avatars.js";

describe("isAllowedAvatarUrl", () => {
  it("accepts presets", () => {
    expect(isAllowedAvatarUrl("preset:fox_1-a")).toBe(true);
    expect(isAllowedAvatarUrl(`preset:${"a".repeat(40)}`)).toBe(true);
  });
  it("rejects bad presets", () => {
    expect(isAllowedAvatarUrl("preset:")).toBe(false);
    expect(isAllowedAvatarUrl("preset:Fox")).toBe(false);
    expect(isAllowedAvatarUrl(`preset:${"a".repeat(41)}`)).toBe(false);
  });
  it("accepts every allowed host", () => {
    for (const host of AVATAR_IMAGE_HOSTS) {
      expect(isAllowedAvatarUrl(`https://${host}/a.png`)).toBe(true);
    }
  });
  it("rejects http, look-alike hosts and userinfo tricks", () => {
    expect(isAllowedAvatarUrl("http://i.imgur.com/a.png")).toBe(false);
    expect(isAllowedAvatarUrl("https://i.imgur.com.evil.example/a.png")).toBe(false);
    expect(isAllowedAvatarUrl("https://i.imgur.com@evil.example/x")).toBe(false);
    expect(isAllowedAvatarUrl("https://evil.example/i.imgur.com/a.png")).toBe(false);
  });
  it("rejects empty paths, whitespace, empty strings and overlong URLs", () => {
    expect(isAllowedAvatarUrl("")).toBe(false);
    expect(isAllowedAvatarUrl("https://i.imgur.com/")).toBe(false);
    expect(isAllowedAvatarUrl("https://i.imgur.com/a b.png")).toBe(false);
    expect(isAllowedAvatarUrl(`https://i.imgur.com/${"a".repeat(1900)}`)).toBe(true);
    expect(isAllowedAvatarUrl(`https://i.imgur.com/${"a".repeat(1901)}`)).toBe(false);
  });
});

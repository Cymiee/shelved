/** Hosts a profile avatar image may be loaded from. Mirrors users_avatar_url_host (migration 017). */
export const AVATAR_IMAGE_HOSTS: readonly string[] = [
  "i.imgur.com",
  "avatars.githubusercontent.com",
  "cdn.discordapp.com",
  "avatars.steamstatic.com",
  "secure.gravatar.com",
  "lh3.googleusercontent.com",
  "pbs.twimg.com",
];

const PRESET_RE = /^preset:[a-z0-9_-]{1,40}$/;

/** Mirrors the database rule: a preset id, or an https URL on an allowed host. */
export function isAllowedAvatarUrl(url: string): boolean {
  if (PRESET_RE.test(url)) return true;
  const prefix = "https://";
  if (!url.startsWith(prefix)) return false;
  const rest = url.slice(prefix.length);
  return AVATAR_IMAGE_HOSTS.some((host) => {
    const head = `${host}/`;
    if (!rest.startsWith(head)) return false;
    return /^[^\s]{1,1900}$/.test(rest.slice(head.length));
  });
}

/** Inline error shown when a pasted avatar link is rejected. */
export const AVATAR_URL_ERROR =
  "Use an image link from Imgur, GitHub, Discord, Steam, Gravatar, Google or X. Other sites aren't allowed so profiles can't track visitors.";

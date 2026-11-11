import { useState } from "react";
import { NavLink } from "react-router-dom";
import { useAuthStore } from "../store/auth";
import LogSearchModal from "./LogSearchModal";
import { PlusIcon } from "./icons";

/**
 * Fixed bottom navigation for mobile. Four destinations at most, with the
 * app's primary action — logging a game — raised in the middle, under the
 * thumb. Auth-only entries are hidden when signed out rather than redirecting.
 * Desktop uses the inline links in Navbar instead.
 */
export default function BottomNav() {
  const { userId } = useAuthStore();
  const [logOpen, setLogOpen] = useState(false);

  const tab = (to: string, label: string, Icon: (p: IconProps) => JSX.Element, end = false) => (
    <NavLink key={to} to={to} end={end} className="tab-link">
      {({ isActive }) => (
        <>
          <Icon active={isActive} />
          <span style={{ whiteSpace: "nowrap" }}>{label}</span>
        </>
      )}
    </NavLink>
  );

  return (
    <>
      {logOpen && <LogSearchModal onClose={() => setLogOpen(false)} />}
      <nav
        aria-label="Primary"
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 120,
          display: "flex",
          background: "color-mix(in srgb, var(--bg-base) 94%, transparent)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          borderTop: "1px solid var(--border)",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        {tab("/", "Home", HomeIcon, true)}
        {tab("/explore", "Explore", ExploreIcon)}
        {userId && (
          <>
            <button type="button" className="tab-log" aria-label="Log a game" onClick={() => setLogOpen(true)}>
              <PlusIcon size={24} strokeWidth={2.8} />
            </button>
            {tab("/shelf", "My shelf", ShelfIcon)}
            {tab(`/profile/${userId}`, "Profile", ProfileIcon)}
          </>
        )}
      </nav>
    </>
  );
}

// ── Icons — minimal line glyphs, inherit currentColor ────────────────────────

interface IconProps {
  active: boolean;
}

const base = (active: boolean) => ({
  width: 20,
  height: 20,
  fill: "none" as const,
  stroke: "currentColor",
  strokeWidth: active ? 2.2 : 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
});

function HomeIcon({ active }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden {...base(active)}>
      <path d="M3 10.5 12 3.5l9 7" />
      <path d="M5.5 9.5V20h13V9.5" />
    </svg>
  );
}

function ExploreIcon({ active }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden {...base(active)}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m15.5 8.5-2 5-5 2 2-5z" />
    </svg>
  );
}

/** Three spines — matches the fallback glyph on GameCover. */
function ShelfIcon({ active }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden {...base(active)}>
      <rect x="3.5" y="4.5" width="4.5" height="15" rx="1.2" />
      <rect x="10" y="4.5" width="4.5" height="15" rx="1.2" />
      <path d="m17.2 5.6 3.3.9-2.6 13.1-3.3-.9z" />
    </svg>
  );
}

function ProfileIcon({ active }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden {...base(active)}>
      <circle cx="12" cy="8.5" r="3.8" />
      <path d="M4.8 20c.6-3.6 3.6-5.8 7.2-5.8s6.6 2.2 7.2 5.8" />
    </svg>
  );
}

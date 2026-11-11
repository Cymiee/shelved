import { NavLink, useNavigate, Link } from "react-router-dom";
import { useState, useRef, useEffect } from "react";
import { useAuthStore } from "../store/auth";
import { useNotificationsStore } from "../store/notifications";
import { useIsMobile } from "../hooks/useIsMobile";
import NotificationBadge from "./NotificationBadge";
import Avatar from "./Avatar";
import LogSearchModal from "./LogSearchModal";
import { SearchIcon, CloseIcon, PlusIcon } from "./icons";

export default function Navbar() {
  const { profile, logout } = useAuthStore();
  const pendingRequests = useNotificationsStore((s) => s.pendingRequests);
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [loggingOut, setLoggingOut] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Focus the field the moment the search expands.
  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus();
  }, [searchOpen]);

  const closeSearch = () => { setSearchOpen(false); setSearchQuery(""); };

  const handleLogout = async () => {
    setDropdownOpen(false);
    setLoggingOut(true);
    try {
      await logout();
      navigate("/auth");
    } finally {
      setLoggingOut(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;
    navigate(`/explore?q=${encodeURIComponent(q)}`);
    closeSearch();
  };

  const openDropdown = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setDropdownOpen(true);
  };

  const closeDropdown = () => {
    closeTimer.current = setTimeout(() => setDropdownOpen(false), 120);
  };

  return (
    <>
    {logOpen && <LogSearchModal onClose={() => setLogOpen(false)} />}
    <nav
      style={{
        // Solid at the top of the page, then lets the wall show through a little.
        background: scrolled ? "color-mix(in srgb, var(--bg-base) 86%, transparent)" : "var(--bg-base)",
        backdropFilter: scrolled ? "blur(12px)" : "none",
        WebkitBackdropFilter: scrolled ? "blur(12px)" : "none",
        borderBottom: "1px solid var(--border)",
        position: "sticky",
        top: 0,
        zIndex: 100,
        transition: "background 0.2s",
      }}
    >
      <div
        style={{
          maxWidth: 1280,
          margin: "0 auto",
          padding: isMobile ? "0.5rem 16px" : "0 24px",
          minHeight: 60,
          display: "flex",
          alignItems: "center",
          // On mobile the search form wraps onto its own full-width row
          flexWrap: isMobile ? "wrap" : "nowrap",
          gap: isMobile ? "0.75rem" : "0.5rem",
        }}
      >
        <Link className="wordmark" to="/" aria-label="Shelved, home" style={{ marginRight: isMobile ? 0 : "0.75rem" }}>
          <span style={{ fontSize: isMobile ? "1rem" : "1.125rem" }}>Shelved</span>
        </Link>

        {/* Primary nav — desktop only; mobile uses the fixed BottomNav */}
        {!isMobile && (
          <>
            <NavLink to="/" end className="nav-link">Home</NavLink>
            <NavLink to="/explore" className="nav-link">Explore</NavLink>
            {profile && <NavLink to="/shelf" className="nav-link">My shelf</NavLink>}
            {profile && (
              <NavLink to={`/profile/${profile.id}`} className="nav-link">Profile</NavLink>
            )}
          </>
        )}

        {/* Collapsible search — expands from the icon; full-width row on mobile */}
        <form
          onSubmit={handleSearchSubmit}
          style={{
            display: "flex",
            overflow: "hidden",
            marginLeft: isMobile ? 0 : "auto",
            opacity: searchOpen ? 1 : 0,
            width: isMobile ? (searchOpen ? "100%" : 0) : (searchOpen ? 260 : 0),
            transition: "width var(--transition-slow), opacity var(--transition-slow)",
            ...(isMobile && searchOpen ? { order: 10, flexBasis: "100%" } : {}),
          }}
        >
          <input
            ref={searchInputRef}
            className="field"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search games"
            aria-label="Search games"
            tabIndex={searchOpen ? 0 : -1}
            // The focus ring is drawn inside so the collapsing form can't clip it
            style={{ width: "100%", padding: "0.5rem 0.9rem", margin: 3 }}
          />
        </form>

        <button
          type="button"
          className="icon-btn"
          aria-label={searchOpen ? "Close search" : "Search"}
          onClick={() => (searchOpen ? closeSearch() : setSearchOpen(true))}
          style={{ marginLeft: isMobile ? "auto" : 0 }}
        >
          {searchOpen ? <CloseIcon size={18} /> : <SearchIcon size={18} />}
        </button>

        {/* The primary action. On mobile it lives in the bottom bar instead,
            under the thumb. */}
        {profile && !isMobile && (
          <button type="button" className="btn-key" onClick={() => setLogOpen(true)} style={{ marginLeft: "0.5rem" }}>
            <PlusIcon size={15} /> Log a game
          </button>
        )}

        {!profile && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              flexShrink: 0,
              marginLeft: isMobile ? 0 : "0.5rem",
            }}
          >
            <Link to="/auth" className="nav-link">Log in</Link>
            <Link className="btn-key" to="/auth?mode=signup">Sign up</Link>
          </div>
        )}

        {/* User dropdown */}
        {profile && (
          <div
            onMouseEnter={openDropdown}
            onMouseLeave={closeDropdown}
            style={{ position: "relative", flexShrink: 0, marginLeft: isMobile ? 0 : "0.25rem" }}
          >
            <button
              type="button"
              // Hover alone doesn't work on touch screens — tap toggles too
              onClick={() => setDropdownOpen((o) => !o)}
              aria-haspopup="menu"
              aria-expanded={dropdownOpen}
              aria-label="Account menu"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                cursor: "pointer",
                padding: "0.25rem 0.5rem",
                border: 0,
                borderRadius: "var(--radius-md)",
                background: dropdownOpen ? "var(--bg-card)" : "transparent",
                color: "var(--text-primary)",
                transition: "background 0.15s",
              }}
            >
              <span style={{ position: "relative", display: "flex", flexShrink: 0 }}>
                <Avatar username={profile.username} avatarUrl={profile.avatar_url} size={30} variant="solid" />
                <NotificationBadge count={pendingRequests} floating />
              </span>
              {!isMobile && (
                <span style={{ fontSize: "var(--text-sm)", fontWeight: 600 }}>{profile.username}</span>
              )}
              <svg
                width="10"
                height="10"
                viewBox="0 0 10 10"
                aria-hidden
                style={{
                  color: "var(--text-muted)",
                  transform: dropdownOpen ? "rotate(180deg)" : "none",
                  transition: "transform var(--transition)",
                }}
              >
                <path d="M1.5 3.5 5 7l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            {dropdownOpen && (
              <div
                className="reveal-pop"
                role="menu"
                onMouseEnter={openDropdown}
                onMouseLeave={closeDropdown}
                style={{
                  position: "absolute",
                  top: "calc(100% + 6px)",
                  right: 0,
                  background: "var(--bg-card)",
                  border: "1.5px solid var(--border-strong)",
                  borderRadius: "var(--radius-md)",
                  minWidth: 180,
                  boxShadow: "var(--shadow-lift)",
                  overflow: "hidden",
                  zIndex: 200,
                  transformOrigin: "top right",
                  animationDuration: "200ms",
                }}
              >
                {[
                  // Profile and My shelf live in the primary nav, so the
                  // dropdown carries only the secondary destinations.
                  { label: "Wishlist", to: "/want-to-play", badge: 0 },
                  { label: "Friends", to: "/friends", badge: pendingRequests },
                  { label: "Settings", to: "/settings", badge: 0 },
                ].map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    role="menuitem"
                    className="menu-item"
                    onClick={() => setDropdownOpen(false)}
                  >
                    {item.label}
                    <NotificationBadge count={item.badge} />
                  </Link>
                ))}

                <div style={{ height: 1, background: "var(--border)", margin: "0.25rem 0" }} />

                <button
                  role="menuitem"
                  className="menu-item menu-item--danger"
                  onClick={handleLogout}
                  disabled={loggingOut}
                  style={{ cursor: loggingOut ? "not-allowed" : "pointer", opacity: loggingOut ? 0.6 : 1 }}
                >
                  {loggingOut ? "Logging out…" : "Log out"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </nav>
    </>
  );
}

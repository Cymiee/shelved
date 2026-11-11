import { Link } from "react-router-dom";
import { useToastStore } from "../store/toast";
import { useIsMobile } from "../hooks/useIsMobile";

/**
 * Renders confirmations as a yellow sticker slapped on near the bottom of the
 * screen. Mounted once, in Layout.
 */
export default function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);
  const isMobile = useIsMobile();

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        // Clear the bottom bar (and its raised Log button) on mobile
        bottom: isMobile ? "calc(84px + env(safe-area-inset-bottom))" : 28,
        zIndex: 400,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
        padding: "0 16px",
        pointerEvents: "none",
      }}
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          style={{
            pointerEvents: "auto",
            display: "flex",
            alignItems: "center",
            gap: 14,
            maxWidth: "min(460px, 100%)",
            padding: "0.65rem 1rem",
            background: "var(--accent)",
            color: "var(--on-accent)",
            borderRadius: "var(--radius-md)",
            boxShadow: "var(--key-edge), var(--shadow-lift)",
            fontFamily: "var(--font-display)",
            fontStretch: "88%",
            fontWeight: 800,
            fontSize: "var(--text-sm)",
            lineHeight: 1.3,
            animation: "toastIn 260ms var(--ease-spring) both",
          }}
        >
          <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>{toast.message}</span>
          {toast.link && (
            <Link
              to={toast.link.to}
              onClick={() => dismiss(toast.id)}
              style={{ color: "var(--on-accent)", textDecoration: "underline", textUnderlineOffset: 2, whiteSpace: "nowrap" }}
            >
              {toast.link.label}
            </Link>
          )}
        </div>
      ))}
    </div>
  );
}

import { Outlet, useLocation } from "react-router-dom";
import { useEffect } from "react";
import Navbar from "./Navbar";
import BottomNav from "./BottomNav";
import { useIsMobile } from "../hooks/useIsMobile";

export default function Layout() {
  const { pathname } = useLocation();
  const isMobile = useIsMobile();

  // Start each new page at the top. Only the path matters: changing a query
  // string (e.g. Explore's ?q=) is a refinement of the same page, not a new one.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  // No transition overlay here on purpose. A forced spinner on every click made
  // even cached, instant pages feel slow; pages own their loading states.
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <Navbar />
      <main
        style={{
          flex: 1,
          position: "relative",
          // Clear the fixed bottom nav on mobile
          ...(isMobile ? { paddingBottom: "calc(58px + env(safe-area-inset-bottom))" } : {}),
        }}
      >
        <Outlet />
      </main>
      {isMobile && <BottomNav />}
    </div>
  );
}

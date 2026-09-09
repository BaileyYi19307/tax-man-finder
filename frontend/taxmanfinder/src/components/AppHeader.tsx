import type { CSSProperties, MouseEvent } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { navLabel } from "../attention/summary";
import { useAttentionSummary } from "../attention/useAttentionSummary";
import { dashboardPathForUser, useAuth } from "../auth/AuthProvider";
import { persistAccountantSignupIntent } from "../auth/intent";

const headerStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  padding: "12px 16px",
  borderBottom: "1px solid #e7e5e4",
  background: "#fffefb",
};

const brandStyle: CSSProperties = {
  color: "#1c1917",
  textDecoration: "none",
  fontWeight: 800,
  fontSize: 16,
};

const navStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: 14,
  fontSize: 14,
  fontWeight: 600,
};

const linkStyle: CSSProperties = {
  color: "#1c1917",
  textDecoration: "none",
};

const mutedNavStyle: CSSProperties = {
  color: "#111827",
  textDecoration: "none",
  fontWeight: 600,
  fontSize: 13,
  padding: "7px 12px",
  border: "1px solid #d1d5db",
  borderRadius: 8,
  background: "#fff",
};

export function AppLayout() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "#ffffff",
      }}
    >
      <AppHeader />
      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
        <Outlet />
      </div>
    </div>
  );
}

function scrollToHowItWorks() {
  window.requestAnimationFrame(() => {
    document.getElementById("how-it-works")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  });
}

export default function AppHeader() {
  const { user, ready, logout } = useAuth();
  const location = useLocation();
  const loggedIn = Boolean(user);
  const dashboardPath = dashboardPathForUser(user);
  const isAccountant = Boolean(user?.has_accountant_profile);
  const { summary } = useAttentionSummary();

  const messagesLabel = loggedIn
    ? navLabel("Messages", summary.messagesBadge)
    : "Messages";
  const consultationsLabel = loggedIn
    ? navLabel("Consultations", summary.consultationsBadge)
    : "Consultations";

  function onHowItWorksClick(event: MouseEvent<HTMLAnchorElement>) {
    if (location.pathname === "/") {
      event.preventDefault();
      scrollToHowItWorks();
    } else {
      // After navigation to `/#how-it-works`, scroll once the home section exists.
      window.setTimeout(scrollToHowItWorks, 50);
    }
  }

  return (
    <header style={headerStyle}>
      <Link to="/" className="app-nav-link" style={brandStyle}>
        <span style={{ color: "#111827" }}>TaxMan</span>
        <span style={{ color: "#2d5a43" }}>Finder</span>
      </Link>
      <nav aria-label="Main" style={navStyle}>
        <Link to="/accountants" className="app-nav-link" style={linkStyle}>
          Browse professionals
        </Link>
        <Link
          to="/#how-it-works"
          className="app-nav-link"
          style={linkStyle}
          onClick={onHowItWorksClick}
        >
          How it works
        </Link>
        {loggedIn ? (
          <>
            <Link to="/chat" className="app-nav-link" style={linkStyle}>
              {messagesLabel}
            </Link>
            <Link to="/bookings" className="app-nav-link" style={linkStyle}>
              {consultationsLabel}
            </Link>
            <Link to={dashboardPath} className="app-nav-link" style={linkStyle}>
              {isAccountant ? "Accountant Dashboard" : "Client Dashboard"}
            </Link>
            {isAccountant && user?.accountant_profile_complete && (
              <Link to="/dashboard/profile" className="app-nav-link" style={linkStyle}>
                My profile
              </Link>
            )}
            <button type="button" className="btn btn-secondary" onClick={logout}>
              Log out
            </button>
          </>
        ) : ready ? (
          <Link to="/login" className="app-nav-link" style={linkStyle}>
            Log in
          </Link>
        ) : null}
        <Link
          to="/onboarding/accountant"
          className="app-nav-link"
          style={mutedNavStyle}
          onClick={() => persistAccountantSignupIntent()}
        >
          For professionals
        </Link>
      </nav>
    </header>
  );
}

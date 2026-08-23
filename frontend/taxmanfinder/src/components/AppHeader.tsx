import type { CSSProperties } from "react";
import { Link, Outlet } from "react-router-dom";
import { navLabel } from "../attention/summary";
import { useAttentionSummary } from "../attention/useAttentionSummary";
import { dashboardPathForUser, useAuth } from "../auth/AuthProvider";

const headerStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  padding: "12px 16px",
  borderBottom: "1px solid #e5e7eb",
  background: "#fff",
};

const brandStyle: CSSProperties = {
  color: "#111827",
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
  color: "#2563eb",
  textDecoration: "none",
};

export function AppLayout() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "#f8fafc",
      }}
    >
      <AppHeader />
      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
        <Outlet />
      </div>
    </div>
  );
}

export default function AppHeader() {
  const { user, ready, logout } = useAuth();
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

  return (
    <header style={headerStyle}>
      <Link to="/" className="app-nav-link" style={brandStyle}>
        TaxManFinder
      </Link>
      <nav aria-label="Main" style={navStyle}>
        <Link to="/accountants" className="app-nav-link" style={linkStyle}>
          Browse
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
          <>
            <Link to="/login" className="app-nav-link" style={linkStyle}>
              Log in
            </Link>
            <Link to="/signup" className="app-nav-link" style={linkStyle}>
              Sign up
            </Link>
          </>
        ) : null}
      </nav>
    </header>
  );
}

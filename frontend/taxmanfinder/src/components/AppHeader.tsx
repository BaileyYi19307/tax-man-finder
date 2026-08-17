import type { CSSProperties } from "react";
import { Link, Outlet } from "react-router-dom";
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

const logoutButtonStyle: CSSProperties = {
  padding: "6px 10px",
  borderRadius: 8,
  border: "1px solid #d1d5db",
  background: "#fff",
  color: "#111827",
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
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

  return (
    <header style={headerStyle}>
      <Link to="/" style={brandStyle}>
        TaxManFinder
      </Link>
      <nav aria-label="Main" style={navStyle}>
        <Link to="/accountants" style={linkStyle}>
          Browse
        </Link>
        {loggedIn ? (
          <>
            <Link to="/chat" style={linkStyle}>
              Messages
            </Link>
            <Link to="/bookings" style={linkStyle}>
              Consultations
            </Link>
            <Link to={dashboardPath} style={linkStyle}>
              {isAccountant ? "Accountant Dashboard" : "Client Dashboard"}
            </Link>
            <button type="button" onClick={logout} style={logoutButtonStyle}>
              Log out
            </button>
          </>
        ) : ready ? (
          <>
            <Link to="/login" style={linkStyle}>
              Log in
            </Link>
            <Link to="/signup" style={linkStyle}>
              Sign up
            </Link>
          </>
        ) : null}
      </nav>
    </header>
  );
}

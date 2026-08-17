import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "./AuthProvider";
import { loginPath } from "./intent";

export function RequireAuth() {
  const { user, ready } = useAuth();
  const location = useLocation();

  if (!ready) {
    return <div style={{ padding: 24 }}>Loading…</div>;
  }

  if (!user) {
    return (
      <Navigate
        to={loginPath({ next: `${location.pathname}${location.search}` })}
        replace
      />
    );
  }

  return <Outlet />;
}

export function RequireAccountantDashboard() {
  const { user } = useAuth();

  if (!user?.has_accountant_profile) {
    return <Navigate to="/dashboard/client" replace />;
  }
  if (!user.accountant_profile_complete) {
    return <Navigate to="/onboarding/accountant" replace />;
  }
  return <Outlet />;
}

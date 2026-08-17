import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";
import { getMe, type CurrentUser } from "../api/client";
import { clearAuthSession, getAccessToken } from "./session";

type AuthContextValue = {
  user: CurrentUser | null;
  ready: boolean;
  refreshUser: () => Promise<CurrentUser | null>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function dashboardPathForUser(user: CurrentUser | null): string {
  if (user?.has_accountant_profile) {
    return "/dashboard/accountant";
  }
  return "/dashboard/client";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [ready, setReady] = useState(!getAccessToken());

  const refreshUser = useCallback(async () => {
    if (!getAccessToken()) {
      setUser(null);
      setReady(true);
      return null;
    }
    try {
      const me = await getMe();
      setUser(me);
      return me;
    } catch {
      clearAuthSession();
      setUser(null);
      return null;
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    void refreshUser();
  }, [refreshUser]);

  const logout = useCallback(() => {
    clearAuthSession();
    setUser(null);
    setReady(true);
    navigate("/");
  }, [navigate]);

  const value = useMemo(
    () => ({ user, ready, refreshUser, logout }),
    [user, ready, refreshUser, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}

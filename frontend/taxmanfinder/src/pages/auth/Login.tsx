import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import axios from "axios";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthProvider";
import {
  persistIntentFromAuthParams,
  resolvePostAuthPath,
  signupPath,
} from "../../auth/intent";
import { setAuthSession } from "../../auth/session";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [searchParams] = useSearchParams();
  const verified = searchParams.get("verified") === "true";
  const next = searchParams.get("next");
  const intent = searchParams.get("intent");
  const isAccountantIntent = intent === "tax-professional";

  const navigate = useNavigate();
  const { refreshUser } = useAuth();

  useEffect(() => {
    persistIntentFromAuthParams({ next, intent });
  }, [next, intent]);

  async function loginUser(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      persistIntentFromAuthParams({ next, intent });
      const response = await axios.post(
        "http://127.0.0.1:8000/users/auth/login/",
        { email, password },
        { headers: { "Content-Type": "application/json" } }
      );

      const access = response.data.tokens.access;
      const refresh = response.data.tokens.refresh;
      const userId = response.data.user.id;

      setAuthSession({
        accessToken: access,
        refreshToken: refresh,
        userId,
      });
      await refreshUser();

      navigate(
        resolvePostAuthPath({
          next,
          intent,
          hasAccountantProfile: Boolean(response.data.user.has_accountant_profile),
          profileComplete: Boolean(response.data.user.accountant_profile_complete),
        })
      );
    } catch (err: any) {
      const msg =
        err.response?.data?.detail ||
        err.response?.data?.message ||
        "Login failed. Check email/password.";
      setError(msg);
      console.log("status:", err.response?.status);
      console.log("data:", err.response?.data);
    } finally {
      setLoading(false);
    }
  }

  return (

    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "#f8fafc",
        padding: 16,
      }}
    >
      {verified && (
  <div
    style={{
      fontSize: 13,
      color: "#166534",
      background: "#f0fdf4",
      border: "1px solid #bbf7d0",
      borderRadius: 8,
      padding: 10,
      marginBottom: 12,
    }}
  >
    Email verified successfully. You can log in now.
  </div>
)}
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          background: "#fff",
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          padding: 20,
          boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
        }}
      >
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 18, fontWeight: 600, color: "#111" }}>
            Login
          </div>
          <div style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>
            {isAccountantIntent
              ? "Sign in to continue professional profile setup."
              : "Sign in to view conversations."}
          </div>
        </div>

        <form onSubmit={loginUser} style={{ display: "grid", gap: 12 }}>
          <div style={{ display: "grid", gap: 6 }}>
            <label htmlFor="emailInput" style={{ fontSize: 13, color: "#111" }}>
              Email
            </label>
            <input
              id="emailInput"
              name="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="client@test.com"
              autoComplete="email"
              style={{
                padding: "10px 12px",
                borderRadius: 8,
                border: "1px solid #d1d5db",
                fontSize: 14,
                outline: "none",
              }}
            />
          </div>

          <div style={{ display: "grid", gap: 6 }}>
            <label
              htmlFor="passwordInput"
              style={{ fontSize: 13, color: "#111" }}
            >
              Password
            </label>
            <input
              id="passwordInput"
              name="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              style={{
                padding: "10px 12px",
                borderRadius: 8,
                border: "1px solid #d1d5db",
                fontSize: 14,
                outline: "none",
              }}
            />
          </div>

          {error && (
            <div
              style={{
                fontSize: 13,
                color: "#b91c1c",
                background: "#fef2f2",
                border: "1px solid #fecaca",
                borderRadius: 8,
                padding: 10,
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              padding: "10px 12px",
              borderRadius: 8,
              border: "none",
              background: loading ? "#93c5fd" : "#2563eb",
              color: "#fff",
              fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>

        <div style={{ marginTop: 14, fontSize: 13, color: "#6b7280" }}>
          Don’t have an account?{" "}
          <Link
            to={signupPath({ next, intent })}
            style={{ color: "#2563eb", textDecoration: "none" }}
          >
            Sign up
          </Link>
        </div>
      </div>
    </div>
  );
}
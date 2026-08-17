import { useEffect, useState } from "react";
import axios from "axios";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { loginPath, persistIntentFromAuthParams } from "../../auth/intent";

export default function SignUpPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const next = searchParams.get("next");
  const intent = searchParams.get("intent");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const isAccountantIntent = intent === "tax-professional";

  useEffect(() => {
    persistIntentFromAuthParams({ next, intent });
  }, [next, intent]);

  async function signupUser(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (password !== passwordConfirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      persistIntentFromAuthParams({ next, intent });
      await axios.post(
        "http://127.0.0.1:8000/users/auth/signup/",
        { email, password },
        { headers: { "Content-Type": "application/json" } }
      );

      navigate(loginPath({ next, intent }), { replace: true });
    } catch (err: any) {
      const data = err.response?.data;
      const fieldErrors = Object.values(data || {})
        .flatMap((value) => (Array.isArray(value) ? value : [value]))
        .filter((value) => typeof value === "string");
      const msg =
        (typeof data?.detail === "string" && data.detail) ||
        (typeof data?.message === "string" && data.message) ||
        fieldErrors[0] ||
        "Signup failed. Check your inputs.";
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
            Sign up
          </div>
          <div style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>
            {isAccountantIntent
              ? "Create your account, then continue to professional profile setup."
              : "Create an account to message accountants or request a consultation."}
          </div>
        </div>

        <form onSubmit={signupUser} style={{ display: "grid", gap: 12 }}>
          <div style={{ display: "grid", gap: 6 }}>
            <label htmlFor="emailInput" style={{ fontSize: 13, color: "#111" }}>
              Email
            </label>
            <input
              id="emailInput"
              name="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
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
              autoComplete="new-password"
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
              htmlFor="passwordConfirmInput"
              style={{ fontSize: 13, color: "#111" }}
            >
              Confirm password
            </label>
            <input
              id="passwordConfirmInput"
              name="password_confirm"
              type="password"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
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
            {loading ? "Creating account..." : "Signup"}
          </button>
        </form>

        <div style={{ marginTop: 14, fontSize: 13, color: "#6b7280" }}>
          Already have an account?{" "}
          <Link
            to={loginPath({ next, intent })}
            style={{ color: "#2563eb", textDecoration: "none" }}
          >
            Login
          </Link>
        </div>
      </div>
    </div>
  );
}

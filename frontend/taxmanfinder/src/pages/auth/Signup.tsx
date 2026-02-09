import { useState } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";

export default function SignUpPage() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function signupUser(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await axios.post(
        "http://127.0.0.1:8000/users/auth/signup/",
        { email, password, role },
        { headers: { "Content-Type": "application/json" } }
      );

      navigate("/login", { replace: true });
    } catch (err: any) {
      // DRF often returns field errors: {email: [...], password: [...], role: [...]}
      const data = err.response?.data;
      const msg =
        data?.detail ||
        data?.message ||
        data?.email?.[0] ||
        data?.password?.[0] ||
        data?.role?.[0] ||
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
            Create an account to message accountants/clients.
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
            <label htmlFor="role" style={{ fontSize: 13, color: "#111" }}>
              Role
            </label>
            <select
              id="role"
              name="role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              style={{
                padding: "10px 12px",
                borderRadius: 8,
                border: "1px solid #d1d5db",
                fontSize: 14,
                outline: "none",
                background: "#fff",
              }}
            >
              <option value="">Select a role</option>
              <option value="accountant">Accountant</option>
              <option value="client">Client</option>
            </select>
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
            disabled={loading || !role}
            style={{
              padding: "10px 12px",
              borderRadius: 8,
              border: "none",
              background: loading || !role ? "#93c5fd" : "#2563eb",
              color: "#fff",
              fontWeight: 600,
              cursor: loading || !role ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Creating account..." : "Signup"}
          </button>
        </form>

        <div style={{ marginTop: 14, fontSize: 13, color: "#6b7280" }}>
          Already have an account?{" "}
          <Link to="/login" style={{ color: "#2563eb", textDecoration: "none" }}>
            Login
          </Link>
        </div>
      </div>
    </div>
  );
}

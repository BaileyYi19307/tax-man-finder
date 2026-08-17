import { Link } from "react-router-dom";
import { persistAccountantSignupIntent, persistClientBrowseIntent } from "../auth/intent";

const page = {
  minHeight: "100vh",
  background: "#f8fafc",
  padding: "32px 16px",
};

const container = {
  maxWidth: 900,
  margin: "0 auto" as const,
};

const card = {
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 16,
  padding: 28,
  textDecoration: "none",
  color: "inherit",
  display: "block",
  boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
};

export default function Home() {
  return (
    <div style={page}>
      <div style={container}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 28 }}>
          <div>
            <div style={{ fontSize: 28, fontWeight: 800, color: "#111827" }}>
              Find tax help, or join as a professional
            </div>
            <div style={{ color: "#6b7280", marginTop: 8, lineHeight: 1.5 }}>
              Browse public accountant profiles without an account. Sign in only when you
              want to message someone or request a consultation.
            </div>
          </div>
          <div style={{ display: "flex", gap: 16, fontSize: 14, fontWeight: 600 }}>
            <Link to="/login" style={{ color: "#2563eb", textDecoration: "none" }}>
              Log in
            </Link>
            <Link to="/signup" style={{ color: "#2563eb", textDecoration: "none" }}>
              Sign up
            </Link>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 20,
          }}
        >
          <Link
            to="/accountants"
            onClick={() => persistClientBrowseIntent()}
            style={card}
          >
            <div style={{ fontSize: 13, fontWeight: 700, color: "#2563eb", marginBottom: 8 }}>
              Looking for tax help
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#111827", marginBottom: 10 }}>
              Find an accountant
            </div>
            <div style={{ color: "#6b7280", lineHeight: 1.5, fontSize: 14 }}>
              Browse tax professionals, view public profiles, and reach out when you are
              ready to start a conversation or request a consultation.
            </div>
          </Link>

          <Link
            to="/onboarding/accountant"
            onClick={() => persistAccountantSignupIntent()}
            style={card}
          >
            <div style={{ fontSize: 13, fontWeight: 700, color: "#2563eb", marginBottom: 8 }}>
              Tax professional
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#111827", marginBottom: 10 }}>
              Join as a tax professional
            </div>
            <div style={{ color: "#6b7280", lineHeight: 1.5, fontSize: 14 }}>
              Create your professional profile, list services, and receive client inquiries.
              This is an additional capability on your account, not a separate identity.
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}

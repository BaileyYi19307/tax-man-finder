import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { API_BASE } from "../../api/client";

type DirectoryAccountant = {
  user_id: number;
  email: string;
  bio: string | null;
  credentials: string;
  years_experience: number;
};

const page = {
  minHeight: "100vh",
  background: "#f8fafc",
  padding: "32px 16px",
};

const container = {
  maxWidth: 960,
  margin: "0 auto" as const,
};

const card = {
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  padding: 16,
  boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
};

export default function AccountantsDirectory() {
  const [accountants, setAccountants] = useState<DirectoryAccountant[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/accountants/directory/`)
      .then(async (res) => {
        if (!res.ok) throw new Error(await res.text());
        return res.json();
      })
      .then(setAccountants)
      .catch((e) => {
        console.error(e);
        setError("Could not load accountants.");
      });
  }, []);

  return (
    <div style={page}>
      <div style={container}>
        <div style={{ marginBottom: 16 }}>
          <Link to="/" style={{ fontSize: 13, color: "#2563eb", textDecoration: "none" }}>
            ← Home
          </Link>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#111827", marginTop: 12 }}>
            Tax professionals
          </div>
          <div style={{ color: "#6b7280", fontSize: 13, marginTop: 4 }}>
            Browse public profiles. You can create an account when you are ready to message
            or request a consultation.
          </div>
        </div>

        {error && (
          <div style={{ color: "#b91c1c", marginBottom: 12 }}>{error}</div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
          {accountants.map((accountant) => (
            <div key={accountant.user_id} style={card}>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#111827" }}>
                {accountant.email}
              </div>
              <div style={{ color: "#6b7280", fontSize: 13, marginTop: 6 }}>
                {accountant.credentials || "Credentials not listed"}
              </div>
              <div style={{ color: "#4b5563", fontSize: 13, marginTop: 10, lineHeight: 1.4 }}>
                {accountant.bio || "No bio yet."}
              </div>
              <div style={{ marginTop: 14 }}>
                <Link
                  to={`/accountants/${accountant.user_id}`}
                  style={{
                    display: "inline-block",
                    padding: "8px 10px",
                    borderRadius: 8,
                    border: "1px solid #e5e7eb",
                    background: "#fff",
                    color: "#111827",
                    textDecoration: "none",
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  View profile
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

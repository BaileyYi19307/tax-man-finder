import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../../api/client";

type InquiryRow = {
  id: number;
  accountant_name: string;
  client_name: string;
  service_title: string | null;
  status: string;
};

const page = {
  minHeight: "100vh",
  background: "#f8fafc",
  padding: "32px 16px",
};

const container = {
  maxWidth: 900,
  margin: "0 auto",
};

const card = {
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  padding: 16,
};

const muted = { color: "#6b7280" };

export default function AccountantDashboard() {
  const [inquiries, setInquiries] = useState<InquiryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const token = localStorage.getItem("access_token");

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);
        const response = await apiFetch("/api/inquiries/");
        if (!response.ok) throw new Error(await response.text());
        const rows = await response.json();
        if (!cancelled) setInquiries(rows);
      } catch (e) {
        console.error(e);
        if (!cancelled) {
          setInquiries([]);
          setError("Could not load inquiries.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div style={page}>
      <div style={container}>
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: "#111827" }}>
            Accountant Dashboard
          </div>
          <div style={{ ...muted, marginTop: 4 }}>
            Manage your services and client inquiries.
          </div>
        </div>

        <div style={{ display: "flex", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
          <Link to="/dashboard/profile" style={{ ...card, textDecoration: "none", color: "#111827", flex: 1, minWidth: 160 }}>
            <div style={{ fontWeight: 700 }}>My profile</div>
            <div style={{ ...muted, fontSize: 13, marginTop: 6 }}>
              Edit how clients see you
            </div>
          </Link>

          <Link to="/dashboard/services" style={{ ...card, textDecoration: "none", color: "#111827", flex: 1, minWidth: 160 }}>
            <div style={{ fontWeight: 700 }}>My Services</div>
            <div style={{ ...muted, fontSize: 13, marginTop: 6 }}>
              View and edit your listings
            </div>
          </Link>

          <Link to="/chat" style={{ ...card, textDecoration: "none", color: "#111827", flex: 1 }}>
            <div style={{ fontWeight: 700 }}>Inbox</div>
            <div style={{ ...muted, fontSize: 13, marginTop: 6 }}>
              Respond to client inquiries
            </div>
          </Link>

          <Link to="/bookings" style={{ ...card, textDecoration: "none", color: "#111827", flex: 1 }}>
            <div style={{ fontWeight: 700 }}>Consultations</div>
            <div style={{ ...muted, fontSize: 13, marginTop: 6 }}>
              Accept or decline booking requests
            </div>
          </Link>
        </div>

        <div style={card}>
          <div style={{ fontWeight: 700, marginBottom: 12 }}>Recent inquiries</div>

          {loading && <div style={{ ...muted, fontSize: 13 }}>Loading inquiries…</div>}
          {error && <div style={{ color: "#b91c1c", fontSize: 13 }}>{error}</div>}
          {!loading && !error && inquiries.length === 0 && (
            <div style={{ ...muted, fontSize: 13 }}>No inquiries yet.</div>
          )}

          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {!loading && !error && inquiries.slice(0, 5).map((c) => (
              <li key={c.id} style={{ padding: "10px 0", borderBottom: "1px solid #f3f4f6" }}>
                <Link
                  to={`/chat/${c.id}`}
                  style={{ textDecoration: "none", color: "#111827" }}
                >
                  <div style={{ fontWeight: 600 }}>
                    {c.client_name}
                  </div>
                  <div style={{ ...muted, fontSize: 13, marginTop: 2 }}>
                    {c.service_title || "General inquiry"} · {c.status}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

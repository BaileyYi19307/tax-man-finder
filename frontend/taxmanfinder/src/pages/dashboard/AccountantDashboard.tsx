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
  const token = localStorage.getItem("access_token");

  useEffect(() => {
    if (!token) return;

    apiFetch("/api/inquiries/")
      .then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
        return r.json();
      })
      .then(setInquiries)
      .catch(console.error);
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

        <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
          <Link to="/dashboard/services" style={{ ...card, textDecoration: "none", color: "#111827", flex: 1 }}>
            <div style={{ fontWeight: 700 }}>My Services</div>
            <div style={{ ...muted, fontSize: 13, marginTop: 6 }}>
              View and manage your listings
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

          {inquiries.length === 0 && (
            <div style={{ ...muted, fontSize: 13 }}>No inquiries yet.</div>
          )}

          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {inquiries.slice(0, 5).map((c) => (
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

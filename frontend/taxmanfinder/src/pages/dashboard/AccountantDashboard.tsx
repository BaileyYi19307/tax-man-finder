import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

type Conversation = {
  id: number;
  other_user: string;
  last_message: string;
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
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const token = localStorage.getItem("access_token");

  useEffect(() => {
    if (!token) return;

    fetch("http://127.0.0.1:8000/api/conversations/", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then(setConversations)
      .catch(console.error);
  }, [token]);

  return (
    <div style={page}>
      <div style={container}>
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: "#111827" }}>
            Accountant Dashboard
          </div>
          <div style={{ ...muted, marginTop: 4 }}>
            Manage your services and client inquiries.
          </div>
        </div>

        {/* Quick actions */}
        <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
          <Link to="/services" style={{ ...card, textDecoration: "none", color: "#111827", flex: 1 }}>
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
        </div>

        {/* Recent conversations */}
        <div style={card}>
          <div style={{ fontWeight: 700, marginBottom: 12 }}>
            Recent conversations
          </div>

          {conversations.length === 0 && (
            <div style={{ ...muted, fontSize: 13 }}>
              No conversations yet.
            </div>
          )}

          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {conversations.slice(0, 5).map((c) => (
              <li key={c.id} style={{ padding: "10px 0", borderBottom: "1px solid #f3f4f6" }}>
                <Link
                  to={`/chat/${c.id}`}
                  style={{ textDecoration: "none", color: "#111827" }}
                >
                  <div style={{ fontWeight: 600 }}>{c.other_user}</div>
                  <div style={{ ...muted, fontSize: 13, marginTop: 2 }}>
                    {c.last_message || "No messages yet"}
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

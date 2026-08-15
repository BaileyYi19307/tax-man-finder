import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

type ProfileService = {
  id: number;
  name: string;
};

type AccountantProfile = {
  user_id: number;
  email: string;
  bio: string | null;
  credentials: string;
  years_experience: number;
  services: ProfileService[];
};

const page = {
  minHeight: "100vh",
  background: "#f8fafc",
  padding: "32px 16px",
};

const container = {
  maxWidth: 820,
  margin: "0 auto",
};

const card = {
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  padding: 20,
  boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
};

const muted = { color: "#6b7280" };

export default function AccountantProfilePage() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<AccountantProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showMessageForm, setShowMessageForm] = useState(false);
  const [messageText, setMessageText] = useState("");
  const [selectedServiceId, setSelectedServiceId] = useState<string>("");

  const token = localStorage.getItem("access_token");

  useEffect(() => {
    async function loadProfile() {
      try {
        const res = await fetch(`http://127.0.0.1:8000/accountants/${userId}/`);
        if (!res.ok) throw new Error(await res.text());
        setProfile(await res.json());
      } catch (e) {
        console.error(e);
        setError("Could not load accountant profile.");
      }
    }
    loadProfile();
  }, [userId]);

  function openMessageForm() {
    if (!token) {
      navigate("/login");
      return;
    }
    setError(null);
    setShowMessageForm(true);
  }

  function closeMessageForm() {
    setShowMessageForm(false);
    setMessageText("");
    setSelectedServiceId("");
    setError(null);
  }

  async function sendMessage() {
    if (!token || !profile) {
      navigate("/login");
      return;
    }

    const content = messageText.trim();
    if (!content) {
      setError("Message cannot be blank.");
      return;
    }

    setLoading(true);
    setError(null);

    const body: { content: string; accountant?: number; service?: number } = {
      content,
    };
    if (selectedServiceId) {
      body.service = Number(selectedServiceId);
    } else {
      body.accountant = profile.user_id;
    }

    try {
      const res = await fetch("http://127.0.0.1:8000/api/inquiries/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error(await res.text());

      const data = await res.json();
      closeMessageForm();
      navigate(`/chat/${data.inquiry_id}`);
    } catch (e) {
      console.error(e);
      setError("Could not start chat. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (!profile && !error) {
    return (
      <div style={page}>
        <div style={container}>Loading profile…</div>
      </div>
    );
  }

  return (
    <div style={page}>
      <div style={container}>
        <Link to="/services" style={{ fontSize: 13, color: "#2563eb" }}>
          ← Back to services
        </Link>

        {profile && (
          <div style={{ ...card, marginTop: 16 }}>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{profile.email}</div>
            <div style={{ ...muted, marginTop: 8, fontSize: 14 }}>
              {profile.years_experience} years experience
            </div>
            {profile.credentials && (
              <div style={{ marginTop: 12, fontSize: 14 }}>
                <strong>Credentials</strong>
                <div style={{ ...muted, marginTop: 4 }}>{profile.credentials}</div>
              </div>
            )}
            {profile.bio && (
              <div style={{ marginTop: 12, fontSize: 14 }}>
                <strong>Bio</strong>
                <div style={{ ...muted, marginTop: 4, lineHeight: 1.5 }}>{profile.bio}</div>
              </div>
            )}

            <div style={{ marginTop: 18 }}>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>Services</div>
              {profile.services.length === 0 ? (
                <div style={muted}>No active services listed.</div>
              ) : (
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {profile.services.map((s) => (
                    <li key={s.id} style={{ marginBottom: 6 }}>
                      <Link to={`/services/${s.id}`}>{s.name}</Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {error && !showMessageForm && (
              <div style={{ marginTop: 14, color: "#b91c1c", fontSize: 13 }}>{error}</div>
            )}

            <div style={{ marginTop: 18, display: "flex", gap: 10 }}>
              <button
                type="button"
                onClick={openMessageForm}
                style={{
                  padding: "10px 14px",
                  borderRadius: 10,
                  border: "none",
                  background: "#2563eb",
                  color: "#fff",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Message Accountant
              </button>
              <Link
                to="/chat"
                style={{
                  padding: "10px 14px",
                  borderRadius: 10,
                  border: "1px solid #e5e7eb",
                  background: "#fff",
                  color: "#111827",
                  textDecoration: "none",
                  fontWeight: 700,
                  fontSize: 14,
                }}
              >
                Go to inbox
              </Link>
            </div>
          </div>
        )}

        {showMessageForm && profile && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.35)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 16,
            }}
          >
            <div
              style={{
                background: "#fff",
                borderRadius: 12,
                padding: 20,
                width: "100%",
                maxWidth: 420,
              }}
            >
              <h3 style={{ marginTop: 0 }}>Message Accountant</h3>

              <label style={{ display: "block", fontSize: 14, marginBottom: 12 }}>
                Service (optional)
                <select
                  value={selectedServiceId}
                  onChange={(e) => setSelectedServiceId(e.target.value)}
                  style={{ width: "100%", marginTop: 6, padding: 8 }}
                >
                  <option value="">General inquiry</option>
                  {profile.services.map((s) => (
                    <option key={s.id} value={String(s.id)}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>

              <label style={{ display: "block", fontSize: 14 }}>
                Message
                <textarea
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder="Describe what you need help with..."
                  rows={4}
                  style={{
                    width: "100%",
                    marginTop: 6,
                    marginBottom: 16,
                    boxSizing: "border-box",
                  }}
                />
              </label>

              {error && (
                <div style={{ marginBottom: 12, fontSize: 13, color: "#b91c1c" }}>{error}</div>
              )}

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button type="button" onClick={closeMessageForm} disabled={loading}>
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={sendMessage}
                  disabled={loading || !messageText.trim()}
                >
                  {loading ? "Sending..." : "Send"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate, useParams, useLocation } from "react-router-dom";
import {
  API_BASE,
  requestConsultation,
  startConversation,
} from "../../api/client";
import { loginPath } from "../../auth/intent";

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
  const location = useLocation();
  const [profile, setProfile] = useState<AccountantProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [showMessageForm, setShowMessageForm] = useState(false);
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [messageText, setMessageText] = useState("");
  const [selectedServiceId, setSelectedServiceId] = useState<string>("");
  const [bookingNote, setBookingNote] = useState("");
  const [bookingDate, setBookingDate] = useState("");

  const token = localStorage.getItem("access_token");

  useEffect(() => {
    let cancelled = false;
    setProfile(null);
    setLoadError(null);

    async function loadProfile() {
      try {
        const res = await fetch(`${API_BASE}/accountants/${userId}/`);
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        if (!cancelled) {
          setProfile(data);
          setLoadError(null);
        }
      } catch (e) {
        console.error(e);
        if (!cancelled) {
          setProfile(null);
          setLoadError("Could not load accountant profile.");
        }
      }
    }
    loadProfile();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  function openMessageForm() {
    if (!token) {
      navigate(loginPath({ next: location.pathname }));
      return;
    }
    setFormError(null);
    setShowMessageForm(true);
  }

  function closeMessageForm() {
    setShowMessageForm(false);
    setMessageText("");
    setSelectedServiceId("");
    setFormError(null);
  }

  async function sendMessage() {
    if (!token || !profile) {
      navigate(loginPath({ next: location.pathname }));
      return;
    }

    const content = messageText.trim();
    if (!content) {
      setFormError("Message cannot be blank.");
      return;
    }

    setLoading(true);
    setFormError(null);

    try {
      const body: { content: string; accountant?: number; service?: number } = {
        content,
      };
      if (selectedServiceId) {
        body.service = Number(selectedServiceId);
      } else {
        body.accountant = profile.user_id;
      }
      const data = await startConversation(body);
      closeMessageForm();
      navigate(`/chat/${data.inquiry_id}`);
    } catch (e) {
      console.error(e);
      setFormError("Could not start chat. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function openBookingForm() {
    if (!token) {
      navigate(loginPath({ next: location.pathname }));
      return;
    }
    setFormError(null);
    setShowBookingForm(true);
  }

  function closeBookingForm() {
    setShowBookingForm(false);
    setBookingNote("");
    setBookingDate("");
    setSelectedServiceId("");
    setFormError(null);
  }

  async function submitConsultation() {
    if (!token || !profile) {
      navigate(loginPath({ next: location.pathname }));
      return;
    }
    const content = bookingNote.trim();
    if (!content) {
      setFormError("Please include a brief note.");
      return;
    }
    if (!bookingDate) {
      setFormError("Please choose a start date and time.");
      return;
    }

    setLoading(true);
    setFormError(null);
    try {
      const body: {
        content: string;
        starts_at: string;
        service?: number;
        accountant?: number;
      } = {
        content,
        starts_at: new Date(bookingDate).toISOString(),
      };
      if (selectedServiceId) {
        body.service = Number(selectedServiceId);
      } else {
        body.accountant = profile.user_id;
      }
      const data = await requestConsultation(body);
      closeBookingForm();
      navigate(`/chat/${data.inquiry_id}`);
    } catch (e) {
      console.error(e);
      setFormError("Could not request consultation. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (!profile && !loadError) {
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

        {loadError && (
          <div style={{ ...card, marginTop: 16, color: "#b91c1c" }}>{loadError}</div>
        )}

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

            <div style={{ marginTop: 18, display: "flex", gap: 10, flexWrap: "wrap" }}>
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
              <button type="button" onClick={openBookingForm}>
                Request Consultation
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
          <Modal>
            <h3 style={{ marginTop: 0 }}>Message Accountant</h3>
            <ServiceSelect
              services={profile.services}
              value={selectedServiceId}
              onChange={setSelectedServiceId}
            />
            <label style={{ display: "block", fontSize: 14 }}>
              Message
              <textarea
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder="Describe what you need help with..."
                rows={4}
                style={{ width: "100%", marginTop: 6, marginBottom: 16, boxSizing: "border-box" }}
              />
            </label>
            {formError && <ErrorText text={formError} />}
            <Actions
              onCancel={closeMessageForm}
              onSubmit={sendMessage}
              loading={loading}
              disabled={!messageText.trim()}
              submitLabel="Send"
            />
          </Modal>
        )}

        {showBookingForm && profile && (
          <Modal>
            <h3 style={{ marginTop: 0 }}>Request Consultation</h3>
            <p style={{ ...muted, fontSize: 13 }}>Fixed 30-minute consultation.</p>
            <ServiceSelect
              services={profile.services}
              value={selectedServiceId}
              onChange={setSelectedServiceId}
            />
            <label style={{ display: "block", fontSize: 14, marginBottom: 12 }}>
              Date and time
              <input
                type="datetime-local"
                value={bookingDate}
                onChange={(e) => setBookingDate(e.target.value)}
                style={{ width: "100%", marginTop: 6 }}
              />
            </label>
            <label style={{ display: "block", fontSize: 14 }}>
              Brief note
              <textarea
                value={bookingNote}
                onChange={(e) => setBookingNote(e.target.value)}
                placeholder="What would you like to discuss?"
                rows={3}
                style={{ width: "100%", marginTop: 6, marginBottom: 16, boxSizing: "border-box" }}
              />
            </label>
            {formError && <ErrorText text={formError} />}
            <Actions
              onCancel={closeBookingForm}
              onSubmit={submitConsultation}
              loading={loading}
              disabled={!bookingDate || !bookingNote.trim()}
              submitLabel="Request Consultation"
            />
          </Modal>
        )}
      </div>
    </div>
  );
}

function Modal({ children }: { children: ReactNode }) {
  return (
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
        {children}
      </div>
    </div>
  );
}

function ServiceSelect({
  services,
  value,
  onChange,
}: {
  services: ProfileService[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label style={{ display: "block", fontSize: 14, marginBottom: 12 }}>
      Service (optional)
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ width: "100%", marginTop: 6, padding: 8 }}
      >
        <option value="">General inquiry</option>
        {services.map((s) => (
          <option key={s.id} value={String(s.id)}>
            {s.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function ErrorText({ text }: { text: string }) {
  return <div style={{ marginBottom: 12, fontSize: 13, color: "#b91c1c" }}>{text}</div>;
}

function Actions({
  onCancel,
  onSubmit,
  loading,
  disabled,
  submitLabel,
}: {
  onCancel: () => void;
  onSubmit: () => void;
  loading: boolean;
  disabled: boolean;
  submitLabel: string;
}) {
  return (
    <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
      <button type="button" onClick={onCancel} disabled={loading}>
        Cancel
      </button>
      <button type="button" onClick={onSubmit} disabled={loading || disabled}>
        {loading ? "Working..." : submitLabel}
      </button>
    </div>
  );
}

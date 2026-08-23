import { useParams, useNavigate, Link, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import axios from "axios";
import { API_BASE, requestConsultation, startConversation } from "../../api/client";
import { loginPath } from "../../auth/intent";

type Service = {
  id: number;
  name: string;
  description: string;
  pricing_type: "fixed" | "hourly" | "consultation_required";
  indicative_price: string | null;
  consultation_fee?: string | null;
  cancellation_policy?: string;
  accountant: number;
};

function formatServicePrice(service: Pick<Service, "pricing_type" | "indicative_price">) {
  if (service.pricing_type === "consultation_required") {
    return "Consultation required";
  }
  if (service.indicative_price == null || service.indicative_price === "") {
    return "Price on request";
  }
  if (service.pricing_type === "hourly") {
    return `$${service.indicative_price}/hr`;
  }
  return `$${service.indicative_price}`;
}

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

export default function ServiceDetail() {
  const { serviceId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [service, setService] = useState<Service | null>(null);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showMessageForm, setShowMessageForm] = useState(false);
  const [messageText, setMessageText] = useState("");

  const [showBookingForm, setShowBookingForm] = useState(false);
  const [bookingNote, setBookingNote] = useState("");
  const [bookingDate, setBookingDate] = useState("");

  const token = localStorage.getItem("access_token");

  useEffect(() => {
    let cancelled = false;

    async function getService() {
      setFetchLoading(true);
      setFetchError(null);
      try {
        const response = await axios.get(`${API_BASE}/services/${serviceId}/`);
        if (!cancelled) {
          setService(response.data);
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setService(null);
          setFetchError("Could not load this service.");
        }
      } finally {
        if (!cancelled) {
          setFetchLoading(false);
        }
      }
    }

    getService();
    return () => {
      cancelled = true;
    };
  }, [serviceId]);

  function openMessageForm() {
    if (!token) {
      navigate(loginPath({ next: location.pathname }));
      return;
    }
    setError(null);
    setShowMessageForm(true);
  }

  function closeMessageForm() {
    setShowMessageForm(false);
    setMessageText("");
    setError(null);
  }

  async function sendMessage() {
    if (!token) {
      navigate(loginPath({ next: location.pathname }));
      return;
    }

    const content = messageText.trim();
    if (!content) {
      setError("Message cannot be blank.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await startConversation({
        service: Number(serviceId),
        content,
      });
      closeMessageForm();
      navigate(`/chat/${data.inquiry_id}`);
    } catch (e) {
      setError("Could not start chat. Please try again.");
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  function openBookingForm() {
    if (!token) {
      navigate(loginPath({ next: location.pathname }));
      return;
    }
    setError(null);
    setShowBookingForm(true);
  }

  function closeBookingForm() {
    setShowBookingForm(false);
    setBookingNote("");
    setBookingDate("");
    setError(null);
  }

  async function createBookingRequest() {
    if (!token) {
      navigate(loginPath({ next: location.pathname }));
      return;
    }

    const content = bookingNote.trim();
    if (!content) {
      setError("Please include a brief note for the consultation.");
      return;
    }
    if (!bookingDate) {
      setError("Please choose a start date and time.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const startsAt = new Date(bookingDate).toISOString();
      const data = await requestConsultation({
        service: Number(serviceId),
        starts_at: startsAt,
        content,
      });
      closeBookingForm();
      navigate(`/chat/${data.inquiry_id}`);
    } catch (e) {
      console.error(e);
      setError("Could not request consultation. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (fetchLoading) {
    return (
      <div style={page}>
        <div style={container}>
          <div style={{ ...muted, fontSize: 14 }}>Loading service…</div>
        </div>
      </div>
    );
  }

  if (fetchError || !service) {
    return (
      <div style={page}>
        <div style={container}>
          <div style={{ color: "#b91c1c", marginBottom: 12, fontSize: 14 }}>
            {fetchError || "This service could not be found."}
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Link
              to="/accountants"
              style={{ fontSize: 13, color: "#2563eb", textDecoration: "none", fontWeight: 600 }}
            >
              Browse tax professionals
            </Link>
            <Link
              to="/services"
              style={{ fontSize: 13, color: "#2563eb", textDecoration: "none", fontWeight: 600 }}
            >
              Back to services
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={page}>
      <div style={container}>
        <div style={{ marginBottom: 12 }}>
          <Link
            to="/services"
            style={{
              fontSize: 13,
              textDecoration: "none",
              color: "#2563eb",
              fontWeight: 600,
            }}
          >
            ← Back to services
          </Link>
        </div>

        <div style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#111827" }}>
              {service.name}
            </div>
            <div
              style={{
                fontSize: 13,
                fontWeight: 800,
                color: "#111827",
                background: "#f3f4f6",
                border: "1px solid #e5e7eb",
                padding: "6px 10px",
                borderRadius: 999,
                height: "fit-content",
                whiteSpace: "nowrap",
              }}
            >
              {formatServicePrice(service)}
            </div>
          </div>

          <div style={{ ...muted, marginTop: 10, lineHeight: 1.6, fontSize: 14 }}>
            {service.description}
          </div>
          <div style={{ marginTop: 10, fontSize: 13, color: "#374151" }}>
            Consultation:{" "}
            {!service.consultation_fee || Number(service.consultation_fee) === 0
              ? "Free"
              : `$${service.consultation_fee}`}
          </div>

          {error && !showMessageForm && !showBookingForm && (
            <div
              style={{
                marginTop: 14,
                fontSize: 13,
                color: "#b91c1c",
                background: "#fef2f2",
                border: "1px solid #fecaca",
                padding: 10,
                borderRadius: 8,
              }}
            >
              {error}
            </div>
          )}

          <div style={{ marginTop: 18, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button type="button" className="btn btn-primary" onClick={openMessageForm}>
              Message about this service
            </button>

            <button type="button" className="btn btn-secondary" onClick={openBookingForm}>
              Request Consultation
            </button>

            <Link to={`/accountants/${service.accountant}`} className="btn btn-secondary">
              View accountant profile
            </Link>
          </div>

          {showMessageForm && (
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
                <h3 style={{ marginTop: 0 }}>Message about this service</h3>
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
                  <div style={{ marginBottom: 12, fontSize: 13, color: "#b91c1c" }}>
                    {error}
                  </div>
                )}
                <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={closeMessageForm}
                    disabled={loading}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={sendMessage}
                    disabled={loading || !messageText.trim()}
                  >
                    {loading ? "Sending..." : "Send"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {showBookingForm && (
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
                <h3 style={{ marginTop: 0 }}>Request Consultation</h3>
                <p style={{ ...muted, fontSize: 13 }}>
                  30-minute consultation. Service is already selected for this page.
                </p>
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
                    style={{
                      width: "100%",
                      marginTop: 6,
                      marginBottom: 16,
                      boxSizing: "border-box",
                    }}
                  />
                </label>
                {error && (
                  <div style={{ marginBottom: 12, fontSize: 13, color: "#b91c1c" }}>
                    {error}
                  </div>
                )}
                <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                  <button type="button" className="btn btn-secondary" onClick={closeBookingForm} disabled={loading}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={createBookingRequest}
                    disabled={loading || !bookingDate || !bookingNote.trim()}
                  >
                    {loading ? "Submitting..." : "Request Consultation"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

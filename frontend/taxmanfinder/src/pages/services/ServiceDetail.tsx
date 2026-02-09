import { useParams, useNavigate, Link } from "react-router-dom";
import { useEffect, useState } from "react";

type Service = {
  id: number;
  name: string;
  description: string;
  price: string;
  accountant: number;
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

export default function ServiceDetail() {
  const { serviceId } = useParams();
  const navigate = useNavigate();
  const [service, setService] = useState<Service | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const token = localStorage.getItem("access_token");

  useEffect(() => {
    fetch(`http://127.0.0.1:8000/services/${serviceId}/`)
      .then((r) => r.json())
      .then(setService)
      .catch(console.error);
  }, [serviceId]);

  async function contactAccountant() {
    if (!token) {
      navigate("/login");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("http://127.0.0.1:8000/api/inquiries/create/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ service_id: Number(serviceId) }),
      });

      if (!res.ok) throw new Error(await res.text());

      const data = await res.json();
      navigate(`/chat/${data.conversation_id}`);
    } catch (e: any) {
      setError("Could not start chat. Please try again.");
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  if (!service) return <div style={{ padding: 24 }}>Loading…</div>;

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
              ${service.price}
            </div>
          </div>

          <div style={{ ...muted, marginTop: 10, lineHeight: 1.6, fontSize: 14 }}>
            {service.description}
          </div>

          {error && (
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

          <div style={{ marginTop: 18, display: "flex", gap: 10 }}>
            <button
              onClick={contactAccountant}
              disabled={loading}
              style={{
                padding: "10px 14px",
                borderRadius: 10,
                border: "none",
                background: loading ? "#93c5fd" : "#2563eb",
                color: "#fff",
                fontWeight: 700,
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              {loading ? "Starting chat..." : "Contact accountant"}
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

          <div style={{ marginTop: 14, fontSize: 12, ...muted }}>
            Clicking “Contact accountant” creates an inquiry and opens a chat.
          </div>
        </div>
      </div>
    </div>
  );
}

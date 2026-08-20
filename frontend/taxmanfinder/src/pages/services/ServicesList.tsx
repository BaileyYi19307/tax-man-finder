import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listPublicServices } from "../../api/client";
import { formatServicePrice, type CatalogService } from "./serviceDisplay";

const page = {
  minHeight: "100vh",
  background: "#f8fafc",
  padding: "32px 16px",
};

const container = {
  maxWidth: 960,
  margin: "0 auto",
};

const card = {
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  padding: 16,
  boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
};

const muted = { color: "#6b7280" };

export default function ServicesList() {
  const [services, setServices] = useState<CatalogService[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    listPublicServices()
      .then((rows) => {
        if (!cancelled) {
          setServices(rows);
          setError(null);
        }
      })
      .catch((e) => {
        console.error(e);
        if (!cancelled) {
          setServices([]);
          setError("Could not load services.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div style={page}>
      <div style={container}>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            marginBottom: 16,
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#111827" }}>
              Services
            </div>
            <div style={{ ...muted, fontSize: 13, marginTop: 4 }}>
              Active listings from accountants. For discovery, start at{" "}
              <Link to="/accountants" style={{ color: "#2563eb" }}>
                Browse accountants
              </Link>
              .
            </div>
          </div>

          <Link
            to="/accountants"
            style={{
              fontSize: 13,
              textDecoration: "none",
              color: "#2563eb",
              fontWeight: 600,
            }}
          >
            Browse accountants →
          </Link>
        </div>

        {loading && <div style={{ ...muted, fontSize: 13 }}>Loading services…</div>}
        {error && (
          <div style={{ color: "#b91c1c", fontSize: 13, marginBottom: 12 }}>
            {error}{" "}
            <Link to="/accountants" style={{ color: "#2563eb" }}>
              Browse accountants
            </Link>
          </div>
        )}
        {!loading && !error && services.length === 0 && (
          <div style={{ ...muted, fontSize: 14 }}>
            No active services are listed yet.{" "}
            <Link to="/accountants" style={{ color: "#2563eb" }}>
              Browse accountants
            </Link>
          </div>
        )}

        {!loading && !error && services.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
            {services.map((s) => (
              <div key={s.id} style={card}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "#111827" }}>
                    {s.name}
                  </div>

                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: "#111827",
                      background: "#f3f4f6",
                      border: "1px solid #e5e7eb",
                      padding: "4px 8px",
                      borderRadius: 999,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {formatServicePrice(s)}
                  </div>
                </div>

                <div style={{ ...muted, fontSize: 13, marginTop: 8, lineHeight: 1.4 }}>
                  {s.description}
                </div>

                <div style={{ marginTop: 14 }}>
                  <Link
                    to={`/services/${s.id}`}
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
                    View details
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}

        <style>
          {`
            @media (max-width: 820px) {
              div[style*="grid-template-columns: repeat(2, 1fr)"] {
                grid-template-columns: 1fr !important;
              }
            }
          `}
        </style>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getMyServices } from "../../api/client";
import { loginPath } from "../../auth/intent";
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

export default function MyServices() {
  const navigate = useNavigate();
  const token = localStorage.getItem("access_token");
  const [services, setServices] = useState<CatalogService[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      if (!token) {
        navigate(loginPath({ next: "/dashboard/services" }), { replace: true });
        return;
      }
      try {
        setLoading(true);
        setError(null);
        setServices(await getMyServices());
      } catch (e) {
        console.error(e);
        setError("Could not load your services.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [navigate, token]);

  return (
    <div style={page}>
      <div style={container}>
        <Link to="/dashboard/accountant" style={{ fontSize: 13, color: "#2563eb", textDecoration: "none" }}>
          ← Dashboard
        </Link>
        <div style={{ fontSize: 22, fontWeight: 700, color: "#111827", marginTop: 12 }}>
          My Services
        </div>
        <div style={{ ...muted, fontSize: 13, marginTop: 4, marginBottom: 16 }}>
          Services listed under your accountant profile.
        </div>

        {loading && <div style={{ ...muted, fontSize: 13 }}>Loading…</div>}
        {error && <div style={{ color: "#b91c1c", fontSize: 13, marginBottom: 12 }}>{error}</div>}

        {!loading && !error && services.length === 0 && (
          <div style={{ ...muted, fontSize: 14 }}>
            You have not listed any services yet.
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
      </div>
    </div>
  );
}

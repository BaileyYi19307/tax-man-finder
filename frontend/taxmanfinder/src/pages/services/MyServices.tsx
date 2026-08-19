import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getMyServices, updateMyService, createMyService } from "../../api/client";
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

const field = {
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid #d1d5db",
  fontSize: 14,
  outline: "none" as const,
  width: "100%",
  boxSizing: "border-box" as const,
};

export default function MyServices() {
  const navigate = useNavigate();
  const token = localStorage.getItem("access_token");
  const [services, setServices] = useState<CatalogService[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [createName, setCreateName] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);

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

  function startEdit(service: CatalogService) {
    setEditingId(service.id);
    setName(service.name);
    setDescription(service.description);
    setPrice(service.indicative_price || "");
    setSaveError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setSaveError(null);
  }

  function startCreate() {
    setShowCreateForm(true);
    setEditingId(null);
    setCreateName("");
    setCreateDescription("");
    setCreateError(null);
  }

  function cancelCreate() {
    setShowCreateForm(false);
    setCreateError(null);
  }

  async function saveCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!createName.trim() || !createDescription.trim()) {
      setCreateError("Name and description are required.");
      return;
    }
    setSaving(true);
    setCreateError(null);
    try {
      const created = await createMyService({
        name: createName.trim(),
        description: createDescription.trim(),
        pricing_type: "consultation_required",
      });
      setServices((rows) => [...rows, created].sort((a, b) => a.name.localeCompare(b.name)));
      setShowCreateForm(false);
      setCreateName("");
      setCreateDescription("");
    } catch (err) {
      console.error(err);
      setCreateError("Could not create this service. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function saveEdit(service: CatalogService) {
    if (!name.trim() || !description.trim()) {
      setSaveError("Name and description are required.");
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const body: {
        name: string;
        description: string;
        indicative_price?: string | null;
      } = {
        name: name.trim(),
        description: description.trim(),
      };
      if (service.pricing_type !== "consultation_required") {
        body.indicative_price = price.trim() || null;
      }
      const updated = await updateMyService(service.id, body);
      setServices((rows) => rows.map((row) => (row.id === service.id ? updated : row)));
      setEditingId(null);
    } catch (e) {
      console.error(e);
      setSaveError("Could not save this service. Please try again.");
    } finally {
      setSaving(false);
    }
  }

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
          Manage the services listed on your public profile.
        </div>

        {!loading && !error && (
          <div style={{ marginBottom: 16 }}>
            {!showCreateForm ? (
              <button
                type="button"
                onClick={startCreate}
                disabled={editingId !== null}
                style={{
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: "none",
                  background: editingId !== null ? "#93c5fd" : "#2563eb",
                  color: "#fff",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: editingId !== null ? "not-allowed" : "pointer",
                }}
              >
                Add service
              </button>
            ) : (
              <form
                onSubmit={saveCreate}
                style={{ ...card, display: "grid", gap: 10, marginBottom: 0 }}
              >
                <div style={{ fontWeight: 700, color: "#111827" }}>New service</div>
                <label style={{ fontSize: 13, color: "#111827" }}>
                  Name
                  <input
                    value={createName}
                    onChange={(e) => setCreateName(e.target.value)}
                    required
                    style={{ ...field, marginTop: 6 }}
                  />
                </label>
                <label style={{ fontSize: 13, color: "#111827" }}>
                  Description
                  <textarea
                    value={createDescription}
                    onChange={(e) => setCreateDescription(e.target.value)}
                    required
                    rows={3}
                    style={{ ...field, marginTop: 6, resize: "vertical" }}
                  />
                </label>
                {createError && (
                  <div style={{ color: "#b91c1c", fontSize: 13 }}>{createError}</div>
                )}
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="submit"
                    disabled={saving}
                    style={{
                      padding: "8px 10px",
                      borderRadius: 8,
                      border: "none",
                      background: saving ? "#93c5fd" : "#2563eb",
                      color: "#fff",
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: saving ? "not-allowed" : "pointer",
                    }}
                  >
                    {saving ? "Creating..." : "Create service"}
                  </button>
                  <button type="button" onClick={cancelCreate} disabled={saving}>
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {loading && <div style={{ ...muted, fontSize: 13 }}>Loading…</div>}
        {error && <div style={{ color: "#b91c1c", fontSize: 13, marginBottom: 12 }}>{error}</div>}

        {!loading && !error && services.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
            {services.map((s) => (
              <div key={s.id} style={card}>
                {editingId === s.id ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      void saveEdit(s);
                    }}
                    style={{ display: "grid", gap: 10 }}
                  >
                    <label style={{ fontSize: 13, color: "#111827" }}>
                      Name
                      <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        style={{ ...field, marginTop: 6 }}
                      />
                    </label>
                    <label style={{ fontSize: 13, color: "#111827" }}>
                      Description
                      <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        required
                        rows={3}
                        style={{ ...field, marginTop: 6, resize: "vertical" }}
                      />
                    </label>
                    {s.pricing_type !== "consultation_required" && (
                      <label style={{ fontSize: 13, color: "#111827" }}>
                        Indicative price
                        <input
                          value={price}
                          onChange={(e) => setPrice(e.target.value)}
                          placeholder="Optional"
                          style={{ ...field, marginTop: 6 }}
                        />
                      </label>
                    )}
                    {saveError && (
                      <div style={{ color: "#b91c1c", fontSize: 13 }}>{saveError}</div>
                    )}
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        type="submit"
                        disabled={saving}
                        style={{
                          padding: "8px 10px",
                          borderRadius: 8,
                          border: "none",
                          background: saving ? "#93c5fd" : "#2563eb",
                          color: "#fff",
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: saving ? "not-allowed" : "pointer",
                        }}
                      >
                        {saving ? "Saving..." : "Save"}
                      </button>
                      <button type="button" onClick={cancelEdit} disabled={saving}>
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <>
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
                    <div style={{ marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button
                        type="button"
                        onClick={() => startEdit(s)}
                        style={{
                          padding: "8px 10px",
                          borderRadius: 8,
                          border: "1px solid #e5e7eb",
                          background: "#fff",
                          color: "#111827",
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        Edit
                      </button>
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
                  </>
                )}
              </div>
            ))}
          </div>
        )}

        {!loading && !error && services.length === 0 && !showCreateForm && (
          <div style={{ ...muted, fontSize: 14 }}>
            You have not listed any services yet.
          </div>
        )}
      </div>
    </div>
  );
}

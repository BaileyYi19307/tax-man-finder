import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  apiFieldError,
  getMyServices,
  updateMyService,
  createMyService,
  deactivateMyService,
  listServiceCategories,
  type ServiceCategory,
} from "../../api/client";
import { loginPath } from "../../auth/intent";
import { formatServicePrice, type CatalogService } from "./serviceDisplay";
import ServiceCategorySelect from "./ServiceCategorySelect";
import { categorySelectValue } from "./serviceCategoryUi";

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
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [consultationFee, setConsultationFee] = useState("");
  const [cancellationPolicy, setCancellationPolicy] = useState("");
  const [consultationPaid, setConsultationPaid] = useState(false);
  const [editCategoryId, setEditCategoryId] = useState("");
  const [editCategoryError, setEditCategoryError] = useState<string | null>(null);
  const [createName, setCreateName] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createConsultationFee, setCreateConsultationFee] = useState("");
  const [createCancellationPolicy, setCreateCancellationPolicy] = useState("");
  const [createConsultationPaid, setCreateConsultationPaid] = useState(false);
  const [createCategoryId, setCreateCategoryId] = useState("");
  const [createCategoryError, setCreateCategoryError] = useState<string | null>(
    null
  );
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);

  const loadCategories = useCallback(async () => {
    try {
      setCategoriesLoading(true);
      setCategoriesError(null);
      setCategories(await listServiceCategories());
    } catch (e) {
      console.error(e);
      setCategories([]);
      setCategoriesError(
        "Could not load service categories. Check your connection and try again."
      );
    } finally {
      setCategoriesLoading(false);
    }
  }, []);

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

  useEffect(() => {
    if (!token) return;
    void loadCategories();
  }, [token, loadCategories]);

  const categoryControlsBlocked =
    categoriesLoading || Boolean(categoriesError) || categories.length === 0;

  function startEdit(service: CatalogService) {
    setEditingId(service.id);
    setName(service.name);
    setDescription(service.description);
    setPrice(service.indicative_price || "");
    const paid =
      service.consultation_fee != null && Number(service.consultation_fee) > 0;
    setConsultationPaid(paid);
    setConsultationFee(paid ? service.consultation_fee || "" : "");
    setCancellationPolicy(service.cancellation_policy || "");
    setEditCategoryId(categorySelectValue(service.category, categories));
    setEditCategoryError(null);
    setSaveError(null);
    setSaveSuccess(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setSaveError(null);
    setEditCategoryError(null);
  }

  function startCreate() {
    setShowCreateForm(true);
    setEditingId(null);
    setCreateName("");
    setCreateDescription("");
    setCreateConsultationPaid(false);
    setCreateConsultationFee("");
    setCreateCancellationPolicy("");
    setCreateCategoryId("");
    setCreateCategoryError(null);
    setCreateError(null);
    setSaveSuccess(null);
  }

  function cancelCreate() {
    setShowCreateForm(false);
    setCreateError(null);
    setCreateCategoryError(null);
  }

  async function saveCreate(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    if (!createName.trim() || !createDescription.trim()) {
      setCreateError("Name and description are required.");
      return;
    }
    if (!createCategoryId) {
      setCreateCategoryError("Select a service category.");
      setCreateError(null);
      return;
    }
    if (createConsultationPaid) {
      const fee = Number(createConsultationFee);
      if (!createConsultationFee.trim() || Number.isNaN(fee) || fee <= 0) {
        setCreateError(
          "Enter a consultation fee greater than 0 for paid consultations."
        );
        return;
      }
    }
    setSaving(true);
    setCreateError(null);
    setCreateCategoryError(null);
    setSaveSuccess(null);
    try {
      const created = await createMyService({
        name: createName.trim(),
        description: createDescription.trim(),
        pricing_type: "consultation_required",
        consultation_is_paid: createConsultationPaid,
        consultation_fee: createConsultationPaid
          ? createConsultationFee.trim()
          : "0.00",
        cancellation_policy: createCancellationPolicy.trim(),
        category_id: Number(createCategoryId),
      });
      setServices((rows) =>
        [...rows, created].sort((a, b) => a.name.localeCompare(b.name))
      );
      setShowCreateForm(false);
      setCreateName("");
      setCreateDescription("");
      setCreateConsultationPaid(false);
      setCreateConsultationFee("");
      setCreateCancellationPolicy("");
      setCreateCategoryId("");
      setSaveSuccess("Service saved.");
    } catch (err) {
      console.error(err);
      setSaveSuccess(null);
      const categoryMessage = apiFieldError(err, "category_id");
      if (categoryMessage) {
        setCreateCategoryError(categoryMessage);
        setCreateError(null);
      } else {
        setCreateError(
          err instanceof Error
            ? err.message
            : "Could not create this service. Please try again."
        );
      }
    } finally {
      setSaving(false);
    }
  }

  async function removeService(service: CatalogService) {
    if (
      !window.confirm(
        `Remove "${service.name}" from your public profile? Clients will no longer see this service.`
      )
    ) {
      return;
    }
    setRemovingId(service.id);
    setRemoveError(null);
    try {
      const updated = await deactivateMyService(service.id);
      setServices((rows) =>
        rows.map((row) => (row.id === service.id ? updated : row))
      );
      if (editingId === service.id) {
        setEditingId(null);
      }
    } catch (err) {
      console.error(err);
      setRemoveError(
        err instanceof Error
          ? err.message
          : "Could not remove this service. Please try again."
      );
    } finally {
      setRemovingId(null);
    }
  }

  async function saveEdit(service: CatalogService) {
    if (saving) return;
    if (!name.trim() || !description.trim()) {
      setSaveError("Name and description are required.");
      return;
    }
    if (!editCategoryId) {
      setEditCategoryError("Select a service category.");
      setSaveError(null);
      return;
    }
    if (consultationPaid) {
      const fee = Number(consultationFee);
      if (!consultationFee.trim() || Number.isNaN(fee) || fee <= 0) {
        setSaveError(
          "Enter a consultation fee greater than 0 for paid consultations."
        );
        return;
      }
    }
    setSaving(true);
    setSaveError(null);
    setEditCategoryError(null);
    setSaveSuccess(null);
    try {
      const body: {
        name: string;
        description: string;
        indicative_price?: string | null;
        consultation_fee?: string | null;
        consultation_is_paid?: boolean;
        cancellation_policy?: string;
        category_id: number;
      } = {
        name: name.trim(),
        description: description.trim(),
        consultation_is_paid: consultationPaid,
        consultation_fee: consultationPaid ? consultationFee.trim() : "0.00",
        cancellation_policy: cancellationPolicy.trim(),
        category_id: Number(editCategoryId),
      };
      if (service.pricing_type !== "consultation_required") {
        body.indicative_price = price.trim() || null;
      }
      const updated = await updateMyService(service.id, body);
      setServices((rows) =>
        rows.map((row) => (row.id === service.id ? updated : row))
      );
      setEditingId(null);
      setSaveSuccess("Service saved.");
    } catch (e) {
      console.error(e);
      setSaveSuccess(null);
      const categoryMessage = apiFieldError(e, "category_id");
      if (categoryMessage) {
        setEditCategoryError(categoryMessage);
        setSaveError(null);
      } else {
        setSaveError(
          e instanceof Error
            ? e.message
            : "Could not save this service. Please try again."
        );
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={page}>
      <div style={container}>
        <Link
          to="/dashboard/accountant"
          style={{ fontSize: 13, color: "#2563eb", textDecoration: "none" }}
        >
          ← Dashboard
        </Link>
        <div
          style={{ fontSize: 22, fontWeight: 700, color: "#111827", marginTop: 12 }}
        >
          My Services
        </div>
        <div style={{ ...muted, fontSize: 13, marginTop: 4, marginBottom: 16 }}>
          Manage the services listed on your public profile.
        </div>

        {saveSuccess && (
          <div
            role="status"
            style={{
              color: "#166534",
              background: "#f0fdf4",
              border: "1px solid #bbf7d0",
              borderRadius: 8,
              padding: 10,
              fontSize: 13,
              marginBottom: 16,
            }}
          >
            {saveSuccess}
          </div>
        )}

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
                <ServiceCategorySelect
                  selectId="create-service-category"
                  categories={categories}
                  loading={categoriesLoading}
                  loadError={categoriesError}
                  onRetry={() => void loadCategories()}
                  value={createCategoryId}
                  onChange={(next) => {
                    setCreateCategoryId(next);
                    setCreateCategoryError(null);
                  }}
                  fieldError={createCategoryError}
                  disabled={saving}
                />
                <fieldset style={{ border: "none", padding: 0, margin: 0 }}>
                  <legend style={{ fontSize: 13, color: "#111827", marginBottom: 6 }}>
                    Consultation
                  </legend>
                  <div style={{ display: "flex", gap: 16, fontSize: 14 }}>
                    <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <input
                        type="radio"
                        name="create-consultation-paid"
                        checked={!createConsultationPaid}
                        onChange={() => {
                          setCreateConsultationPaid(false);
                          setCreateConsultationFee("");
                        }}
                      />
                      Free
                    </label>
                    <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <input
                        type="radio"
                        name="create-consultation-paid"
                        checked={createConsultationPaid}
                        onChange={() => setCreateConsultationPaid(true)}
                      />
                      Paid
                    </label>
                  </div>
                </fieldset>
                {createConsultationPaid && (
                  <label style={{ fontSize: 13, color: "#111827" }}>
                    Consultation fee
                    <input
                      value={createConsultationFee}
                      onChange={(e) => setCreateConsultationFee(e.target.value)}
                      placeholder="50.00"
                      inputMode="decimal"
                      style={{ ...field, marginTop: 6 }}
                    />
                  </label>
                )}
                <label style={{ fontSize: 13, color: "#111827" }}>
                  Cancellation policy
                  <textarea
                    value={createCancellationPolicy}
                    onChange={(e) => setCreateCancellationPolicy(e.target.value)}
                    rows={2}
                    style={{ ...field, marginTop: 6, resize: "vertical" }}
                  />
                </label>
                {createError && (
                  <div style={{ color: "#b91c1c", fontSize: 13 }}>{createError}</div>
                )}
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="submit"
                    disabled={saving || categoryControlsBlocked}
                    style={{
                      padding: "8px 10px",
                      borderRadius: 8,
                      border: "none",
                      background:
                        saving || categoryControlsBlocked ? "#93c5fd" : "#2563eb",
                      color: "#fff",
                      fontSize: 13,
                      fontWeight: 600,
                      cursor:
                        saving || categoryControlsBlocked
                          ? "not-allowed"
                          : "pointer",
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
        {error && (
          <div style={{ color: "#b91c1c", fontSize: 13, marginBottom: 12 }}>
            {error}
          </div>
        )}
        {removeError && (
          <div style={{ color: "#b91c1c", fontSize: 13, marginBottom: 12 }}>
            {removeError}
          </div>
        )}

        {!loading && !error && services.length > 0 && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: 16,
            }}
          >
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
                    <ServiceCategorySelect
                      selectId={`edit-service-category-${s.id}`}
                      categories={categories}
                      loading={categoriesLoading}
                      loadError={categoriesError}
                      onRetry={() => void loadCategories()}
                      value={editCategoryId}
                      onChange={(next) => {
                        setEditCategoryId(next);
                        setEditCategoryError(null);
                      }}
                      fieldError={editCategoryError}
                      disabled={saving}
                    />
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
                    <fieldset style={{ border: "none", padding: 0, margin: 0 }}>
                      <legend
                        style={{ fontSize: 13, color: "#111827", marginBottom: 6 }}
                      >
                        Consultation
                      </legend>
                      <div style={{ display: "flex", gap: 16, fontSize: 14 }}>
                        <label
                          style={{ display: "flex", gap: 6, alignItems: "center" }}
                        >
                          <input
                            type="radio"
                            name={`edit-consultation-paid-${s.id}`}
                            checked={!consultationPaid}
                            onChange={() => {
                              setConsultationPaid(false);
                              setConsultationFee("");
                            }}
                          />
                          Free
                        </label>
                        <label
                          style={{ display: "flex", gap: 6, alignItems: "center" }}
                        >
                          <input
                            type="radio"
                            name={`edit-consultation-paid-${s.id}`}
                            checked={consultationPaid}
                            onChange={() => setConsultationPaid(true)}
                          />
                          Paid
                        </label>
                      </div>
                    </fieldset>
                    {consultationPaid && (
                      <label style={{ fontSize: 13, color: "#111827" }}>
                        Consultation fee
                        <input
                          value={consultationFee}
                          onChange={(e) => setConsultationFee(e.target.value)}
                          placeholder="50.00"
                          inputMode="decimal"
                          style={{ ...field, marginTop: 6 }}
                        />
                      </label>
                    )}
                    <label style={{ fontSize: 13, color: "#111827" }}>
                      Cancellation policy
                      <textarea
                        value={cancellationPolicy}
                        onChange={(e) => setCancellationPolicy(e.target.value)}
                        rows={2}
                        style={{ ...field, marginTop: 6, resize: "vertical" }}
                      />
                    </label>
                    {saveError && (
                      <div style={{ color: "#b91c1c", fontSize: 13 }}>
                        {saveError}
                      </div>
                    )}
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        type="submit"
                        disabled={saving || categoryControlsBlocked}
                        style={{
                          padding: "8px 10px",
                          borderRadius: 8,
                          border: "none",
                          background:
                            saving || categoryControlsBlocked
                              ? "#93c5fd"
                              : "#2563eb",
                          color: "#fff",
                          fontSize: 13,
                          fontWeight: 600,
                          cursor:
                            saving || categoryControlsBlocked
                              ? "not-allowed"
                              : "pointer",
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
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 12,
                      }}
                    >
                      <div style={{ fontSize: 16, fontWeight: 700, color: "#111827" }}>
                        {s.name}
                      </div>
                      <div
                        style={{
                          display: "flex",
                          gap: 8,
                          flexWrap: "wrap",
                          justifyContent: "flex-end",
                        }}
                      >
                        {s.is_active === false && (
                          <div
                            style={{
                              fontSize: 12,
                              fontWeight: 700,
                              color: "#92400e",
                              background: "#fef3c7",
                              border: "1px solid #fcd34d",
                              padding: "4px 8px",
                              borderRadius: 999,
                              whiteSpace: "nowrap",
                            }}
                          >
                            Hidden
                          </div>
                        )}
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
                    </div>
                    <div
                      style={{ ...muted, fontSize: 13, marginTop: 8, lineHeight: 1.4 }}
                    >
                      {s.description}
                    </div>
                    {s.category?.name && (
                      <div style={{ ...muted, fontSize: 12, marginTop: 8 }}>
                        Category: {s.category.name}
                      </div>
                    )}
                    <div style={{ ...muted, fontSize: 12, marginTop: 8 }}>
                      Consultation:{" "}
                      {!s.consultation_fee || Number(s.consultation_fee) === 0
                        ? "Free"
                        : `$${s.consultation_fee}`}
                    </div>
                    <div
                      style={{
                        marginTop: 14,
                        display: "flex",
                        gap: 8,
                        flexWrap: "wrap",
                      }}
                    >
                      {s.is_active !== false && (
                        <>
                          <button
                            type="button"
                            onClick={() => startEdit(s)}
                            disabled={removingId !== null || showCreateForm}
                            style={{
                              padding: "8px 10px",
                              borderRadius: 8,
                              border: "1px solid #e5e7eb",
                              background: "#fff",
                              color: "#111827",
                              fontSize: 13,
                              fontWeight: 600,
                              cursor:
                                removingId !== null || showCreateForm
                                  ? "not-allowed"
                                  : "pointer",
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
                          <button
                            type="button"
                            onClick={() => void removeService(s)}
                            disabled={removingId === s.id}
                            style={{
                              padding: "8px 10px",
                              borderRadius: 8,
                              border: "1px solid #fecaca",
                              background: removingId === s.id ? "#fee2e2" : "#fff",
                              color: "#b91c1c",
                              fontSize: 13,
                              fontWeight: 600,
                              cursor:
                                removingId === s.id ? "not-allowed" : "pointer",
                            }}
                          >
                            {removingId === s.id ? "Removing..." : "Remove"}
                          </button>
                        </>
                      )}
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

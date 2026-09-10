import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  apiFieldError,
  getMyServices,
  updateMyService,
  createMyService,
  deactivateMyService,
  listServiceCategories,
  listCancellationPolicies,
  type CancellationPolicyCode,
  type CancellationPolicyOption,
  type ServiceCategory,
} from "../../api/client";
import { loginPath } from "../../auth/intent";
import { formatServicePrice, type CatalogService } from "./serviceDisplay";
import ServiceCategorySelect from "./ServiceCategorySelect";
import {
  categoryIdFromService,
  reconcileCategorySelectValue,
} from "./serviceCategoryUi";
import {
  CANCELLATION_POLICY_UNSET,
  CancellationPolicySelect,
  cancellationPolicySelectValue,
  hasCancellationPolicyCode,
} from "./cancellationPolicyUi";

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

const PRICING_TYPES: CatalogService["pricing_type"][] = [
  "consultation_required",
  "fixed",
  "hourly",
];

function pricingTypeLabel(value: CatalogService["pricing_type"]) {
  if (value === "fixed") return "Fixed price";
  if (value === "hourly") return "Hourly";
  return "Consultation required";
}

export type ServiceManagementPanelProps = {
  /** Path used when redirecting unauthenticated users to login. */
  loginNextPath?: string;
  addButtonLabel?: string;
  showViewDetailsLink?: boolean;
  emptyMessage?: string;
  /** When true, explain that an active service is required before publishing. */
  showPublishGuidance?: boolean;
  deactivateLabel?: string;
  onServicesChange?: (services: CatalogService[]) => void;
};

export default function ServiceManagementPanel({
  loginNextPath = "/dashboard/services",
  addButtonLabel = "Add service",
  showViewDetailsLink = true,
  emptyMessage = "You have not listed any services yet.",
  showPublishGuidance = false,
  deactivateLabel = "Remove",
  onServicesChange,
}: ServiceManagementPanelProps) {
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
  const [pricingType, setPricingType] =
    useState<CatalogService["pricing_type"]>("consultation_required");
  const [consultationFee, setConsultationFee] = useState("");
  const [cancellationPolicyCode, setCancellationPolicyCode] = useState(
    CANCELLATION_POLICY_UNSET
  );
  const [consultationPaid, setConsultationPaid] = useState(false);
  const [editCategoryId, setEditCategoryId] = useState("");
  const [editCategoryError, setEditCategoryError] = useState<string | null>(null);
  const [createName, setCreateName] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createPricingType, setCreatePricingType] =
    useState<CatalogService["pricing_type"]>("consultation_required");
  const [createPrice, setCreatePrice] = useState("");
  const [createConsultationFee, setCreateConsultationFee] = useState("");
  const [createCancellationPolicyCode, setCreateCancellationPolicyCode] = useState(
    CANCELLATION_POLICY_UNSET
  );
  const [createConsultationPaid, setCreateConsultationPaid] = useState(false);
  const [createCategoryId, setCreateCategoryId] = useState("");
  const [createCategoryError, setCreateCategoryError] = useState<string | null>(
    null
  );
  const [policyOptions, setPolicyOptions] = useState<CancellationPolicyOption[]>([]);
  const [policiesLoading, setPoliciesLoading] = useState(true);
  const [policiesError, setPoliciesError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createFieldErrors, setCreateFieldErrors] = useState<
    Record<string, string>
  >({});
  const [editFieldErrors, setEditFieldErrors] = useState<Record<string, string>>(
    {}
  );
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [reactivatingId, setReactivatingId] = useState<number | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);

  const setServicesAndNotify = useCallback(
    (next: CatalogService[] | ((rows: CatalogService[]) => CatalogService[])) => {
      setServices((current) => {
        const resolved = typeof next === "function" ? next(current) : next;
        queueMicrotask(() => onServicesChange?.(resolved));
        return resolved;
      });
    },
    [onServicesChange]
  );

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

  const loadPolicies = useCallback(async () => {
    try {
      setPoliciesLoading(true);
      setPoliciesError(null);
      setPolicyOptions(await listCancellationPolicies());
    } catch (e) {
      console.error(e);
      setPolicyOptions([]);
      setPoliciesError(
        "Could not load cancellation policies. Check your connection and try again."
      );
    } finally {
      setPoliciesLoading(false);
    }
  }, []);

  const loadServices = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const rows = await getMyServices();
      setServicesAndNotify(rows);
    } catch (e) {
      console.error(e);
      setError("Could not load your services.");
    } finally {
      setLoading(false);
    }
  }, [setServicesAndNotify]);

  useEffect(() => {
    if (!token) {
      navigate(loginPath({ next: loginNextPath }), { replace: true });
      return;
    }
    void loadServices();
  }, [navigate, token, loginNextPath, loadServices]);

  useEffect(() => {
    if (!token) return;
    void loadCategories();
  }, [token, loadCategories]);

  useEffect(() => {
    if (!token) return;
    void loadPolicies();
  }, [token, loadPolicies]);

  // After a successful category load, drop ids that are no longer assignable.
  // On load failure, keep editCategoryId so a retry can restore the selection.
  useEffect(() => {
    if (categoriesLoading || categoriesError) return;
    if (editingId == null) return;
    setEditCategoryId((current) =>
      reconcileCategorySelectValue(current, categories)
    );
  }, [categories, categoriesLoading, categoriesError, editingId]);

  const categoryControlsBlocked =
    categoriesLoading || Boolean(categoriesError) || categories.length === 0;

  const activeValidCount = services.filter(
    (s) => s.is_active !== false && Boolean(s.category?.id)
  ).length;

  function startEdit(service: CatalogService) {
    setEditingId(service.id);
    setShowCreateForm(false);
    setName(service.name);
    setDescription(service.description);
    setPricingType(service.pricing_type);
    setPrice(service.indicative_price || "");
    const paid =
      service.consultation_fee != null && Number(service.consultation_fee) > 0;
    setConsultationPaid(paid);
    setConsultationFee(paid ? service.consultation_fee || "" : "");
    setCancellationPolicyCode(
      cancellationPolicySelectValue(service.cancellation_policy_code)
    );
    setEditCategoryId(categoryIdFromService(service.category));
    setEditCategoryError(null);
    setSaveError(null);
    setEditFieldErrors({});
    setSaveSuccess(null);
    setRemoveError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setSaveError(null);
    setEditCategoryError(null);
    setEditFieldErrors({});
    setRemoveError(null);
  }

  function startCreate() {
    setShowCreateForm(true);
    setEditingId(null);
    setCreateName("");
    setCreateDescription("");
    setCreatePricingType("consultation_required");
    setCreatePrice("");
    setCreateConsultationPaid(false);
    setCreateConsultationFee("");
    setCreateCancellationPolicyCode(CANCELLATION_POLICY_UNSET);
    setCreateCategoryId("");
    setCreateCategoryError(null);
    setCreateError(null);
    setCreateFieldErrors({});
    setSaveSuccess(null);
  }

  function cancelCreate() {
    setShowCreateForm(false);
    setCreateError(null);
    setCreateCategoryError(null);
    setCreateFieldErrors({});
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
    if (!hasCancellationPolicyCode(createCancellationPolicyCode)) {
      setCreateFieldErrors({
        cancellation_policy_code: "Select a cancellation policy.",
      });
      setCreateError(null);
      return;
    }
    if (createConsultationPaid) {
      const fee = Number(createConsultationFee);
      if (!createConsultationFee.trim() || Number.isNaN(fee) || fee <= 0) {
        setCreateError(
          "Enter a consultation fee greater than 0 for billable consultations."
        );
        return;
      }
    }
    setSaving(true);
    setCreateError(null);
    setCreateCategoryError(null);
    setCreateFieldErrors({});
    setSaveSuccess(null);
    try {
      const body: Parameters<typeof createMyService>[0] = {
        name: createName.trim(),
        description: createDescription.trim(),
        pricing_type: createPricingType,
        consultation_is_paid: createConsultationPaid,
        consultation_fee: createConsultationPaid
          ? createConsultationFee.trim()
          : "0.00",
        cancellation_policy_code:
          createCancellationPolicyCode as CancellationPolicyCode,
        category_id: Number(createCategoryId),
      };
      if (createPricingType !== "consultation_required") {
        body.indicative_price = createPrice.trim() || null;
      }
      const created = await createMyService(body);
      setServicesAndNotify((rows) =>
        [...rows, created].sort((a, b) => a.name.localeCompare(b.name))
      );
      setShowCreateForm(false);
      setCreateName("");
      setCreateDescription("");
      setCreatePricingType("consultation_required");
      setCreatePrice("");
      setCreateConsultationPaid(false);
      setCreateConsultationFee("");
      setCreateCancellationPolicyCode(CANCELLATION_POLICY_UNSET);
      setCreateCategoryId("");
      setSaveSuccess("Service saved.");
    } catch (err) {
      console.error(err);
      setSaveSuccess(null);
      const categoryMessage = apiFieldError(err, "category_id");
      if (categoryMessage) {
        setCreateCategoryError(categoryMessage);
        setCreateError(null);
      } else if (err && typeof err === "object" && "fields" in err) {
        const fields = (err as { fields?: Record<string, string> }).fields || {};
        setCreateFieldErrors(fields);
        setCreateError(
          err instanceof Error
            ? err.message
            : "Could not create this service. Please try again."
        );
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
      setServicesAndNotify((rows) =>
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

  async function reactivateService(service: CatalogService) {
    if (reactivatingId != null) return;
    if (!hasCancellationPolicyCode(service.cancellation_policy_code)) {
      startEdit(service);
      setRemoveError(
        "Select a cancellation policy before reactivating this service."
      );
      return;
    }
    setReactivatingId(service.id);
    setRemoveError(null);
    try {
      const updated = await updateMyService(service.id, { is_active: true });
      setServicesAndNotify((rows) =>
        rows.map((row) => (row.id === service.id ? updated : row))
      );
      setSaveSuccess("Service reactivated.");
    } catch (err) {
      console.error(err);
      setRemoveError(
        err instanceof Error
          ? err.message
          : "Could not reactivate this service. Please try again."
      );
    } finally {
      setReactivatingId(null);
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
    if (!hasCancellationPolicyCode(cancellationPolicyCode)) {
      setEditFieldErrors({
        cancellation_policy_code: "Select a cancellation policy.",
      });
      setSaveError(null);
      return;
    }
    if (consultationPaid) {
      const fee = Number(consultationFee);
      if (!consultationFee.trim() || Number.isNaN(fee) || fee <= 0) {
        setSaveError(
          "Enter a consultation fee greater than 0 for billable consultations."
        );
        return;
      }
    }
    setSaving(true);
    setSaveError(null);
    setEditCategoryError(null);
    setEditFieldErrors({});
    setSaveSuccess(null);
    try {
      const body: {
        name: string;
        description: string;
        pricing_type: CatalogService["pricing_type"];
        indicative_price?: string | null;
        consultation_fee?: string | null;
        consultation_is_paid?: boolean;
        cancellation_policy_code: CancellationPolicyCode;
        category_id: number;
        is_active?: boolean;
      } = {
        name: name.trim(),
        description: description.trim(),
        pricing_type: pricingType,
        consultation_is_paid: consultationPaid,
        consultation_fee: consultationPaid ? consultationFee.trim() : "0.00",
        cancellation_policy_code: cancellationPolicyCode as CancellationPolicyCode,
        category_id: Number(editCategoryId),
      };
      if (pricingType !== "consultation_required") {
        body.indicative_price = price.trim() || null;
      }
      if (service.is_active === false) {
        body.is_active = true;
      }
      const updated = await updateMyService(service.id, body);
      setServicesAndNotify((rows) =>
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
      } else if (e && typeof e === "object" && "fields" in e) {
        const fields = (e as { fields?: Record<string, string> }).fields || {};
        setEditFieldErrors(fields);
        setSaveError(
          e instanceof Error
            ? e.message
            : "Could not save this service. Please try again."
        );
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

  function fieldError(message?: string) {
    if (!message) return null;
    return <div style={{ color: "#b91c1c", fontSize: 12, marginTop: 4 }}>{message}</div>;
  }

  return (
    <div>
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

      {showPublishGuidance && !loading && !error && activeValidCount === 0 && (
        <div
          style={{
            ...muted,
            fontSize: 13,
            marginBottom: 16,
            background: "#fffbeb",
            border: "1px solid #fde68a",
            borderRadius: 8,
            padding: 10,
            color: "#92400e",
          }}
        >
          At least one active service in a public category is required before
          publishing. You can still save this draft and finish later.
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
                padding: "10px 14px",
                borderRadius: 8,
                border: "none",
                background: editingId !== null ? "#93c5fd" : "#2563eb",
                color: "#fff",
                fontSize: 14,
                fontWeight: 700,
                cursor: editingId !== null ? "not-allowed" : "pointer",
              }}
            >
              {addButtonLabel}
            </button>
          ) : (
            <form
              onSubmit={saveCreate}
              style={{ ...card, display: "grid", gap: 10, marginBottom: 0 }}
            >
              <div style={{ fontWeight: 700, color: "#111827" }}>New service</div>
              <div>
                <label style={{ fontSize: 13, color: "#111827", display: "block" }}>
                  Name
                  <input
                    value={createName}
                    onChange={(e) => setCreateName(e.target.value)}
                    required
                    aria-invalid={Boolean(createFieldErrors.name)}
                    style={{ ...field, marginTop: 6 }}
                  />
                </label>
                {fieldError(createFieldErrors.name)}
              </div>
              <div>
                <label style={{ fontSize: 13, color: "#111827", display: "block" }}>
                  Description
                  <textarea
                    value={createDescription}
                    onChange={(e) => setCreateDescription(e.target.value)}
                    required
                    rows={3}
                    aria-invalid={Boolean(createFieldErrors.description)}
                    style={{ ...field, marginTop: 6, resize: "vertical" }}
                  />
                </label>
                {fieldError(createFieldErrors.description)}
              </div>
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
              <label style={{ fontSize: 13, color: "#111827" }}>
                Pricing type
                <select
                  value={createPricingType}
                  onChange={(e) =>
                    setCreatePricingType(
                      e.target.value as CatalogService["pricing_type"]
                    )
                  }
                  style={{ ...field, marginTop: 6 }}
                  disabled={saving}
                >
                  {PRICING_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {pricingTypeLabel(type)}
                    </option>
                  ))}
                </select>
              </label>
              {createPricingType !== "consultation_required" && (
                <label style={{ fontSize: 13, color: "#111827" }}>
                  Indicative price
                  <span style={{ ...muted, marginLeft: 6, fontSize: 12 }}>
                    (optional)
                  </span>
                  <input
                    value={createPrice}
                    onChange={(e) => setCreatePrice(e.target.value)}
                    placeholder="Optional"
                    style={{ ...field, marginTop: 6 }}
                  />
                </label>
              )}
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
                    Billable
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
              <CancellationPolicySelect
                id="create-cancellation-policy"
                value={createCancellationPolicyCode}
                options={policyOptions}
                disabled={saving || policiesLoading || Boolean(policiesError)}
                error={
                  createFieldErrors.cancellation_policy_code ||
                  policiesError ||
                  null
                }
                onChange={(next) => {
                  setCreateCancellationPolicyCode(next);
                  setCreateFieldErrors((prev) => {
                    const { cancellation_policy_code: _removed, ...rest } = prev;
                    return rest;
                  });
                }}
              />
              {createError && (
                <div role="alert" style={{ color: "#b91c1c", fontSize: 13 }}>
                  {createError}
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
        <div style={{ marginBottom: 12 }}>
          <div style={{ color: "#b91c1c", fontSize: 13, marginBottom: 8 }}>
            {error}
          </div>
          <button
            type="button"
            onClick={() => void loadServices()}
            style={{
              padding: "8px 10px",
              borderRadius: 8,
              border: "1px solid #d1d5db",
              background: "#fff",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Retry
          </button>
        </div>
      )}
      {removeError && (
        <div role="alert" style={{ color: "#b91c1c", fontSize: 13, marginBottom: 12 }}>
          {removeError}
        </div>
      )}

      {!loading && !error && services.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 16,
          }}
        >
          {services.map((s) => (
            <div key={s.id} style={card} data-testid={`service-card-${s.id}`}>
              {editingId === s.id ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void saveEdit(s);
                  }}
                  style={{ display: "grid", gap: 10 }}
                >
                  <div>
                    <label style={{ fontSize: 13, color: "#111827", display: "block" }}>
                      Name
                      <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        aria-invalid={Boolean(editFieldErrors.name)}
                        style={{ ...field, marginTop: 6 }}
                      />
                    </label>
                    {fieldError(editFieldErrors.name)}
                  </div>
                  <div>
                    <label style={{ fontSize: 13, color: "#111827", display: "block" }}>
                      Description
                      <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        required
                        rows={3}
                        aria-invalid={Boolean(editFieldErrors.description)}
                        style={{ ...field, marginTop: 6, resize: "vertical" }}
                      />
                    </label>
                    {fieldError(editFieldErrors.description)}
                  </div>
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
                  <label style={{ fontSize: 13, color: "#111827" }}>
                    Pricing type
                    <select
                      value={pricingType}
                      onChange={(e) =>
                        setPricingType(
                          e.target.value as CatalogService["pricing_type"]
                        )
                      }
                      style={{ ...field, marginTop: 6 }}
                      disabled={saving}
                    >
                      {PRICING_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {pricingTypeLabel(type)}
                        </option>
                      ))}
                    </select>
                  </label>
                  {pricingType !== "consultation_required" && (
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
                        Billable
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
                  <CancellationPolicySelect
                    id={`edit-cancellation-policy-${s.id}`}
                    value={cancellationPolicyCode}
                    options={policyOptions}
                    disabled={saving || policiesLoading || Boolean(policiesError)}
                    error={
                      editFieldErrors.cancellation_policy_code ||
                      policiesError ||
                      null
                    }
                    onChange={(next) => {
                      setCancellationPolicyCode(next);
                      setEditFieldErrors((prev) => {
                        const { cancellation_policy_code: _removed, ...rest } =
                          prev;
                        return rest;
                      });
                    }}
                  />
                  {saveError && (
                    <div role="alert" style={{ color: "#b91c1c", fontSize: 13 }}>
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
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: s.is_active === false ? "#92400e" : "#166534",
                          background: s.is_active === false ? "#fef3c7" : "#f0fdf4",
                          border:
                            s.is_active === false
                              ? "1px solid #fcd34d"
                              : "1px solid #bbf7d0",
                          padding: "4px 8px",
                          borderRadius: 999,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {s.is_active === false ? "Inactive" : "Active"}
                      </div>
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
                    </div>
                  </div>
                  <div
                    style={{ ...muted, fontSize: 13, marginTop: 8, lineHeight: 1.4 }}
                  >
                    {s.description}
                  </div>
                  <div style={{ ...muted, fontSize: 12, marginTop: 8 }}>
                    Category: {s.category?.name || "Uncategorized / legacy"}
                  </div>
                  <div style={{ ...muted, fontSize: 12, marginTop: 6 }}>
                    Pricing: {pricingTypeLabel(s.pricing_type)}
                    {s.pricing_type !== "consultation_required"
                      ? ` · ${formatServicePrice(s)}`
                      : ""}
                  </div>
                  <div style={{ ...muted, fontSize: 12, marginTop: 6 }}>
                    Consultation fee:{" "}
                    {!s.consultation_fee || Number(s.consultation_fee) === 0
                      ? "Free"
                      : `$${s.consultation_fee}`}
                  </div>
                  {s.cancellation_policy ? (
                    <div style={{ ...muted, fontSize: 12, marginTop: 6 }}>
                      Cancellation: {s.cancellation_policy}
                    </div>
                  ) : null}
                  <div
                    style={{
                      marginTop: 14,
                      display: "flex",
                      gap: 8,
                      flexWrap: "wrap",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => startEdit(s)}
                      disabled={
                        removingId !== null ||
                        reactivatingId !== null ||
                        showCreateForm
                      }
                      style={{
                        padding: "8px 10px",
                        borderRadius: 8,
                        border: "1px solid #e5e7eb",
                        background: "#fff",
                        color: "#111827",
                        fontSize: 13,
                        fontWeight: 600,
                        cursor:
                          removingId !== null ||
                          reactivatingId !== null ||
                          showCreateForm
                            ? "not-allowed"
                            : "pointer",
                      }}
                    >
                      Edit
                    </button>
                    {showViewDetailsLink && s.is_active !== false && (
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
                    )}
                    {s.is_active === false ? (
                      <button
                        type="button"
                        onClick={() => void reactivateService(s)}
                        disabled={reactivatingId === s.id}
                        style={{
                          padding: "8px 10px",
                          borderRadius: 8,
                          border: "1px solid #bbf7d0",
                          background: reactivatingId === s.id ? "#dcfce7" : "#fff",
                          color: "#166534",
                          fontSize: 13,
                          fontWeight: 600,
                          cursor:
                            reactivatingId === s.id ? "not-allowed" : "pointer",
                        }}
                      >
                        {reactivatingId === s.id ? "Reactivating…" : "Reactivate"}
                      </button>
                    ) : (
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
                        {removingId === s.id ? "Removing..." : deactivateLabel}
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {!loading && !error && services.length === 0 && !showCreateForm && (
        <div style={{ ...muted, fontSize: 14 }}>{emptyMessage}</div>
      )}
    </div>
  );
}

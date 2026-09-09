import type { ServiceCategory } from "../../api/client";

const field = {
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid #d1d5db",
  fontSize: 14,
  outline: "none" as const,
  width: "100%",
  boxSizing: "border-box" as const,
};

type Props = {
  categories: ServiceCategory[];
  loading: boolean;
  loadError: string | null;
  onRetry: () => void;
  value: string;
  onChange: (value: string) => void;
  fieldError?: string | null;
  disabled?: boolean;
  required?: boolean;
  selectId?: string;
};

export default function ServiceCategorySelect({
  categories,
  loading,
  loadError,
  onRetry,
  value,
  onChange,
  fieldError,
  disabled = false,
  required = true,
  selectId = "service-category",
}: Props) {
  if (loadError) {
    return (
      <div
        role="alert"
        style={{
          fontSize: 13,
          color: "#b91c1c",
          background: "#fef2f2",
          border: "1px solid #fecaca",
          borderRadius: 8,
          padding: 10,
        }}
      >
        <div>{loadError}</div>
        <button
          type="button"
          onClick={onRetry}
          style={{
            marginTop: 8,
            padding: "6px 10px",
            borderRadius: 8,
            border: "1px solid #fecaca",
            background: "#fff",
            color: "#b91c1c",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Retry loading categories
        </button>
      </div>
    );
  }

  if (!loading && categories.length === 0) {
    return (
      <div
        role="status"
        style={{
          fontSize: 13,
          color: "#92400e",
          background: "#fffbeb",
          border: "1px solid #fcd34d",
          borderRadius: 8,
          padding: 10,
        }}
      >
        No service categories are available right now. Services cannot be created
        until categories are configured.
      </div>
    );
  }

  const controlDisabled = disabled || loading || categories.length === 0;

  return (
    <label style={{ fontSize: 13, color: "#111827" }} htmlFor={selectId}>
      Service category
      <select
        id={selectId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={controlDisabled}
        aria-required={required}
        aria-invalid={Boolean(fieldError)}
        style={{
          ...field,
          marginTop: 6,
          background: controlDisabled ? "#f3f4f6" : "#fff",
        }}
      >
        <option value="" disabled>
          {loading ? "Loading categories…" : "Select a category."}
        </option>
        {categories.map((category) => (
          <option key={category.id} value={String(category.id)}>
            {category.name}
          </option>
        ))}
      </select>
      {fieldError && (
        <div style={{ color: "#b91c1c", fontSize: 13, marginTop: 6 }}>
          {fieldError}
        </div>
      )}
    </label>
  );
}

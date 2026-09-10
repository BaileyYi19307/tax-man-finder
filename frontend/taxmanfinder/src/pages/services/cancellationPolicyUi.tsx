import type { CancellationPolicyCode, CancellationPolicyOption } from "../../api/client";

/** Placeholder value for the select when a legacy service has no code yet. */
export const CANCELLATION_POLICY_UNSET = "";

export function hasCancellationPolicyCode(
  code: string | null | undefined
): code is CancellationPolicyCode {
  return code === "free_24h" || code === "free_48h" || code === "non_refundable";
}

export function cancellationPolicySelectValue(
  code: string | null | undefined
): string {
  return hasCancellationPolicyCode(code) ? code : CANCELLATION_POLICY_UNSET;
}

export type CancellationPolicySelectProps = {
  id: string;
  value: string;
  options: CancellationPolicyOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  error?: string | null;
  required?: boolean;
};

export function CancellationPolicySelect({
  id,
  value,
  options,
  onChange,
  disabled = false,
  error = null,
  required = true,
}: CancellationPolicySelectProps) {
  return (
    <div>
      <label htmlFor={id} style={{ fontSize: 13, color: "#111827", display: "block" }}>
        Cancellation policy
        <select
          id={id}
          value={value}
          required={required}
          disabled={disabled}
          aria-invalid={Boolean(error)}
          onChange={(e) => onChange(e.target.value)}
          style={{
            padding: "10px 12px",
            borderRadius: 8,
            border: error ? "1px solid #fca5a5" : "1px solid #d1d5db",
            fontSize: 14,
            outline: "none",
            width: "100%",
            boxSizing: "border-box",
            marginTop: 6,
            background: disabled ? "#f3f4f6" : "#fff",
          }}
        >
          <option value={CANCELLATION_POLICY_UNSET}>
            Select a cancellation policy
          </option>
          {options.map((opt) => (
            <option key={opt.code} value={opt.code}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>
      {error ? (
        <div role="alert" style={{ color: "#b91c1c", fontSize: 12, marginTop: 4 }}>
          {error}
        </div>
      ) : null}
      {hasCancellationPolicyCode(value) ? (
        <div style={{ color: "#6b7280", fontSize: 12, marginTop: 6, lineHeight: 1.45 }}>
          {options.find((opt) => opt.code === value)?.label}
        </div>
      ) : (
        <div style={{ color: "#6b7280", fontSize: 12, marginTop: 6, lineHeight: 1.45 }}>
          Clients see the full policy wording when they request a consultation.
        </div>
      )}
    </div>
  );
}

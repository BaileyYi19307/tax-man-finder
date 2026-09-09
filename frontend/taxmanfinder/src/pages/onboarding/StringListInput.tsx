import { useState, type KeyboardEvent } from "react";
import {
  FieldError,
  normalizeStringList,
  onboardingFieldErrorStyle,
  onboardingMuted,
  onboardingSecondaryButton,
} from "./onboardingFormUtils";

type Props = {
  id: string;
  label: string;
  hint?: string;
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
};

export default function StringListInput({
  id,
  label,
  hint,
  values,
  onChange,
  placeholder,
  disabled = false,
  error,
}: Props) {
  const [draft, setDraft] = useState("");

  function addValue() {
    const next = normalizeStringList([...values, draft]);
    onChange(next);
    setDraft("");
  }

  function removeValue(index: number) {
    onChange(values.filter((_, i) => i !== index));
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      addValue();
    }
  }

  return (
    <div>
      <div style={{ fontSize: 13, color: "#111827", marginBottom: 6 }}>
        <label htmlFor={id}>{label}</label>
        {hint ? <div style={{ ...onboardingMuted, marginTop: 2 }}>{hint}</div> : null}
      </div>

      {values.length > 0 ? (
        <ul
          aria-label={`Selected ${label}`}
          style={{
            listStyle: "none",
            margin: "0 0 8px",
            padding: 0,
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
          }}
        >
          {values.map((value, index) => (
            <li
              key={`${value.toLowerCase()}-${index}`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "4px 8px",
                borderRadius: 999,
                background: "#f3f4f6",
                border: "1px solid #e5e7eb",
                fontSize: 13,
                color: "#111827",
              }}
            >
              <span>{value}</span>
              <button
                type="button"
                aria-label={`Remove ${value}`}
                disabled={disabled}
                onClick={() => removeValue(index)}
                style={{
                  border: "none",
                  background: "transparent",
                  color: "#6b7280",
                  cursor: disabled ? "not-allowed" : "pointer",
                  padding: 0,
                  fontSize: 14,
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input
          id={id}
          value={draft}
          disabled={disabled}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          aria-invalid={Boolean(error)}
          style={{
            ...onboardingFieldErrorStyle(Boolean(error)),
            marginTop: 0,
            flex: 1,
          }}
        />
        <button
          type="button"
          disabled={disabled || !draft.trim()}
          onClick={addValue}
          aria-label={`Add ${label}`}
          style={onboardingSecondaryButton(disabled || !draft.trim())}
        >
          Add
        </button>
      </div>
      <FieldError message={error} />
    </div>
  );
}

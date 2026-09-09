/** Shared onboarding form styles and tiny field helpers. */

export const onboardingField = {
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid #d1d5db",
  fontSize: 14,
  outline: "none" as const,
  width: "100%",
  boxSizing: "border-box" as const,
};

export const onboardingMuted = {
  color: "#6b7280",
  fontSize: 13,
  lineHeight: 1.45,
};

export function onboardingPrimaryButton(disabled: boolean) {
  return {
    padding: "10px 14px",
    borderRadius: 8,
    border: "none",
    background: disabled ? "#93c5fd" : "#2563eb",
    color: "#fff",
    fontWeight: 600,
    fontSize: 14,
    cursor: disabled ? ("not-allowed" as const) : ("pointer" as const),
  };
}

export function onboardingSecondaryButton(disabled: boolean) {
  return {
    padding: "10px 14px",
    borderRadius: 8,
    border: "1px solid #d1d5db",
    background: disabled ? "#f3f4f6" : "#fff",
    color: "#111827",
    fontWeight: 600,
    fontSize: 14,
    cursor: disabled ? ("not-allowed" as const) : ("pointer" as const),
  };
}

export function onboardingFieldErrorStyle(hasError: boolean) {
  return {
    ...onboardingField,
    marginTop: 6,
    borderColor: hasError ? "#f87171" : "#d1d5db",
  };
}

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div style={{ color: "#b91c1c", fontSize: 12, marginTop: 4 }}>{message}</div>
  );
}

/** Trim, drop blanks, and dedupe case-insensitively while keeping first spelling. */
export function normalizeStringList(values: string[]): string[] {
  const normalized: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const cleaned = value.trim();
    if (!cleaned) continue;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push(cleaned);
  }
  return normalized;
}

export type OnboardingStepId =
  | "basic"
  | "professional"
  | "services"
  | "preview";

export type OnboardingStep = {
  id: OnboardingStepId;
  label: string;
  /** Route when the step is implemented; null means not linkable yet. */
  path: string | null;
};

export const ACCOUNTANT_ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: "basic",
    label: "Basic profile",
    path: "/onboarding/accountant/basic",
  },
  {
    id: "professional",
    label: "Professional details",
    path: "/onboarding/accountant/professional",
  },
  {
    id: "services",
    label: "Services",
    path: "/onboarding/accountant/services",
  },
  {
    id: "preview",
    label: "Preview",
    path: "/onboarding/accountant/preview",
  },
];

export const ACCOUNTANT_ONBOARDING_ENTRY = "/onboarding/accountant/basic";

const BASIC_SETUP_KEYS = new Set([
  "first_name",
  "last_name",
  "bio",
  "location",
]);
const PROFESSIONAL_SETUP_KEYS = new Set([
  "credentials",
  "languages",
  "availability",
]);

/**
 * Map backend publish_readiness_errors to the most relevant wizard step.
 * Navigation only — does not recalculate readiness.
 */
export function continueSetupPath(
  errors: Record<string, string[]> | null | undefined
): string {
  const keys = Object.keys(errors || {});
  if (keys.some((key) => BASIC_SETUP_KEYS.has(key))) {
    return "/onboarding/accountant/basic";
  }
  if (keys.some((key) => PROFESSIONAL_SETUP_KEYS.has(key))) {
    return "/onboarding/accountant/professional";
  }
  if (keys.includes("services")) {
    return "/onboarding/accountant/services";
  }
  return "/onboarding/accountant/preview";
}

/**
 * Whether a wizard step has a publish-readiness gap from the backend.
 * Returns false when readiness data is unavailable — do not infer gaps from visits.
 */
export function stepNeedsAttention(
  stepId: OnboardingStepId,
  errors: Record<string, string[]> | null | undefined
): boolean {
  if (errors == null) return false;
  const keys = Object.keys(errors);
  if (stepId === "basic") {
    return keys.some((key) => BASIC_SETUP_KEYS.has(key));
  }
  if (stepId === "professional") {
    return keys.some((key) => PROFESSIONAL_SETUP_KEYS.has(key));
  }
  if (stepId === "services") {
    return keys.includes("services");
  }
  return false;
}

/**
 * Step is complete only when backend readiness is known and reports no gap.
 * Do not treat prior route visits as completion.
 */
export function stepIsComplete(
  stepId: OnboardingStepId,
  errors: Record<string, string[]> | null | undefined
): boolean {
  if (errors == null) return false;
  return !stepNeedsAttention(stepId, errors);
}

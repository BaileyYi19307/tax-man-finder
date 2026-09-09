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

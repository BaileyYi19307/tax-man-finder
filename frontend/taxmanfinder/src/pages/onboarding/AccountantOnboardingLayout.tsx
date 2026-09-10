import { Link } from "react-router-dom";
import type { CSSProperties, ReactNode } from "react";
import {
  ACCOUNTANT_ONBOARDING_STEPS,
  stepIsComplete,
  stepNeedsAttention,
  type OnboardingStepId,
} from "./onboardingSteps";
import type { PublishReadinessErrors } from "../../api/client";

const page = {
  minHeight: "100vh",
  background: "#f8fafc",
  padding: "32px 16px",
};

const shell = {
  width: "100%",
  maxWidth: 640,
  margin: "0 auto",
};

const card = {
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  padding: 20,
  boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
};

const muted = { color: "#6b7280", fontSize: 13, lineHeight: 1.45 };

type StepVisualState = "current" | "complete" | "needs_attention" | "incomplete";

type Props = {
  currentStepId: OnboardingStepId;
  title: string;
  description?: string;
  children: ReactNode;
  /** When true, wizard step links are disabled (e.g. save in flight). */
  navigationLocked?: boolean;
  /**
   * Backend publish readiness errors. When omitted/null, do not claim
   * completion or show “Needs attention” from route history alone.
   */
  publishReadinessErrors?: PublishReadinessErrors | null;
};

function stepVisualState(options: {
  isCurrent: boolean;
  isComplete: boolean;
  needsAttention: boolean;
}): StepVisualState {
  const { isCurrent, isComplete, needsAttention } = options;
  if (isCurrent) return "current";
  if (needsAttention) return "needs_attention";
  if (isComplete) return "complete";
  return "incomplete";
}

function stepBaseStyle(options: {
  state: StepVisualState;
  navigationLocked: boolean;
  isCurrent: boolean;
}): CSSProperties {
  const { state, navigationLocked, isCurrent } = options;
  const isComplete = state === "complete";
  const isNeedsAttention = state === "needs_attention";

  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    maxWidth: "100%",
    padding: "8px 12px",
    borderRadius: 8,
    fontSize: 13,
    fontWeight: state === "current" ? 700 : isComplete || isNeedsAttention ? 600 : 500,
    lineHeight: 1.3,
    border:
      state === "current"
        ? "1px solid #2563eb"
        : isNeedsAttention
          ? "1px solid #d1d5db"
          : "1px solid #e5e7eb",
    background:
      state === "current" ? "#eff6ff" : isComplete || isNeedsAttention ? "#fff" : "#f9fafb",
    color:
      state === "current" ? "#1d4ed8" : isComplete || isNeedsAttention ? "#111827" : "#6b7280",
    textDecoration: "none",
    opacity: navigationLocked && !isCurrent ? 0.55 : 1,
    pointerEvents: navigationLocked && !isCurrent ? "none" : "auto",
    cursor: !navigationLocked && !isCurrent ? "pointer" : "default",
    boxSizing: "border-box",
    whiteSpace: "normal",
  };
}

export default function AccountantOnboardingLayout({
  currentStepId,
  title,
  description,
  children,
  navigationLocked = false,
  publishReadinessErrors = null,
}: Props) {
  const currentIndex = ACCOUNTANT_ONBOARDING_STEPS.findIndex(
    (step) => step.id === currentStepId
  );
  const hasEditablePriorSteps = currentIndex > 0;

  return (
    <div style={page}>
      <div style={shell}>
        <Link
          to="/dashboard/accountant"
          style={{ fontSize: 13, color: "#2563eb", textDecoration: "none" }}
        >
          ← Accountant dashboard
        </Link>

        <div style={{ ...card, marginTop: 12 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#111827" }}>
            Set up your accountant profile
          </div>
          {description ? (
            <div style={{ ...muted, marginTop: 6 }}>{description}</div>
          ) : null}

          <nav
            aria-label="Onboarding progress"
            style={{ marginTop: 20, marginBottom: 8 }}
          >
            {hasEditablePriorSteps ? (
              <p
                style={{
                  ...muted,
                  margin: "0 0 10px",
                  fontSize: 13,
                }}
              >
                Select any section to review or edit it.
              </p>
            ) : null}
            <ol
              style={{
                listStyle: "none",
                margin: 0,
                padding: 0,
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
              }}
            >
              {ACCOUNTANT_ONBOARDING_STEPS.map((step, index) => {
                const isCurrent = step.id === currentStepId;
                const needsAttention = stepNeedsAttention(
                  step.id,
                  publishReadinessErrors
                );
                const isComplete = stepIsComplete(step.id, publishReadinessErrors);
                const state = stepVisualState({
                  isCurrent,
                  isComplete,
                  needsAttention,
                });
                const visibleLabel = `${index + 1}. ${step.label}`;
                const baseStyle = stepBaseStyle({
                  state,
                  navigationLocked,
                  isCurrent,
                });
                const showEditChrome = state === "complete" || state === "needs_attention";

                if (step.path && !isCurrent && !navigationLocked) {
                  const linkClass =
                    state === "complete"
                      ? "onboarding-step-link onboarding-step-link--complete"
                      : state === "needs_attention"
                        ? "onboarding-step-link onboarding-step-link--attention"
                        : "onboarding-step-link";
                  return (
                    <li key={step.id} style={{ maxWidth: "100%" }}>
                      <Link
                        to={step.path}
                        className={linkClass}
                        style={baseStyle}
                        aria-label={
                          showEditChrome ? `Edit ${step.label}` : step.label
                        }
                      >
                        {visibleLabel}
                        {state === "complete" ? (
                          <span aria-hidden="true" style={{ fontSize: 12, color: "#374151" }}>
                            {" "}
                            ✓
                          </span>
                        ) : null}
                        {state === "needs_attention" ? (
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 600,
                              color: "#6b7280",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {" "}
                            Needs attention
                          </span>
                        ) : null}
                      </Link>
                    </li>
                  );
                }

                return (
                  <li key={step.id} style={{ maxWidth: "100%" }}>
                    <span
                      className={isCurrent ? "onboarding-step-current" : undefined}
                      style={baseStyle}
                      aria-current={isCurrent ? "step" : undefined}
                      aria-disabled={
                        navigationLocked && !isCurrent ? true : undefined
                      }
                    >
                      {visibleLabel}
                      {state === "complete" ? (
                        <span aria-hidden="true" style={{ fontSize: 12, color: "#374151" }}>
                          {" "}
                          ✓
                        </span>
                      ) : null}
                      {state === "needs_attention" ? (
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            color: "#6b7280",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {" "}
                          Needs attention
                        </span>
                      ) : null}
                    </span>
                  </li>
                );
              })}
            </ol>
          </nav>

          <div
            style={{
              fontSize: 16,
              fontWeight: 600,
              color: "#111827",
              marginTop: 16,
              marginBottom: 4,
            }}
          >
            {title}
          </div>

          {children}
        </div>
      </div>
    </div>
  );
}

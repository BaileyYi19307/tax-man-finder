import { Link } from "react-router-dom";
import type { CSSProperties, ReactNode } from "react";
import {
  ACCOUNTANT_ONBOARDING_STEPS,
  type OnboardingStepId,
} from "./onboardingSteps";

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

type Props = {
  currentStepId: OnboardingStepId;
  title: string;
  description?: string;
  children: ReactNode;
  /** When true, wizard step links are disabled (e.g. save in flight). */
  navigationLocked?: boolean;
};

function stepBaseStyle(options: {
  isCurrent: boolean;
  isComplete: boolean;
  navigationLocked: boolean;
}): CSSProperties {
  const { isCurrent, isComplete, navigationLocked } = options;
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    maxWidth: "100%",
    padding: "8px 12px",
    borderRadius: 8,
    fontSize: 13,
    fontWeight: isCurrent ? 700 : isComplete ? 600 : 500,
    lineHeight: 1.3,
    border: isCurrent
      ? "1px solid #2563eb"
      : isComplete
        ? "1px solid #86efac"
        : "1px solid #e5e7eb",
    background: isCurrent ? "#eff6ff" : isComplete ? "#f0fdf4" : "#f9fafb",
    color: isCurrent ? "#1d4ed8" : isComplete ? "#166534" : "#6b7280",
    textDecoration: "none",
    opacity: navigationLocked && !isCurrent ? 0.55 : 1,
    pointerEvents: navigationLocked && !isCurrent ? "none" : "auto",
    cursor:
      !navigationLocked && (isComplete || !isCurrent) ? "pointer" : "default",
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
                const isComplete = currentIndex > index;
                const visibleLabel = `${index + 1}. ${step.label}`;
                const baseStyle = stepBaseStyle({
                  isCurrent,
                  isComplete,
                  navigationLocked,
                });

                if (step.path && isComplete && !navigationLocked) {
                  return (
                    <li key={step.id} style={{ maxWidth: "100%" }}>
                      <Link
                        to={step.path}
                        className="onboarding-step-link onboarding-step-link--complete"
                        style={baseStyle}
                        aria-label={`Edit ${step.label}`}
                      >
                        <span>{visibleLabel}</span>
                        <span aria-hidden="true" style={{ fontSize: 12, opacity: 0.85 }}>
                          ✎
                        </span>
                      </Link>
                    </li>
                  );
                }

                if (step.path && !isCurrent && !navigationLocked) {
                  return (
                    <li key={step.id} style={{ maxWidth: "100%" }}>
                      <Link
                        to={step.path}
                        className="onboarding-step-link"
                        style={baseStyle}
                        aria-label={step.label}
                      >
                        {visibleLabel}
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

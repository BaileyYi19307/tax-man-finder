import { Link } from "react-router-dom";
import type { ReactNode } from "react";
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
                const label = `${index + 1}. ${step.label}`;
                const baseStyle = {
                  display: "inline-block",
                  padding: "6px 10px",
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: isCurrent ? 700 : 500,
                  border: isCurrent ? "1px solid #2563eb" : "1px solid #e5e7eb",
                  background: isCurrent
                    ? "#eff6ff"
                    : isComplete
                      ? "#f0fdf4"
                      : "#f9fafb",
                  color: isCurrent
                    ? "#1d4ed8"
                    : isComplete
                      ? "#166534"
                      : "#6b7280",
                  textDecoration: "none" as const,
                  opacity: navigationLocked && !isCurrent ? 0.55 : 1,
                  pointerEvents:
                    navigationLocked && !isCurrent
                      ? ("none" as const)
                      : ("auto" as const),
                };

                if (step.path && !isCurrent && !navigationLocked) {
                  return (
                    <li key={step.id}>
                      <Link to={step.path} style={baseStyle} aria-current={undefined}>
                        {label}
                      </Link>
                    </li>
                  );
                }

                return (
                  <li key={step.id}>
                    <span
                      style={baseStyle}
                      aria-current={isCurrent ? "step" : undefined}
                      aria-disabled={
                        navigationLocked && !isCurrent ? true : undefined
                      }
                    >
                      {label}
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

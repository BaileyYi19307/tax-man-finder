import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getMyAccountantProfile } from "../../api/client";
import { signupPath } from "../../auth/intent";
import AccountantOnboardingLayout from "./AccountantOnboardingLayout";
import {
  onboardingMuted,
  onboardingPrimaryButton,
  onboardingSecondaryButton,
} from "./onboardingFormUtils";
import ServiceManagementPanel from "../services/ServiceManagementPanel";
import type { CatalogService } from "../services/serviceDisplay";

export default function ServicesOnboardingStep() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [continueNotice, setContinueNotice] = useState<string | null>(null);
  const [services, setServices] = useState<CatalogService[]>([]);

  const ensureProfile = useCallback(async () => {
    setChecking(true);
    setLoadError(null);
    try {
      const profile = await getMyAccountantProfile();
      if (!profile) {
        navigate("/onboarding/accountant/basic", { replace: true });
        return;
      }
    } catch (e) {
      console.error(e);
      setLoadError(
        "Could not load your profile draft. Check your connection and try again."
      );
    } finally {
      setChecking(false);
    }
  }, [navigate]);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      navigate(
        signupPath({
          intent: "tax-professional",
          next: "/onboarding/accountant/services",
        }),
        { replace: true }
      );
      return;
    }
    void ensureProfile();
  }, [navigate, ensureProfile]);

  const onServicesChange = useCallback((rows: CatalogService[]) => {
    setServices(rows);
  }, []);

  if (checking) {
    return (
      <AccountantOnboardingLayout
        currentStepId="services"
        title="Services"
        description="Add the services clients can book or inquire about."
      >
        <div style={{ ...onboardingMuted, marginTop: 12 }}>Loading…</div>
      </AccountantOnboardingLayout>
    );
  }

  if (loadError) {
    return (
      <AccountantOnboardingLayout
        currentStepId="services"
        title="Services"
        description="Add the services clients can book or inquire about."
      >
        <div
          role="alert"
          style={{
            marginTop: 12,
            fontSize: 13,
            color: "#b91c1c",
            background: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: 8,
            padding: 12,
          }}
        >
          {loadError}
        </div>
        <button
          type="button"
          onClick={() => void ensureProfile()}
          style={{ ...onboardingPrimaryButton(false), marginTop: 12 }}
        >
          Retry
        </button>
      </AccountantOnboardingLayout>
    );
  }

  return (
    <AccountantOnboardingLayout
      currentStepId="services"
      title="Services"
      description="List one or more services. You can use the same category more than once. Drafts can have zero services — publishing requires at least one active service."
    >
      <div style={{ marginTop: 12 }}>
        <ServiceManagementPanel
          loginNextPath="/onboarding/accountant/services"
          addButtonLabel="+ Add another service"
          showViewDetailsLink={false}
          emptyMessage="No services yet. Add your first offering below."
          showPublishGuidance
          deactivateLabel="Deactivate"
          onServicesChange={onServicesChange}
        />
      </div>

      {continueNotice ? (
        <div
          role="status"
          style={{
            fontSize: 13,
            color: "#166534",
            background: "#f0fdf4",
            border: "1px solid #bbf7d0",
            borderRadius: 8,
            padding: 10,
            marginTop: 16,
          }}
        >
          {continueNotice}
        </div>
      ) : null}

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
        <button
          type="button"
          onClick={() => navigate("/onboarding/accountant/professional")}
          style={onboardingSecondaryButton(false)}
        >
          Back
        </button>
        <button
          type="button"
          onClick={() => {
            setContinueNotice(
              services.length === 0
                ? "Profile preview coming next. You can keep editing services here, or exit to your dashboard — publishing still needs at least one active service."
                : "Profile preview coming next. You can keep editing services here or exit to your dashboard."
            );
          }}
          style={onboardingPrimaryButton(false)}
        >
          Save and continue
        </button>
        <button
          type="button"
          onClick={() => navigate("/dashboard/accountant", { replace: true })}
          style={onboardingSecondaryButton(false)}
        >
          Save and exit
        </button>
      </div>
    </AccountantOnboardingLayout>
  );
}

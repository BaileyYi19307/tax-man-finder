import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  apiFieldError,
  getMyAccountantPreview,
  publishMyAccountantProfile,
  type AccountantMyProfilePayload,
  type ApiError,
  type PublishReadinessErrors,
} from "../../api/client";
import { signupPath } from "../../auth/intent";
import AccountantProfilePresentation from "../accountants/AccountantProfilePresentation";
import AccountantOnboardingLayout from "./AccountantOnboardingLayout";
import {
  onboardingMuted,
  onboardingPrimaryButton,
  onboardingSecondaryButton,
} from "./onboardingFormUtils";

const BASIC_FIELDS = new Set(["first_name", "last_name", "bio", "location"]);
const PROFESSIONAL_FIELDS = new Set([
  "credentials",
  "languages",
  "availability",
]);

type ReadinessItem = {
  key: string;
  message: string;
  href: string;
  stepLabel: string;
};

function readinessItems(errors: PublishReadinessErrors | undefined): ReadinessItem[] {
  if (!errors) return [];
  const items: ReadinessItem[] = [];
  for (const [key, messages] of Object.entries(errors)) {
    const list = Array.isArray(messages) ? messages : [];
    for (const message of list) {
      let href = "/onboarding/accountant/basic";
      let stepLabel = "Basic Profile";
      if (PROFESSIONAL_FIELDS.has(key)) {
        href = "/onboarding/accountant/professional";
        stepLabel = "Professional Details";
      } else if (key === "services") {
        href = "/onboarding/accountant/services";
        stepLabel = "Services";
      } else if (!BASIC_FIELDS.has(key)) {
        // Unknown keys still surface; default to Basic Profile.
        href = "/onboarding/accountant/basic";
        stepLabel = "Basic Profile";
      }
      items.push({ key, message, href, stepLabel });
    }
  }
  return items;
}

function publishErrorMessage(err: unknown): string {
  if (!err || typeof err !== "object") {
    return "Could not publish your profile. Check your connection and try again.";
  }
  const apiErr = err as ApiError;
  const knownKeys = [
    "first_name",
    "last_name",
    "bio",
    "location",
    "credentials",
    "languages",
    "availability",
    "services",
  ] as const;
  for (const key of knownKeys) {
    const fieldMsg = apiFieldError(apiErr, key);
    if (fieldMsg) return fieldMsg;
  }
  if (apiErr.fields && Object.keys(apiErr.fields).length > 0) {
    return Object.values(apiErr.fields)[0] || "Could not publish your profile.";
  }
  if (
    typeof apiErr.message === "string" &&
    apiErr.message.trim() &&
    "fields" in apiErr
  ) {
    return apiErr.message;
  }
  return "Could not publish your profile. Check your connection and try again.";
}

export default function PreviewOnboardingStep() {
  const navigate = useNavigate();
  const publishingRef = useRef(false);

  const [checking, setChecking] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [profile, setProfile] = useState<AccountantMyProfilePayload | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [justPublished, setJustPublished] = useState(false);

  const loadPreview = useCallback(async () => {
    setChecking(true);
    setLoadError(null);
    try {
      const data = await getMyAccountantPreview();
      if (!data) {
        navigate("/onboarding/accountant/basic", { replace: true });
        return;
      }
      setProfile(data);
      if (data.is_public) {
        setJustPublished(true);
      }
    } catch (e) {
      console.error(e);
      setLoadError(
        "Could not load your profile preview. Check your connection and try again."
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
          next: "/onboarding/accountant/preview",
        }),
        { replace: true }
      );
      return;
    }
    void loadPreview();
  }, [navigate, loadPreview]);

  async function handlePublish() {
    if (!profile?.is_publish_ready || publishingRef.current) return;
    publishingRef.current = true;
    setPublishing(true);
    setPublishError(null);
    try {
      const updated = await publishMyAccountantProfile();
      setProfile(updated);
      setJustPublished(true);
    } catch (err) {
      console.error(err);
      setPublishError(publishErrorMessage(err));
    } finally {
      publishingRef.current = false;
      setPublishing(false);
    }
  }

  if (checking) {
    return (
      <AccountantOnboardingLayout
        currentStepId="preview"
        title="Preview & publish"
        description="Review how clients will see your profile, then publish when you are ready."
      >
        <div style={{ ...onboardingMuted, marginTop: 12 }}>Loading preview…</div>
      </AccountantOnboardingLayout>
    );
  }

  if (loadError || !profile) {
    return (
      <AccountantOnboardingLayout
        currentStepId="preview"
        title="Preview & publish"
        description="Review how clients will see your profile, then publish when you are ready."
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
          {loadError || "Could not load your profile preview."}
        </div>
        <button
          type="button"
          onClick={() => void loadPreview()}
          style={{ ...onboardingPrimaryButton(false), marginTop: 12 }}
        >
          Retry
        </button>
      </AccountantOnboardingLayout>
    );
  }

  const ready = profile.is_publish_ready;
  const gaps = readinessItems(profile.publish_readiness_errors);
  const showLiveConfirmation = justPublished && profile.is_public;
  const publishDisabled = !ready || publishing;

  return (
    <AccountantOnboardingLayout
      currentStepId="preview"
      title="Preview & publish"
      navigationLocked={publishing}
      description="This is how clients will see your profile. Fix any gaps below, then publish."
    >
      {showLiveConfirmation ? (
        <div
          role="status"
          style={{
            marginTop: 12,
            marginBottom: 16,
            fontSize: 14,
            color: "#166534",
            background: "#f0fdf4",
            border: "1px solid #bbf7d0",
            borderRadius: 8,
            padding: 14,
          }}
        >
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>
            Your profile is live
          </div>
          <div style={{ marginBottom: 12, lineHeight: 1.45 }}>
            Clients can now find and contact you through Tax Man Finder.
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <Link
              to={`/accountants/${profile.user_id}`}
              style={{
                ...onboardingPrimaryButton(false),
                display: "inline-block",
                textDecoration: "none",
                lineHeight: "normal",
                background: "#166534",
              }}
            >
              View public profile
            </Link>
            <Link
              to="/dashboard/accountant"
              style={{
                ...onboardingSecondaryButton(false),
                display: "inline-block",
                textDecoration: "none",
                lineHeight: "normal",
              }}
            >
              Go to dashboard
            </Link>
          </div>
        </div>
      ) : null}

      {!showLiveConfirmation && gaps.length > 0 ? (
        <div
          role="alert"
          style={{
            marginTop: 12,
            marginBottom: 16,
            fontSize: 13,
            color: "#b91c1c",
            background: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: 8,
            padding: 12,
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 8 }}>
            Finish these requirements before publishing
          </div>
          <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.5 }}>
            {gaps.map((item) => (
              <li key={`${item.key}-${item.message}`} style={{ marginBottom: 6 }}>
                {item.message}{" "}
                <Link
                  to={item.href}
                  style={{ color: "#1d4ed8", fontWeight: 600 }}
                >
                  Fix in {item.stepLabel}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {publishError ? (
        <div
          role="alert"
          style={{
            marginBottom: 12,
            fontSize: 13,
            color: "#b91c1c",
            background: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: 8,
            padding: 10,
          }}
        >
          {publishError}
        </div>
      ) : null}

      <div style={{ marginTop: 8 }}>
        <AccountantProfilePresentation profile={profile} />
      </div>

      {!showLiveConfirmation ? (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
          <button
            type="button"
            onClick={() => navigate("/onboarding/accountant/services")}
            style={onboardingSecondaryButton(false)}
          >
            Back
          </button>
          <button
            type="button"
            onClick={() => void handlePublish()}
            disabled={publishDisabled}
            style={onboardingPrimaryButton(publishDisabled)}
          >
            {publishing ? "Publishing…" : "Publish profile"}
          </button>
          <button
            type="button"
            onClick={() => navigate("/dashboard/accountant", { replace: true })}
            style={onboardingSecondaryButton(false)}
          >
            Save and exit
          </button>
        </div>
      ) : null}
    </AccountantOnboardingLayout>
  );
}

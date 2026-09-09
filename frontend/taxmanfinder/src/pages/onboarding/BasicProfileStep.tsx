import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthProvider";
import { signupPath } from "../../auth/intent";
import {
  createAccountantProfile,
  getMe,
  getMyAccountantProfile,
  type AccountantMyProfilePayload,
  type AccountantProfileDraftBody,
  type ApiError,
} from "../../api/client";
import AccountantOnboardingLayout from "./AccountantOnboardingLayout";
import {
  FieldError,
  onboardingFieldErrorStyle,
  onboardingMuted,
  onboardingPrimaryButton,
  onboardingSecondaryButton,
} from "./onboardingFormUtils";

function initialsFor(firstName: string, lastName: string) {
  const first = firstName.trim().charAt(0);
  const last = lastName.trim().charAt(0);
  const initials = `${first}${last}`.toUpperCase();
  return initials || "?";
}

function buildBasicProfilePayload(values: {
  firstName: string;
  lastName: string;
  headline: string;
  bio: string;
  location: string;
}): AccountantProfileDraftBody {
  const body: AccountantProfileDraftBody = {
    bio: values.bio.trim(),
    location: values.location.trim(),
    headline: values.headline.trim(),
  };
  const firstName = values.firstName.trim();
  const lastName = values.lastName.trim();
  // Backend rejects blank names; omit empty values so existing names are kept.
  if (firstName) body.first_name = firstName;
  if (lastName) body.last_name = lastName;
  return body;
}

export default function BasicProfileStep() {
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const savingRef = useRef(false);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [headline, setHeadline] = useState("");
  const [bio, setBio] = useState("");
  const [location, setLocation] = useState("");

  const [checking, setChecking] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [hasProfile, setHasProfile] = useState(false);

  const loadDraft = useCallback(async () => {
    setChecking(true);
    setLoadError(null);
    setFormError(null);
    setFieldErrors({});
    try {
      const me = await getMe();
      setFirstName((value) => value || me.first_name || "");
      setLastName((value) => value || me.last_name || "");

      const profile = await getMyAccountantProfile();
      if (profile) {
        setHasProfile(true);
        setFirstName(profile.first_name || me.first_name || "");
        setLastName(profile.last_name || me.last_name || "");
        setHeadline(profile.headline || "");
        setBio(profile.bio || "");
        setLocation(profile.location || "");
      } else {
        setHasProfile(false);
      }
    } catch (e) {
      console.error(e);
      setLoadError(
        "Could not load your profile draft. Check your connection and try again."
      );
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      navigate(
        signupPath({
          intent: "tax-professional",
          next: "/onboarding/accountant/basic",
        }),
        { replace: true }
      );
      return;
    }
    void loadDraft();
  }, [navigate, loadDraft]);

  async function saveDraft(mode: "continue" | "exit") {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setFormError(null);
    setFieldErrors({});

    try {
      const saved: AccountantMyProfilePayload = await createAccountantProfile(
        buildBasicProfilePayload({
          firstName,
          lastName,
          headline,
          bio,
          location,
        })
      );
      setHasProfile(true);
      setFirstName(saved.first_name || firstName);
      setLastName(saved.last_name || lastName);
      setHeadline(saved.headline || "");
      setBio(saved.bio || "");
      setLocation(saved.location || "");
      await refreshUser();

      if (mode === "exit") {
        navigate("/dashboard/accountant", { replace: true });
        return;
      }

      navigate("/onboarding/accountant/professional");
    } catch (err: unknown) {
      const apiErr = err as ApiError;
      if (apiErr?.fields && Object.keys(apiErr.fields).length > 0) {
        setFieldErrors(apiErr.fields);
      }
      setFormError(
        err instanceof Error
          ? err.message
          : "Could not save your profile. Please try again."
      );
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  if (checking) {
    return (
      <AccountantOnboardingLayout
        currentStepId="basic"
        title="Basic profile"
        description="Tell clients who you are and where you work."
      >
        <div style={{ ...onboardingMuted, marginTop: 12 }}>Loading your draft…</div>
      </AccountantOnboardingLayout>
    );
  }

  if (loadError) {
    return (
      <AccountantOnboardingLayout
        currentStepId="basic"
        title="Basic profile"
        description="Tell clients who you are and where you work."
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
          onClick={() => void loadDraft()}
          style={{ ...onboardingPrimaryButton(false), marginTop: 12 }}
        >
          Retry
        </button>
      </AccountantOnboardingLayout>
    );
  }

  const initials = initialsFor(firstName, lastName);

  return (
    <AccountantOnboardingLayout
      currentStepId="basic"
      title="Basic profile"
      navigationLocked={saving}
      description={
        hasProfile
          ? "Update your draft. Incomplete details are fine — you can publish later."
          : "Start your draft. Incomplete details are fine — you can publish later."
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void saveDraft("continue");
        }}
        style={{ display: "grid", gap: 14, marginTop: 12 }}
      >
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <div
            aria-hidden="true"
            style={{
              width: 64,
              height: 64,
              borderRadius: "50%",
              background: "#e5e7eb",
              color: "#374151",
              display: "grid",
              placeItems: "center",
              fontWeight: 700,
              fontSize: 20,
              flexShrink: 0,
            }}
          >
            {initials}
          </div>
          <div style={onboardingMuted}>
            Photo upload comes later. Clients will see these initials for now.
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gap: 12,
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          }}
        >
          <div>
            <label style={{ fontSize: 13, color: "#111827", display: "block" }}>
              First name
              <input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                autoComplete="given-name"
                aria-invalid={Boolean(fieldErrors.first_name)}
                style={onboardingFieldErrorStyle(Boolean(fieldErrors.first_name))}
              />
            </label>
            <FieldError message={fieldErrors.first_name} />
          </div>
          <div>
            <label style={{ fontSize: 13, color: "#111827", display: "block" }}>
              Last name
              <input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                autoComplete="family-name"
                aria-invalid={Boolean(fieldErrors.last_name)}
                style={onboardingFieldErrorStyle(Boolean(fieldErrors.last_name))}
              />
            </label>
            <FieldError message={fieldErrors.last_name} />
          </div>
        </div>

        <div>
          <label style={{ fontSize: 13, color: "#111827", display: "block" }}>
            Professional headline
            <span style={{ ...onboardingMuted, marginLeft: 6 }}>(optional)</span>
            <input
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              placeholder="e.g. CPA helping startups with tax planning"
              maxLength={160}
              aria-invalid={Boolean(fieldErrors.headline)}
              style={onboardingFieldErrorStyle(Boolean(fieldErrors.headline))}
            />
          </label>
          <FieldError message={fieldErrors.headline} />
        </div>

        <div>
          <label style={{ fontSize: 13, color: "#111827", display: "block" }}>
            Bio
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={5}
              placeholder="A short introduction for clients"
              aria-invalid={Boolean(fieldErrors.bio)}
              style={{
                ...onboardingFieldErrorStyle(Boolean(fieldErrors.bio)),
                resize: "vertical" as const,
              }}
            />
          </label>
          <FieldError message={fieldErrors.bio} />
        </div>

        <div>
          <label style={{ fontSize: 13, color: "#111827", display: "block" }}>
            Location (city/state)
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Philadelphia, PA"
              aria-invalid={Boolean(fieldErrors.location)}
              style={onboardingFieldErrorStyle(Boolean(fieldErrors.location))}
            />
          </label>
          <FieldError message={fieldErrors.location} />
        </div>

        {formError ? (
          <div
            role="alert"
            style={{
              fontSize: 13,
              color: "#b91c1c",
              background: "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: 8,
              padding: 10,
            }}
          >
            {formError}
          </div>
        ) : null}

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 4 }}>
          <button
            type="submit"
            disabled={saving}
            style={onboardingPrimaryButton(saving)}
          >
            {saving ? "Saving…" : "Save and continue"}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void saveDraft("exit")}
            style={onboardingSecondaryButton(saving)}
          >
            {saving ? "Saving…" : "Save and exit"}
          </button>
        </div>
      </form>
    </AccountantOnboardingLayout>
  );
}

import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthProvider";
import { signupPath } from "../../auth/intent";
import {
  createAccountantProfile,
  getMyAccountantProfile,
  type AccountantMyProfilePayload,
  type AccountantProfileDraftBody,
  type ApiError,
  type PublishReadinessErrors,
} from "../../api/client";
import AccountantOnboardingLayout from "./AccountantOnboardingLayout";
import StringListInput from "./StringListInput";
import {
  FieldError,
  normalizeStringList,
  onboardingFieldErrorStyle,
  onboardingMuted,
  onboardingPrimaryButton,
  onboardingSecondaryButton,
} from "./onboardingFormUtils";

function parseYearsExperience(raw: string): {
  value: number | undefined;
  error: string | null;
} {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { value: 0, error: null };
  }
  if (!/^\d+$/.test(trimmed)) {
    return {
      value: undefined,
      error: "Years of experience must be a non-negative whole number.",
    };
  }
  return { value: Number(trimmed), error: null };
}

function buildProfessionalPayload(values: {
  credentials: string;
  yearsExperience: string;
  languages: string[];
  offersRemote: boolean;
  offersInPerson: boolean;
  industries: string[];
  website: string;
  licenseInformation: string;
  firmName: string;
}): { body: AccountantProfileDraftBody; yearsError: string | null } {
  const years = parseYearsExperience(values.yearsExperience);
  if (years.error) {
    return { body: {}, yearsError: years.error };
  }

  const body: AccountantProfileDraftBody = {
    credentials: values.credentials.trim(),
    years_experience: years.value ?? 0,
    languages: normalizeStringList(values.languages),
    offers_remote: values.offersRemote,
    offers_in_person: values.offersInPerson,
    industries: normalizeStringList(values.industries),
    website: values.website.trim(),
    license_information: values.licenseInformation.trim(),
    firm_name: values.firmName.trim(),
  };
  return { body, yearsError: null };
}

export default function ProfessionalDetailsStep() {
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const savingRef = useRef(false);

  const [credentials, setCredentials] = useState("");
  const [yearsExperience, setYearsExperience] = useState("");
  const [languages, setLanguages] = useState<string[]>([]);
  const [offersRemote, setOffersRemote] = useState(false);
  const [offersInPerson, setOffersInPerson] = useState(false);
  const [industries, setIndustries] = useState<string[]>([]);
  const [website, setWebsite] = useState("");
  const [licenseInformation, setLicenseInformation] = useState("");
  const [firmName, setFirmName] = useState("");

  const [checking, setChecking] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [publishReadinessErrors, setPublishReadinessErrors] =
    useState<PublishReadinessErrors | null>(null);

  const loadDraft = useCallback(async () => {
    setChecking(true);
    setLoadError(null);
    setFormError(null);
    setFieldErrors({});
    try {
      const profile = await getMyAccountantProfile();
      if (profile) {
        setCredentials(profile.credentials || "");
        setYearsExperience(
          profile.years_experience != null ? String(profile.years_experience) : ""
        );
        setLanguages(Array.isArray(profile.languages) ? [...profile.languages] : []);
        setOffersRemote(Boolean(profile.offers_remote));
        setOffersInPerson(Boolean(profile.offers_in_person));
        setIndustries(Array.isArray(profile.industries) ? [...profile.industries] : []);
        setWebsite(profile.website || "");
        setLicenseInformation(profile.license_information || "");
        setFirmName(profile.firm_name || "");
        setPublishReadinessErrors(profile.publish_readiness_errors || {});
      } else {
        setPublishReadinessErrors(null);
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
          next: "/onboarding/accountant/professional",
        }),
        { replace: true }
      );
      return;
    }
    void loadDraft();
  }, [navigate, loadDraft]);

  function applySaved(saved: AccountantMyProfilePayload) {
    setCredentials(saved.credentials || "");
    setYearsExperience(
      saved.years_experience != null ? String(saved.years_experience) : ""
    );
    setLanguages(Array.isArray(saved.languages) ? [...saved.languages] : []);
    setOffersRemote(Boolean(saved.offers_remote));
    setOffersInPerson(Boolean(saved.offers_in_person));
    setIndustries(Array.isArray(saved.industries) ? [...saved.industries] : []);
    setWebsite(saved.website || "");
    setLicenseInformation(saved.license_information || "");
    setFirmName(saved.firm_name || "");
    setPublishReadinessErrors(saved.publish_readiness_errors || {});
  }

  async function saveDraft(mode: "continue" | "exit") {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setFormError(null);
    setFieldErrors({});

    try {
      const { body, yearsError } = buildProfessionalPayload({
        credentials,
        yearsExperience,
        languages,
        offersRemote,
        offersInPerson,
        industries,
        website,
        licenseInformation,
        firmName,
      });
      if (yearsError) {
        setFieldErrors({ years_experience: yearsError });
        setFormError(yearsError);
        return;
      }

      const saved = await createAccountantProfile(body);
      applySaved(saved);
      await refreshUser();

      if (mode === "exit") {
        navigate("/dashboard/accountant", { replace: true });
        return;
      }

      navigate("/onboarding/accountant/services");
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
        currentStepId="professional"
        title="Professional details"
        description="Credentials, languages, and how you work with clients."
      >
        <div style={{ ...onboardingMuted, marginTop: 12 }}>Loading your draft…</div>
      </AccountantOnboardingLayout>
    );
  }

  if (loadError) {
    return (
      <AccountantOnboardingLayout
        currentStepId="professional"
        title="Professional details"
        description="Credentials, languages, and how you work with clients."
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

  return (
    <AccountantOnboardingLayout
      currentStepId="professional"
      title="Professional details"
      navigationLocked={saving}
      publishReadinessErrors={publishReadinessErrors}
      description="Drafts can be incomplete. Credentials, at least one language, and remote or in-person availability are required before publishing."
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void saveDraft("continue");
        }}
        style={{ display: "grid", gap: 14, marginTop: 12 }}
      >
        <div>
          <label style={{ fontSize: 13, color: "#111827", display: "block" }}>
            Credentials
            <input
              value={credentials}
              onChange={(e) => setCredentials(e.target.value)}
              placeholder="e.g. CPA, EA"
              disabled={saving}
              aria-invalid={Boolean(fieldErrors.credentials)}
              style={onboardingFieldErrorStyle(Boolean(fieldErrors.credentials))}
            />
          </label>
          <FieldError message={fieldErrors.credentials} />
        </div>

        <div>
          <label style={{ fontSize: 13, color: "#111827", display: "block" }}>
            Years of experience
            <span style={{ ...onboardingMuted, marginLeft: 6 }}>(optional)</span>
            <input
              type="text"
              inputMode="numeric"
              value={yearsExperience}
              onChange={(e) => setYearsExperience(e.target.value)}
              placeholder="0"
              disabled={saving}
              aria-invalid={Boolean(fieldErrors.years_experience)}
              style={onboardingFieldErrorStyle(Boolean(fieldErrors.years_experience))}
            />
          </label>
          <FieldError message={fieldErrors.years_experience} />
        </div>

        <StringListInput
          id="languages-input"
          label="Languages"
          hint="Add each language, then press Enter or Add. Required before publishing."
          values={languages}
          onChange={setLanguages}
          placeholder="e.g. English"
          disabled={saving}
          error={fieldErrors.languages}
        />

        <fieldset
          style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 12, margin: 0 }}
        >
          <legend style={{ fontSize: 13, color: "#111827", padding: "0 4px" }}>
            Availability
          </legend>
          <div style={{ ...onboardingMuted, marginBottom: 8 }}>
            Choose how you meet clients. At least one option is required before publishing.
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            <label style={{ fontSize: 14, color: "#111827", display: "flex", gap: 8 }}>
              <input
                type="checkbox"
                checked={offersRemote}
                disabled={saving}
                onChange={(e) => setOffersRemote(e.target.checked)}
              />
              Remote
            </label>
            <label style={{ fontSize: 14, color: "#111827", display: "flex", gap: 8 }}>
              <input
                type="checkbox"
                checked={offersInPerson}
                disabled={saving}
                onChange={(e) => setOffersInPerson(e.target.checked)}
              />
              In person
            </label>
          </div>
          <FieldError message={fieldErrors.availability || fieldErrors.offers_remote} />
        </fieldset>

        <StringListInput
          id="industries-input"
          label="Industries / client types"
          hint="Optional. Examples: startups, freelancers, real estate."
          values={industries}
          onChange={setIndustries}
          placeholder="e.g. Startups"
          disabled={saving}
          error={fieldErrors.industries}
        />

        <div>
          <label style={{ fontSize: 13, color: "#111827", display: "block" }}>
            Website
            <span style={{ ...onboardingMuted, marginLeft: 6 }}>(optional)</span>
            <input
              type="url"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://example.com"
              disabled={saving}
              aria-invalid={Boolean(fieldErrors.website)}
              style={onboardingFieldErrorStyle(Boolean(fieldErrors.website))}
            />
          </label>
          <FieldError message={fieldErrors.website} />
        </div>

        <div>
          <label style={{ fontSize: 13, color: "#111827", display: "block" }}>
            License information
            <span style={{ ...onboardingMuted, marginLeft: 6 }}>(optional)</span>
            <textarea
              value={licenseInformation}
              onChange={(e) => setLicenseInformation(e.target.value)}
              rows={3}
              placeholder="State licenses, registration numbers, etc."
              disabled={saving}
              aria-invalid={Boolean(fieldErrors.license_information)}
              style={{
                ...onboardingFieldErrorStyle(Boolean(fieldErrors.license_information)),
                resize: "vertical" as const,
              }}
            />
          </label>
          <FieldError message={fieldErrors.license_information} />
        </div>

        <div>
          <label style={{ fontSize: 13, color: "#111827", display: "block" }}>
            Firm or business name
            <span style={{ ...onboardingMuted, marginLeft: 6 }}>(optional)</span>
            <input
              value={firmName}
              onChange={(e) => setFirmName(e.target.value)}
              placeholder="Optional"
              disabled={saving}
              aria-invalid={Boolean(fieldErrors.firm_name)}
              style={onboardingFieldErrorStyle(Boolean(fieldErrors.firm_name))}
            />
          </label>
          <FieldError message={fieldErrors.firm_name} />
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
            type="button"
            disabled={saving}
            onClick={() => navigate("/onboarding/accountant/basic")}
            style={onboardingSecondaryButton(saving)}
          >
            Back
          </button>
          <button type="submit" disabled={saving} style={onboardingPrimaryButton(saving)}>
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

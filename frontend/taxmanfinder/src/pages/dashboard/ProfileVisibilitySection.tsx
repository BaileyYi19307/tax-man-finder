import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  apiFieldError,
  getMyAccountantProfile,
  publishMyAccountantProfile,
  unpublishMyAccountantProfile,
  type AccountantMyProfilePayload,
  type ApiError,
  type PublishReadinessErrors,
} from "../../api/client";
import {
  ACCOUNTANT_ONBOARDING_ENTRY,
  continueSetupPath,
} from "../onboarding/onboardingSteps";

const card = {
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  padding: 16,
  marginBottom: 24,
};

const muted = { color: "#6b7280", fontSize: 13, lineHeight: 1.45 };

const primaryButton = (disabled: boolean) => ({
  padding: "8px 12px",
  borderRadius: 8,
  border: "none",
  background: disabled ? "#93c5fd" : "#2563eb",
  color: "#fff",
  fontWeight: 600,
  fontSize: 13,
  cursor: disabled ? "not-allowed" : "pointer",
});

const secondaryButton = (disabled: boolean) => ({
  padding: "8px 12px",
  borderRadius: 8,
  border: "1px solid #d1d5db",
  background: disabled ? "#f3f4f6" : "#fff",
  color: "#111827",
  fontWeight: 600,
  fontSize: 13,
  cursor: disabled ? "not-allowed" : "pointer",
});

const primaryActionLink = {
  ...primaryButton(false),
  display: "inline-block" as const,
  textDecoration: "none" as const,
  lineHeight: "normal" as const,
};

const secondaryActionLink = {
  ...secondaryButton(false),
  display: "inline-block" as const,
  textDecoration: "none" as const,
  lineHeight: "normal" as const,
};

const destructiveTextButton = (disabled: boolean) => ({
  padding: 0,
  border: "none",
  background: "transparent",
  color: disabled ? "#fca5a5" : "#b91c1c",
  fontWeight: 500,
  fontSize: 13,
  cursor: disabled ? "not-allowed" : "pointer",
  textDecoration: "underline" as const,
  textUnderlineOffset: 2,
});

export const UNPUBLISH_EXPLANATION =
  "Unpublishing removes your profile from customer discovery. Your services and existing bookings are preserved.";

function readinessMessages(errors: PublishReadinessErrors | undefined): string[] {
  if (!errors) return [];
  return Object.values(errors).flatMap((messages) =>
    Array.isArray(messages) ? messages : []
  );
}

function actionErrorMessage(err: unknown, fallback: string): string {
  if (!err || typeof err !== "object") return fallback;
  const apiErr = err as ApiError;
  const fieldKeys = ["bio", "credentials", "location", "services"] as const;
  for (const key of fieldKeys) {
    const fieldMsg = apiFieldError(apiErr, key);
    if (fieldMsg) return fieldMsg;
  }
  if (apiErr.fields && Object.keys(apiErr.fields).length > 0) {
    return Object.values(apiErr.fields)[0] || fallback;
  }
  if (
    typeof apiErr.message === "string" &&
    apiErr.message.trim() &&
    "fields" in apiErr
  ) {
    return apiErr.message;
  }
  return fallback;
}

export default function ProfileVisibilitySection() {
  const [profile, setProfile] = useState<AccountantMyProfilePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<"publish" | "unpublish" | null>(
    null
  );
  const [confirmingUnpublish, setConfirmingUnpublish] = useState(false);
  const inFlightRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        setLoadError(null);
        const data = await getMyAccountantProfile();
        if (!cancelled) setProfile(data);
      } catch (e) {
        console.error(e);
        if (!cancelled) {
          setProfile(null);
          setLoadError(
            "Could not load profile visibility. Check your connection and try again."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handlePublish() {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setPendingAction("publish");
    setActionError(null);
    setConfirmingUnpublish(false);
    try {
      const updated = await publishMyAccountantProfile();
      setProfile(updated);
    } catch (err) {
      console.error(err);
      setActionError(
        actionErrorMessage(
          err,
          "Could not publish your profile. Check your connection and try again."
        )
      );
    } finally {
      inFlightRef.current = false;
      setPendingAction(null);
    }
  }

  function requestUnpublish() {
    if (inFlightRef.current) return;
    setActionError(null);
    setConfirmingUnpublish(true);
  }

  function cancelUnpublishConfirm() {
    if (inFlightRef.current) return;
    setConfirmingUnpublish(false);
  }

  async function confirmUnpublish() {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setPendingAction("unpublish");
    setActionError(null);
    try {
      const updated = await unpublishMyAccountantProfile();
      setProfile(updated);
      setConfirmingUnpublish(false);
    } catch (err) {
      console.error(err);
      setActionError(
        actionErrorMessage(
          err,
          "Could not unpublish your profile. Check your connection and try again."
        )
      );
    } finally {
      inFlightRef.current = false;
      setPendingAction(null);
    }
  }

  if (loading) {
    return (
      <section style={card} aria-label="Profile visibility">
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Profile visibility</div>
        <div style={muted}>Loading visibility status…</div>
      </section>
    );
  }

  if (loadError || !profile) {
    return (
      <section style={card} aria-label="Profile visibility">
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Profile visibility</div>
        <div style={{ color: "#b91c1c", fontSize: 13 }}>
          {loadError || "Could not load profile visibility."}
        </div>
      </section>
    );
  }

  const isDraft = profile.publication_status === "draft";
  const isPublished = profile.publication_status === "published";
  const ready = profile.is_publish_ready;
  const isPublic = profile.is_public;
  const messages = readinessMessages(profile.publish_readiness_errors);
  const busy = pendingAction !== null;
  const incompleteDraft = isDraft && !ready;
  // Incomplete drafts: only Continue profile setup (no View / Edit / Unpublish).
  const showContinueSetup = incompleteDraft || (isDraft && ready) || (isPublished && !isPublic);
  const showLiveActions = isPublic && !incompleteDraft;
  const showPublish = isDraft && ready;
  const showUnpublish = isPublished && !incompleteDraft;
  const setupHref = continueSetupPath(profile.publish_readiness_errors);

  let statusText = "";
  if (incompleteDraft) {
    statusText = "Your profile is private.";
  } else if (isDraft && ready) {
    statusText = "Your profile is ready to publish.";
  } else if (isPublished && ready) {
    statusText = "Your profile is live.";
  } else if (isPublished && !ready) {
    statusText =
      "Your profile is currently hidden because information is missing.";
  }

  return (
    <section style={card} aria-label="Profile visibility">
      <div style={{ fontWeight: 700, marginBottom: 4 }}>Profile visibility</div>
      <div style={{ fontSize: 14, color: "#111827", marginBottom: 6 }}>{statusText}</div>

      {isPublished && !ready && (
        <div style={{ ...muted, marginBottom: 8 }}>
          It remains marked as published, but clients cannot see it until the
          issues below are fixed.
        </div>
      )}

      {messages.length > 0 && (
        <ul
          style={{
            margin: "0 0 12px",
            paddingLeft: 18,
            color: "#b91c1c",
            fontSize: 13,
            lineHeight: 1.45,
          }}
        >
          {messages.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      )}

      {actionError && (
        <div
          role="alert"
          style={{
            fontSize: 13,
            color: "#b91c1c",
            background: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: 8,
            padding: 10,
            marginBottom: 12,
          }}
        >
          {actionError}
        </div>
      )}

      {incompleteDraft ? (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <Link
            to={setupHref}
            style={{
              ...primaryButton(false),
              display: "inline-block",
              textDecoration: "none",
              lineHeight: "normal",
            }}
          >
            Continue profile setup
          </Link>
        </div>
      ) : (
        <>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            {showContinueSetup ? (
              <Link
                to={setupHref}
                style={{
                  ...primaryButton(false),
                  display: "inline-block",
                  textDecoration: "none",
                  lineHeight: "normal",
                }}
              >
                Continue profile setup
              </Link>
            ) : null}

            {showLiveActions ? (
              <>
                <Link to={`/accountants/${profile.user_id}`} style={primaryActionLink}>
                  View profile
                </Link>
                <Link to={ACCOUNTANT_ONBOARDING_ENTRY} style={secondaryActionLink}>
                  Edit profile
                </Link>
              </>
            ) : null}

            {showPublish ? (
              <button
                type="button"
                onClick={() => void handlePublish()}
                disabled={busy}
                style={primaryButton(busy)}
              >
                {pendingAction === "publish" ? "Publishing…" : "Publish profile"}
              </button>
            ) : null}

            {showUnpublish && !confirmingUnpublish ? (
              <button
                type="button"
                onClick={requestUnpublish}
                disabled={busy}
                style={destructiveTextButton(busy)}
              >
                Unpublish profile
              </button>
            ) : null}
          </div>

          {showUnpublish && confirmingUnpublish ? (
            <div
              role="group"
              aria-label="Confirm unpublish"
              style={{
                marginTop: 14,
                padding: 12,
                borderRadius: 8,
                border: "1px solid #fecaca",
                background: "#fef2f2",
              }}
            >
              <div style={{ fontSize: 13, color: "#7f1d1d", lineHeight: 1.45, marginBottom: 10 }}>
                {UNPUBLISH_EXPLANATION}
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <button
                  type="button"
                  onClick={() => void confirmUnpublish()}
                  disabled={busy}
                  style={{
                    ...primaryButton(busy),
                    background: busy ? "#fca5a5" : "#b91c1c",
                  }}
                >
                  {pendingAction === "unpublish" ? "Unpublishing…" : "Confirm unpublish"}
                </button>
                <button
                  type="button"
                  onClick={cancelUnpublishConfirm}
                  disabled={busy}
                  style={secondaryButton(busy)}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}

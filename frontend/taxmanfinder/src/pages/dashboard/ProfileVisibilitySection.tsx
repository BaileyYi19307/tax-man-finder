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
  // Prefer structured API messages (detail / first field) from readApiError.
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

  async function handleUnpublish() {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setPendingAction("unpublish");
    setActionError(null);
    try {
      const updated = await unpublishMyAccountantProfile();
      setProfile(updated);
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
  const messages = readinessMessages(profile.publish_readiness_errors);
  const busy = pendingAction !== null;

  let statusText = "";
  if (isDraft && !ready) {
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

      {((isDraft && !ready) || (isPublished && !ready)) && (
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
          <Link
            to="/dashboard/profile"
            style={{ fontSize: 13, color: "#2563eb", fontWeight: 600, textDecoration: "none" }}
          >
            Edit profile
          </Link>
          <Link
            to="/dashboard/services"
            style={{ fontSize: 13, color: "#2563eb", fontWeight: 600, textDecoration: "none" }}
          >
            Manage services
          </Link>
        </div>
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

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {isDraft && ready && (
          <button
            type="button"
            onClick={() => void handlePublish()}
            disabled={busy}
            style={primaryButton(busy)}
          >
            {pendingAction === "publish" ? "Publishing…" : "Publish profile"}
          </button>
        )}
        {isPublished && (
          <button
            type="button"
            onClick={() => void handleUnpublish()}
            disabled={busy}
            style={secondaryButton(busy)}
          >
            {pendingAction === "unpublish" ? "Unpublishing…" : "Unpublish profile"}
          </button>
        )}
      </div>
    </section>
  );
}

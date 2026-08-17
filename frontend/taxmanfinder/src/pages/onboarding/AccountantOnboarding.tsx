import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthProvider";
import { clearPostAuthRouting, signupPath } from "../../auth/intent";
import {
  createAccountantProfile,
  getMe,
  getMyAccountantProfile,
} from "../../api/client";

const page = {
  minHeight: "100vh",
  background: "#f8fafc",
  padding: "32px 16px",
};

const field = {
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid #d1d5db",
  fontSize: 14,
  outline: "none" as const,
  width: "100%",
  boxSizing: "border-box" as const,
};

export default function AccountantOnboarding() {
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [firmName, setFirmName] = useState("");
  const [location, setLocation] = useState("");
  const [bio, setBio] = useState("");
  const [credentials, setCredentials] = useState("");
  const [yearsExperience, setYearsExperience] = useState("0");
  const [serviceName, setServiceName] = useState("");
  const [serviceDescription, setServiceDescription] = useState("");
  const [hasExistingService, setHasExistingService] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      navigate(
        signupPath({
          intent: "tax-professional",
          next: "/onboarding/accountant",
        }),
        { replace: true }
      );
      return;
    }

    async function checkExisting() {
      try {
        const me = await getMe();
        setFirstName((value) => value || me.first_name || "");
        setLastName((value) => value || me.last_name || "");

        const profile = await getMyAccountantProfile();
        if (profile?.profile_complete) {
          clearPostAuthRouting();
          navigate("/dashboard/accountant", { replace: true });
          return;
        }
        if (profile) {
          setBio(profile.bio || "");
          setCredentials(profile.credentials || "");
          setYearsExperience(String(profile.years_experience || 0));
          setFirmName(profile.firm_name || "");
          setLocation(profile.location || "");
          setFirstName(profile.first_name || me.first_name || "");
          setLastName(profile.last_name || me.last_name || "");
          setHasExistingService((profile.services || []).length > 0);
        }
      } catch (e) {
        console.error(e);
        navigate(
          signupPath({
            intent: "tax-professional",
            next: "/onboarding/accountant",
          }),
          { replace: true }
        );
        return;
      } finally {
        setChecking(false);
      }
    }
    checkExisting();
  }, [navigate]);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!hasExistingService && !serviceName.trim()) {
      setError("Add at least one service so clients can find the work you offer.");
      return;
    }
    setLoading(true);
    try {
      await createAccountantProfile({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        bio: bio.trim(),
        credentials: credentials.trim(),
        years_experience: Number(yearsExperience) || 0,
        firm_name: firmName.trim(),
        location: location.trim(),
        ...(hasExistingService
          ? {}
          : {
              service_name: serviceName.trim(),
              service_description: serviceDescription.trim(),
            }),
      });
      clearPostAuthRouting();
      await refreshUser();
      navigate("/dashboard/accountant", { replace: true });
    } catch (err: any) {
      setError(err.message || "Could not save your profile. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
    return <div style={{ padding: 24 }}>Loading…</div>;
  }

  return (
    <div style={{ ...page, display: "grid", placeItems: "center" }}>
      <div
        style={{
          width: "100%",
          maxWidth: 560,
          background: "#fff",
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          padding: 20,
          boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
        }}
      >
        <Link to="/" style={{ fontSize: 13, color: "#2563eb", textDecoration: "none" }}>
          ← Home
        </Link>
        <div style={{ fontSize: 18, fontWeight: 600, color: "#111", marginTop: 12 }}>
          Set up your professional profile
        </div>
        <div style={{ fontSize: 13, color: "#6b7280", marginTop: 6, lineHeight: 1.4 }}>
          This adds accountant capabilities to your existing account. You can still
          message other accountants as a client.
        </div>

        <form onSubmit={submit} style={{ display: "grid", gap: 12, marginTop: 16 }}>
          <label style={{ fontSize: 13, color: "#111" }}>
            First name
            <input
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
              style={{ ...field, marginTop: 6 }}
            />
          </label>
          <label style={{ fontSize: 13, color: "#111" }}>
            Last name
            <input
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
              style={{ ...field, marginTop: 6 }}
            />
          </label>
          <label style={{ fontSize: 13, color: "#111" }}>
            Firm or practice name
            <input
              value={firmName}
              onChange={(e) => setFirmName(e.target.value)}
              placeholder="Optional"
              style={{ ...field, marginTop: 6 }}
            />
          </label>
          <label style={{ fontSize: 13, color: "#111" }}>
            Location or service area
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="City, state, or remote"
              style={{ ...field, marginTop: 6 }}
            />
          </label>
          <label style={{ fontSize: 13, color: "#111" }}>
            Credentials
            <input
              value={credentials}
              onChange={(e) => setCredentials(e.target.value)}
              placeholder="CPA, EA, or other credentials"
              required
              style={{ ...field, marginTop: 6 }}
            />
          </label>
          <label style={{ fontSize: 13, color: "#111" }}>
            Years of experience
            <input
              type="number"
              min="0"
              value={yearsExperience}
              onChange={(e) => setYearsExperience(e.target.value)}
              style={{ ...field, marginTop: 6 }}
            />
          </label>
          <label style={{ fontSize: 13, color: "#111" }}>
            Short professional bio
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Describe the tax work you do."
              required
              rows={4}
              style={{ ...field, marginTop: 6, resize: "vertical" }}
            />
          </label>
          {!hasExistingService && (
            <>
              <label style={{ fontSize: 13, color: "#111" }}>
                Primary service
                <input
                  value={serviceName}
                  onChange={(e) => setServiceName(e.target.value)}
                  placeholder="Individual tax returns"
                  required
                  style={{ ...field, marginTop: 6 }}
                />
              </label>
              <label style={{ fontSize: 13, color: "#111" }}>
                Service description
                <textarea
                  value={serviceDescription}
                  onChange={(e) => setServiceDescription(e.target.value)}
                  placeholder="Optional details clients will see"
                  rows={3}
                  style={{ ...field, marginTop: 6, resize: "vertical" }}
                />
              </label>
            </>
          )}

          {error && (
            <div
              style={{
                fontSize: 13,
                color: "#b91c1c",
                background: "#fef2f2",
                border: "1px solid #fecaca",
                borderRadius: 8,
                padding: 10,
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              padding: "10px 12px",
              borderRadius: 8,
              border: "none",
              background: loading ? "#93c5fd" : "#2563eb",
              color: "#fff",
              fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Saving..." : "Save profile and continue"}
          </button>
        </form>
      </div>
    </div>
  );
}

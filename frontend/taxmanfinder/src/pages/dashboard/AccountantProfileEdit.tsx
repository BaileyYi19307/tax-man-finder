import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthProvider";
import {
  createAccountantProfile,
  getMyAccountantProfile,
} from "../../api/client";

const page = {
  minHeight: "100vh",
  background: "#f8fafc",
  padding: "32px 16px",
};

const container = {
  maxWidth: 560,
  margin: "0 auto",
};

const card = {
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  padding: 20,
  boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
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

const muted = { color: "#6b7280" };

export default function AccountantProfileEdit() {
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const [userId, setUserId] = useState<number | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [firmName, setFirmName] = useState("");
  const [location, setLocation] = useState("");
  const [serviceScope, setServiceScope] = useState<"local" | "remote" | "nationwide">(
    "local"
  );
  const [bio, setBio] = useState("");
  const [credentials, setCredentials] = useState("");
  const [yearsExperience, setYearsExperience] = useState("0");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const profile = await getMyAccountantProfile();
        if (!profile) {
          navigate("/onboarding/accountant", { replace: true });
          return;
        }
        if (!cancelled) {
          setUserId(profile.user_id);
          setFirstName(profile.first_name || "");
          setLastName(profile.last_name || "");
          setFirmName(profile.firm_name || "");
          setLocation(profile.location || "");
          setServiceScope(
            profile.service_scope === "remote" || profile.service_scope === "nationwide"
              ? profile.service_scope
              : "local"
          );
          setBio(profile.bio || "");
          setCredentials(profile.credentials || "");
          setYearsExperience(String(profile.years_experience || 0));
        }
      } catch (e) {
        console.error(e);
        if (!cancelled) setError("Could not load your profile.");
      } finally {
        if (!cancelled) setChecking(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const profile = await createAccountantProfile({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        bio: bio.trim(),
        credentials: credentials.trim(),
        years_experience: Number(yearsExperience) || 0,
        firm_name: firmName.trim(),
        location: location.trim(),
        service_scope: serviceScope,
      });
      setUserId(profile.user_id);
      await refreshUser();
      navigate(`/accountants/${profile.user_id}`);
    } catch (err: any) {
      setError(err.message || "Could not save your profile. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <div style={page}>
        <div style={container}>
          <div style={muted}>Loading profile…</div>
        </div>
      </div>
    );
  }

  return (
    <div style={page}>
      <div style={container}>
        <Link to="/dashboard/accountant" style={{ fontSize: 13, color: "#2563eb", textDecoration: "none" }}>
          ← Dashboard
        </Link>
        <div style={{ ...card, marginTop: 12 }}>
          <div style={{ fontSize: 18, fontWeight: 600, color: "#111" }}>Edit profile</div>
          <div style={{ fontSize: 13, ...muted, marginTop: 6, lineHeight: 1.4 }}>
            Update how clients see you. After you save, you will be taken to your public listing.
          </div>
          {userId && (
            <div style={{ marginTop: 10 }}>
              <Link
                to={`/accountants/${userId}`}
                style={{ fontSize: 13, color: "#2563eb", textDecoration: "none", fontWeight: 600 }}
              >
                Cancel and view public profile
              </Link>
            </div>
          )}

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
              Location
              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Philadelphia, PA"
                style={{ ...field, marginTop: 6 }}
              />
            </label>
            <label style={{ fontSize: 13, color: "#111" }}>
              How you serve clients
              <select
                value={serviceScope}
                onChange={(e) =>
                  setServiceScope(e.target.value as "local" | "remote" | "nationwide")
                }
                style={{ ...field, marginTop: 6 }}
              >
                <option value="local">Local / in-person</option>
                <option value="remote">Remote</option>
                <option value="nationwide">Nationwide</option>
              </select>
            </label>
            <label style={{ fontSize: 13, color: "#111" }}>
              Credentials
              <input
                value={credentials}
                onChange={(e) => setCredentials(e.target.value)}
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
                required
                rows={4}
                style={{ ...field, marginTop: 6, resize: "vertical" }}
              />
            </label>

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
              {loading ? "Saving..." : "Save profile"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import type { AccountantProfilePayload } from "../../api/client";
import { accountantDisplayName, accountantFirmLocationLine } from "./displayName";

const card = {
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  padding: 20,
  boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
};

const muted = { color: "#6b7280", fontSize: 14, lineHeight: 1.45 };

function initialsFor(profile: AccountantProfilePayload) {
  const first = (profile.first_name || "").trim().charAt(0);
  const last = (profile.last_name || "").trim().charAt(0);
  return `${first}${last}`.toUpperCase() || "?";
}

function availabilityLabel(profile: AccountantProfilePayload) {
  const parts: string[] = [];
  if (profile.offers_remote) parts.push("Remote");
  if (profile.offers_in_person) parts.push("In person");
  if (parts.length) return parts.join(" · ");
  if (profile.service_scope === "remote") return "Remote";
  if (profile.service_scope === "nationwide") return "Nationwide";
  return null;
}

function formatConsultationFeeLabel(fee: string | null | undefined) {
  if (fee == null || fee === "" || Number(fee) === 0) {
    return "Free consultation";
  }
  return `$${fee} consultation fee`;
}

function formatPriceLabel(service: AccountantProfilePayload["services"][number]) {
  if (service.pricing_type === "consultation_required") {
    return "Consultation required";
  }
  if (service.indicative_price == null || service.indicative_price === "") {
    return "Price on request";
  }
  if (service.pricing_type === "hourly") {
    return `$${service.indicative_price}/hr`;
  }
  return `$${service.indicative_price}`;
}

export type AccountantProfilePresentationProps = {
  profile: AccountantProfilePayload;
  /** Optional actions under the profile body (Message / Request, etc.). */
  actions?: ReactNode;
  /** Optional content above the card (e.g. back link). */
  header?: ReactNode;
  showEditLink?: boolean;
  editHref?: string;
};

export default function AccountantProfilePresentation({
  profile,
  actions,
  header,
  showEditLink = false,
  editHref = "/dashboard/profile",
}: AccountantProfilePresentationProps) {
  const subtitle = accountantFirmLocationLine(profile);
  const availability = availabilityLabel(profile);
  const languages = Array.isArray(profile.languages) ? profile.languages : [];
  const industries = Array.isArray(profile.industries) ? profile.industries : [];
  const website = (profile.website || "").trim();
  const license = (profile.license_information || "").trim();
  const headline = (profile.headline || "").trim();

  return (
    <div>
      {header}
      <div style={{ ...card, marginTop: header ? 16 : 0 }}>
        <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
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
            {initialsFor(profile)}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#111827" }}>
              {accountantDisplayName(profile)}
            </div>
            {headline ? (
              <div style={{ marginTop: 4, fontSize: 15, color: "#374151" }}>
                {headline}
              </div>
            ) : null}
            {showEditLink ? (
              <div style={{ marginTop: 8 }}>
                <Link
                  to={editHref}
                  style={{
                    fontSize: 13,
                    color: "#2563eb",
                    textDecoration: "none",
                    fontWeight: 600,
                  }}
                >
                  Edit profile
                </Link>
              </div>
            ) : null}
            {subtitle ? (
              <div style={{ ...muted, marginTop: 8 }}>{subtitle}</div>
            ) : null}
            {availability ? (
              <div style={{ marginTop: 8, fontSize: 13, color: "#065f46" }}>
                {availability}
              </div>
            ) : null}
            <div style={{ ...muted, marginTop: 4 }}>
              {profile.years_experience} years experience
            </div>
          </div>
        </div>

        {profile.credentials ? (
          <div style={{ marginTop: 16, fontSize: 14 }}>
            <strong>Credentials</strong>
            <div style={{ ...muted, marginTop: 4 }}>{profile.credentials}</div>
          </div>
        ) : null}

        {profile.location ? (
          <div style={{ marginTop: 12, fontSize: 14 }}>
            <strong>Location</strong>
            <div style={{ ...muted, marginTop: 4 }}>{profile.location}</div>
          </div>
        ) : null}

        {languages.length > 0 ? (
          <div style={{ marginTop: 12, fontSize: 14 }}>
            <strong>Languages</strong>
            <div style={{ ...muted, marginTop: 4 }}>{languages.join(", ")}</div>
          </div>
        ) : null}

        {profile.bio ? (
          <div style={{ marginTop: 12, fontSize: 14 }}>
            <strong>Bio</strong>
            <div style={{ ...muted, marginTop: 4, lineHeight: 1.5 }}>{profile.bio}</div>
          </div>
        ) : null}

        {industries.length > 0 ? (
          <div style={{ marginTop: 12, fontSize: 14 }}>
            <strong>Industries / client types</strong>
            <div style={{ ...muted, marginTop: 4 }}>{industries.join(", ")}</div>
          </div>
        ) : null}

        {website ? (
          <div style={{ marginTop: 12, fontSize: 14 }}>
            <strong>Website</strong>
            <div style={{ marginTop: 4 }}>
              <a
                href={website}
                target="_blank"
                rel="noreferrer"
                style={{ color: "#2563eb", fontSize: 14 }}
              >
                {website}
              </a>
            </div>
          </div>
        ) : null}

        {license ? (
          <div style={{ marginTop: 12, fontSize: 14 }}>
            <strong>License information</strong>
            <div style={{ ...muted, marginTop: 4 }}>{license}</div>
          </div>
        ) : null}

        <div style={{ marginTop: 18 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Services</div>
          {profile.services.length === 0 ? (
            <div style={muted}>No active services listed.</div>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              {profile.services.map((s) => (
                <div
                  key={s.id}
                  style={{
                    border: "1px solid #e5e7eb",
                    borderRadius: 10,
                    padding: 12,
                    background: "#f9fafb",
                  }}
                >
                  <div style={{ fontWeight: 700, color: "#111827" }}>
                    <Link
                      to={`/services/${s.id}`}
                      style={{ color: "#111827", textDecoration: "none" }}
                    >
                      {s.name}
                    </Link>
                  </div>
                  {s.category?.name ? (
                    <div style={{ ...muted, marginTop: 4, fontSize: 12 }}>
                      Category: {s.category.name}
                    </div>
                  ) : null}
                  {s.description ? (
                    <div style={{ ...muted, marginTop: 6, fontSize: 13 }}>
                      {s.description}
                    </div>
                  ) : null}
                  <div style={{ ...muted, marginTop: 6, fontSize: 12 }}>
                    {formatPriceLabel(s)} · {formatConsultationFeeLabel(s.consultation_fee)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {actions ? <div style={{ marginTop: 18 }}>{actions}</div> : null}
      </div>
    </div>
  );
}

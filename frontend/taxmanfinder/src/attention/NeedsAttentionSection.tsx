import { Link } from "react-router-dom";
import type { AttentionSummary } from "./summary";

const section = {
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  padding: 16,
  marginBottom: 24,
};

const muted = { color: "#6b7280", fontSize: 13 };

type Props = {
  summary: AttentionSummary;
};

export default function NeedsAttentionSection({ summary }: Props) {
  const showNeeds = summary.needsAttention.length > 0;
  const showUpcoming = summary.upcoming.length > 0;
  if (!showNeeds && !showUpcoming) return null;

  return (
    <>
      {showNeeds && (
        <div style={section} data-testid="needs-attention">
          <div style={{ fontWeight: 700, marginBottom: 10 }}>Needs attention</div>
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {summary.needsAttention.map((item) => (
              <li key={item.key} style={{ padding: "6px 0" }}>
                <Link
                  to={item.to}
                  style={{ color: "#2563eb", textDecoration: "none", fontWeight: 600 }}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      {showUpcoming && (
        <div style={section} data-testid="upcoming-consultations">
          <div style={{ fontWeight: 700, marginBottom: 10 }}>Upcoming</div>
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {summary.upcoming.map((item) => (
              <li key={item.key} style={{ padding: "6px 0" }}>
                <Link
                  to={item.to}
                  style={{ color: "#111827", textDecoration: "none", fontWeight: 600 }}
                >
                  {item.label}
                </Link>
                <div style={{ ...muted, marginTop: 2 }}>View in Consultations</div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

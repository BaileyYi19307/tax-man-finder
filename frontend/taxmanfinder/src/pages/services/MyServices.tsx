import { Link } from "react-router-dom";
import ServiceManagementPanel from "./ServiceManagementPanel";

const page = {
  minHeight: "100vh",
  background: "#f8fafc",
  padding: "32px 16px",
};

const container = {
  maxWidth: 960,
  margin: "0 auto",
};

const muted = { color: "#6b7280" };

export default function MyServices() {
  return (
    <div style={page}>
      <div style={container}>
        <Link
          to="/dashboard/accountant"
          style={{ fontSize: 13, color: "#2563eb", textDecoration: "none" }}
        >
          ← Dashboard
        </Link>
        <div
          style={{ fontSize: 22, fontWeight: 700, color: "#111827", marginTop: 12 }}
        >
          My Services
        </div>
        <div style={{ ...muted, fontSize: 13, marginTop: 4, marginBottom: 16 }}>
          Manage the services listed on your public profile.
        </div>
        <ServiceManagementPanel />
      </div>
    </div>
  );
}

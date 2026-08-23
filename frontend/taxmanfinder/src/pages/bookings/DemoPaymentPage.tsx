import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  completeDemoPayment,
  listMyBookings,
  type Booking,
} from "../../api/client";

function formatMoney(amount: string, currency = "USD") {
  const value = Number(amount);
  if (Number.isNaN(value)) return `$${amount}`;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(value);
}

export default function DemoPaymentPage() {
  const { bookingId } = useParams();
  const navigate = useNavigate();
  const token = localStorage.getItem("access_token");
  const currentUserId = Number(localStorage.getItem("user_id"));
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    async function load() {
      if (!token) {
        navigate(`/login?next=/bookings/${bookingId}/pay`);
        return;
      }
      try {
        setLoading(true);
        setError(null);
        const rows = await listMyBookings();
        const match = rows.find((row) => String(row.id) === String(bookingId));
        if (!match) {
          setError("Booking not found.");
          setBooking(null);
          return;
        }
        setBooking(match);
      } catch (e) {
        console.error(e);
        setError("Could not load this consultation.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [bookingId, navigate, token]);

  async function onCompleteDemoPayment() {
    if (!booking || paying) return;
    try {
      setPaying(true);
      setError(null);
      const updated = await completeDemoPayment(booking.id);
      setBooking(updated);
      navigate("/bookings", { replace: true });
    } catch (e) {
      console.error(e);
      setError("Could not complete demo payment.");
    } finally {
      setPaying(false);
    }
  }

  if (loading) {
    return <div style={{ padding: 24 }}>Loading payment details…</div>;
  }

  if (!booking) {
    return (
      <div style={{ padding: 24 }}>
        <p>{error || "Booking not found."}</p>
        <Link to="/bookings">Back to consultations</Link>
      </div>
    );
  }

  const isClient = booking.client === currentUserId;
  const needsPayment = booking.status === "awaiting_payment";
  const fee = booking.payment?.amount || booking.consultation_fee;

  return (
    <div style={{ maxWidth: 560, margin: "32px auto", padding: "0 16px" }}>
      <Link to="/bookings" style={{ fontSize: 13, color: "#2563eb", textDecoration: "none" }}>
        ← Consultations
      </Link>
      <h1 style={{ fontSize: 24, margin: "12px 0 8px" }}>Consultation payment</h1>
      <p style={{ color: "#6b7280", fontSize: 14, marginTop: 0 }}>
        Demo workflow only — no real charge is processed.
      </p>

      <div
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          padding: 16,
          background: "#fff",
          display: "grid",
          gap: 10,
        }}
      >
        <div>
          <div style={{ fontSize: 12, color: "#6b7280" }}>Accountant</div>
          <div>{booking.accountant_email}</div>
        </div>
        <div>
          <div style={{ fontSize: 12, color: "#6b7280" }}>Service</div>
          <div>{booking.service_name || "General consultation"}</div>
        </div>
        <div>
          <div style={{ fontSize: 12, color: "#6b7280" }}>Date & time</div>
          <div>
            {new Date(booking.starts_at).toLocaleString()} –{" "}
            {new Date(booking.ends_at).toLocaleString()}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 12, color: "#6b7280" }}>Consultation fee</div>
          <div style={{ fontWeight: 700 }}>{formatMoney(fee, booking.payment?.currency || "USD")}</div>
        </div>
        {booking.cancellation_policy ? (
          <div>
            <div style={{ fontSize: 12, color: "#6b7280" }}>Cancellation policy</div>
            <div style={{ fontSize: 14, whiteSpace: "pre-wrap" }}>
              {booking.cancellation_policy}
            </div>
          </div>
        ) : null}
        <div>
          <div style={{ fontSize: 12, color: "#6b7280" }}>Status</div>
          <div>
            <strong>{booking.status_label}</strong>
            {booking.payment ? ` · payment ${booking.payment.status_label}` : null}
          </div>
        </div>
      </div>

      {error && <p style={{ color: "#b91c1c" }}>{error}</p>}

      {!isClient && (
        <p style={{ marginTop: 16 }}>Only the client can complete this payment.</p>
      )}

      {isClient && needsPayment && (
        <button
          type="button"
          disabled={paying}
          onClick={() => void onCompleteDemoPayment()}
          style={{
            marginTop: 16,
            padding: "10px 14px",
            borderRadius: 8,
            border: "none",
            background: paying ? "#93c5fd" : "#2563eb",
            color: "#fff",
            fontWeight: 600,
            cursor: paying ? "not-allowed" : "pointer",
          }}
        >
          {paying ? "Completing…" : "Complete Demo Payment"}
        </button>
      )}

      {isClient && !needsPayment && (
        <p style={{ marginTop: 16 }}>
          This consultation does not need payment right now.{" "}
          <Link to="/bookings">Return to consultations</Link>
        </p>
      )}
    </div>
  );
}

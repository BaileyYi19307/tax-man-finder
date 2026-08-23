import "../../styles/BookingsPage.css";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  acceptBooking,
  cancelBooking,
  declineBooking,
  listMyBookings,
  type Booking,
} from "../../api/client";

function paymentSummary(booking: Booking, isAccountant: boolean): string | null {
  const amount = `$${booking.payment?.amount ?? booking.consultation_fee}`;
  if (booking.status === "pending") {
    return isAccountant
      ? "Pending approval"
      : "Awaiting accountant approval";
  }
  if (booking.status === "awaiting_payment") {
    return isAccountant
      ? `${amount} awaiting client payment`
      : `${amount} payment required`;
  }
  const payment = booking.payment;
  if (!payment) {
    if (booking.status === "confirmed" && Number(booking.consultation_fee) === 0) {
      return "Free consultation · Confirmed";
    }
    if (booking.status === "confirmed") {
      return "Confirmed";
    }
    return null;
  }
  if (payment.status === "pending") {
    return isAccountant
      ? `${amount} awaiting client payment`
      : `${amount} payment required`;
  }
  if (payment.status === "paid") {
    return isAccountant
      ? `${amount} paid by client · available after consultation`
      : `${amount} paid · Confirmed`;
  }
  if (payment.status === "payable") {
    return isAccountant
      ? `${amount} available for payout`
      : `${amount} paid · Confirmed`;
  }
  return null;
}

export default function BookingsPage() {
  const token = localStorage.getItem("access_token");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actingBookingId, setActingBookingId] = useState<number | null>(null);
  const navigate = useNavigate();
  const currentUserId = Number(localStorage.getItem("user_id"));

  useEffect(() => {
    async function fetchBookings() {
      try {
        setLoading(true);
        setError(null);
        if (!token) {
          navigate("/login?next=/bookings");
          return;
        }
        setBookings(await listMyBookings());
      } catch (e) {
        setError("Could not load bookings");
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    fetchBookings();
  }, [token, navigate]);

  async function refresh() {
    setBookings(await listMyBookings());
  }

  async function runBookingAction(
    bookingId: number,
    action: () => Promise<unknown>,
    failureMessage: string
  ) {
    if (actingBookingId !== null) return;
    try {
      setActingBookingId(bookingId);
      setActionError(null);
      await action();
      await refresh();
    } catch (e) {
      console.error(e);
      setActionError(failureMessage);
    } finally {
      setActingBookingId(null);
    }
  }

  if (loading) return <div className="bookings-page">Loading bookings…</div>;
  if (error) return <div className="bookings-page">{error}</div>;

  return (
    <div className="bookings-page">
      <h2>My consultations</h2>
      {actionError && <p style={{ color: "#b91c1c" }}>{actionError}</p>}
      {bookings.length === 0 ? (
        <p>No bookings yet.</p>
      ) : (
        <ul className="bookings-list">
          {bookings.map((b) => {
            const rowBusy = actingBookingId === b.id;
            const isClient = b.client === currentUserId;
            const isAccountant = b.accountant === currentUserId;
            const summary = paymentSummary(b, isAccountant);
            return (
              <li key={b.id} className="booking-card">
                <div>
                  <strong>{b.status_label}</strong> with{" "}
                  {isClient ? b.accountant_email : b.client_email}
                </div>
                <div className="booking-meta">
                  {new Date(b.starts_at).toLocaleString()} –{" "}
                  {new Date(b.ends_at).toLocaleString()}
                </div>
                {b.service_name && (
                  <div className="booking-meta">{b.service_name}</div>
                )}
                {summary && <div className="booking-summary">{summary}</div>}
                <div className="booking-actions">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => navigate(`/chat/${b.inquiry_id}`)}
                  >
                    Open chat
                  </button>
                  {b.status === "pending" && isAccountant && (
                    <>
                      <button
                        type="button"
                        className="btn btn-primary"
                        disabled={rowBusy}
                        onClick={() =>
                          runBookingAction(
                            b.id,
                            () => acceptBooking(b.id),
                            "Could not accept booking. It may overlap another confirmed consultation."
                          )
                        }
                      >
                        Accept
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        disabled={rowBusy}
                        onClick={() =>
                          runBookingAction(
                            b.id,
                            () => declineBooking(b.id),
                            "Could not decline booking."
                          )
                        }
                      >
                        Decline
                      </button>
                    </>
                  )}
                  {b.status === "awaiting_payment" && isClient && (
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => navigate(`/bookings/${b.id}/pay`)}
                    >
                      Pay consultation fee
                    </button>
                  )}
                  {(b.status === "pending" ||
                    b.status === "awaiting_payment" ||
                    b.status === "confirmed") && (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      disabled={rowBusy}
                      onClick={() =>
                        runBookingAction(
                          b.id,
                          () => cancelBooking(b.id),
                          "Could not cancel booking."
                        )
                      }
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

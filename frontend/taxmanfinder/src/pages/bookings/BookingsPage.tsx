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
      {actionError && (
        <p style={{ color: "#b91c1c" }}>{actionError}</p>
      )}
      {bookings.length === 0 ? (
        <p>No bookings yet.</p>
      ) : (
        <ul className="bookings-list">
          {bookings.map((b) => {
            const rowBusy = actingBookingId === b.id;
            return (
            <li key={b.id} className="booking-card">
              <div>
                <strong>{b.status_label}</strong> with{" "}
                {b.client === currentUserId ? b.accountant_email : b.client_email}
              </div>
              <div>
                {new Date(b.starts_at).toLocaleString()} –{" "}
                {new Date(b.ends_at).toLocaleString()}
              </div>
              <div className="booking-actions">
                <button type="button" onClick={() => navigate(`/chat/${b.inquiry_id}`)}>
                  Open chat
                </button>
                {b.status === "pending" && b.accountant === currentUserId && (
                  <>
                    <button
                      type="button"
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
                {(b.status === "pending" || b.status === "confirmed") && (
                  <button
                    type="button"
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

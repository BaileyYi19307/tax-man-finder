import { useNavigate, useParams } from "react-router-dom";
import { useState, useEffect, useCallback } from "react";
import MessageList from "../../../components/MessageList";
import MessageInput, { type MessageSendPayload } from "../../../components/MessageInput";
import { useChatSocket } from "../../../hooks/hooks/useChatSocket";
import {
  acceptBooking,
  apiFetch,
  cancelBooking,
  declineBooking,
  downloadInquiryAttachment,
  getPublicAccountantProfile,
  listInquiryAttachments,
  listInquiryBookings,
  requestConsultation,
  sendInquiryMessage,
  sendInquiryMessageWithFiles,
  type AttachmentPayload,
  type Booking,
  type ChatMessagePayload,
} from "../../../api/client";

type Message = ChatMessagePayload;
type AccountantService = {
  id: number;
  name: string;
  consultation_fee?: string | null;
  cancellation_policy?: string;
};

const ACTIVE_BOOKING_STATUSES = new Set([
  "pending",
  "awaiting_payment",
  "confirmed",
]);

function formatDateTime(timestamp: string | null) {
  if (!timestamp) return "—";
  return new Date(timestamp).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function ConversationView() {
  const token = localStorage.getItem("access_token");
  const navigate = useNavigate();
  const { inquiryId } = useParams<{ inquiryId: string }>();
  const [inquiryLastReadAt, setInquiryLastReadAt] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [attachments, setAttachments] = useState<AttachmentPayload[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [actionError, setActionError] = useState<string | null>(null);
  const [inquiryStatus, setInquiryStatus] = useState<string | null>(null);
  const [inquiryClientId, setInquiryClientId] = useState<number | null>(null);
  const [inquiryAccountantId, setInquiryAccountantId] = useState<number | null>(null);
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [bookingDate, setBookingDate] = useState("");
  const [bookingNote, setBookingNote] = useState("");
  const [bookingServiceId, setBookingServiceId] = useState("");
  const [accountantServices, setAccountantServices] = useState<AccountantService[]>([]);
  const [bookingBusy, setBookingBusy] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const currentUserId = Number(localStorage.getItem("user_id"));

  const refreshAttachments = useCallback(async () => {
    if (!inquiryId) return;
    try {
      setAttachments(await listInquiryAttachments(inquiryId));
    } catch (e) {
      console.error(e);
    }
  }, [inquiryId]);

  const refreshBookings = useCallback(async () => {
    if (!inquiryId) return;
    try {
      setBookings(await listInquiryBookings(inquiryId));
    } catch (e) {
      console.error(e);
    }
  }, [inquiryId]);

  const reloadMessages = useCallback(async () => {
    if (!inquiryId || !token) return;
    try {
      const inquiryResponse = await apiFetch(`/api/inquiries/${inquiryId}/`);
      if (inquiryResponse.ok) {
        const inquiryData = await inquiryResponse.json();
        setMessages(inquiryData.messages || []);
      }
    } catch (e) {
      console.error(e);
    }
  }, [inquiryId, token]);

  const handleIncoming = useCallback(
    (incoming: Message) => {
      if (!incoming?.id) return;
      const isSystem = Boolean(incoming.is_system);
      // Own ordinary chat echoes are handled optimistically; system events from
      // the other party still land here. Actor refreshes messages after actions.
      if (!isSystem && incoming.sender_id === currentUserId) return;
      const hasText = Boolean(incoming.content && incoming.content.trim());
      const hasFiles = Boolean(incoming.attachments && incoming.attachments.length);
      if (!hasText && !hasFiles) return;
      setMessages((prev) => {
        if (prev.some((m) => m.id === incoming.id)) return prev;
        return [
          ...prev,
          {
            ...incoming,
            is_system: isSystem,
            attachments: incoming.attachments || [],
          },
        ];
      });
      if (isSystem) {
        void refreshBookings();
      }
      if (hasFiles) {
        void refreshAttachments();
      }
    },
    [currentUserId, refreshAttachments, refreshBookings]
  );

  const handleSocketClose = useCallback(
    (code: number) => {
      if (code !== 4008) return;
      setInquiryStatus("closed");
      setActionError("This inquiry is closed. New messages were not sent.");
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last && last.sender_id === currentUserId && last.id > 1e12) {
          return prev.slice(0, -1);
        }
        return prev;
      });
    },
    [currentUserId]
  );

  const { sendMessage } = useChatSocket(
    Number(inquiryId),
    token,
    handleIncoming,
    handleSocketClose
  );

  async function handleSend({ text, files }: MessageSendPayload) {
    const trimmed = text.trim();
    if (!trimmed && files.length === 0) return false;
    if (inquiryStatus === "closed") {
      setActionError("This inquiry is closed. New messages were not sent.");
      return false;
    }

    if (files.length === 0) {
      if (sendMessage(trimmed)) {
        setActionError(null);
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now(),
            content: trimmed,
            sender_id: currentUserId,
            created_at: new Date().toISOString(),
            attachments: [],
          },
        ]);
        return true;
      }
      try {
        setActionError(null);
        const created = await sendInquiryMessage(inquiryId!, trimmed);
        const payload = created.message || {
          id: created.message_id,
          content: trimmed,
          sender_id: currentUserId,
          created_at: new Date().toISOString(),
          attachments: [],
        };
        setMessages((prev) => [...prev, payload]);
        return true;
      } catch (e) {
        console.error(e);
        setActionError("Message was not sent. Please try again.");
        return false;
      }
    }

    try {
      setActionError(null);
      const created = await sendInquiryMessageWithFiles(inquiryId!, trimmed, files);
      setMessages((prev) => [...prev, created.message]);
      await refreshAttachments();
      return true;
    } catch (e) {
      console.error(e);
      setActionError("Message was not sent. Please try again.");
      return false;
    }
  }

  async function onDownloadAttachment(attachment: AttachmentPayload) {
    if (!inquiryId) return;
    try {
      await downloadInquiryAttachment(
        inquiryId,
        attachment.id,
        attachment.original_filename
      );
    } catch (e) {
      console.error(e);
      setActionError("Could not download file.");
    }
  }

  useEffect(() => {
    async function fetchInquiryDetails() {
      if (!inquiryId || !token) return;
      try {
        const inquiryResponse = await apiFetch(`/api/inquiries/${inquiryId}/`);
        if (inquiryResponse.ok) {
          const inquiryData = await inquiryResponse.json();
          setMessages(inquiryData.messages || []);
          setInquiryStatus(inquiryData.inquiry?.status ?? null);
          setInquiryClientId(
            inquiryData.inquiry?.client != null
              ? Number(inquiryData.inquiry.client)
              : null
          );
          setInquiryAccountantId(
            inquiryData.inquiry?.accountant != null
              ? Number(inquiryData.inquiry.accountant)
              : null
          );
        }

        const readStateResponse = await apiFetch(
          `/api/inquiries/${inquiryId}/mark-read/`,
          { method: "POST" }
        );
        if (readStateResponse.ok) {
          const readStateData = await readStateResponse.json();
          setInquiryLastReadAt(readStateData.last_read_at);
        }

        await refreshBookings();
        await refreshAttachments();
      } catch (error) {
        console.error("history fetch failed", error);
      }
    }
    fetchInquiryDetails();
  }, [inquiryId, token, refreshAttachments, refreshBookings]);

  async function onAccept(id: number) {
    try {
      setActionError(null);
      await acceptBooking(id);
      await refreshBookings();
      await reloadMessages();
    } catch {
      setActionError("Could not accept booking.");
    }
  }

  async function onDecline(id: number) {
    try {
      setActionError(null);
      await declineBooking(id);
      await refreshBookings();
      await reloadMessages();
    } catch {
      setActionError("Could not decline booking.");
    }
  }

  async function onCancel(id: number) {
    try {
      setActionError(null);
      await cancelBooking(id);
      await refreshBookings();
      await reloadMessages();
    } catch {
      setActionError("Could not cancel booking.");
    }
  }

  async function openBookingForm() {
    setBookingError(null);
    setBookingNote("");
    setBookingDate("");
    setBookingServiceId("");
    setShowBookingForm(true);
    if (!inquiryAccountantId) return;
    try {
      const profile = await getPublicAccountantProfile(inquiryAccountantId);
      const services = profile.services || [];
      setAccountantServices(services);
      if (services.length === 1) {
        setBookingServiceId(String(services[0].id));
      }
    } catch (e) {
      console.error(e);
      setAccountantServices([]);
    }
  }

  function closeBookingForm() {
    setShowBookingForm(false);
    setBookingError(null);
    setBookingNote("");
    setBookingDate("");
    setBookingServiceId("");
  }

  function formatFeeLabel(fee?: string | null) {
    if (fee == null || fee === "" || Number(fee) === 0) {
      return "Free consultation";
    }
    return `$${fee} consultation fee`;
  }

  function formatFeeAmount(fee?: string | null) {
    if (fee == null || fee === "" || Number(fee) === 0) {
      return "Free";
    }
    return `$${fee}`;
  }

  async function submitConsultation() {
    if (!inquiryId) return;
    const content = bookingNote.trim();
    if (!content) {
      setBookingError("Please include a brief note.");
      return;
    }
    if (!bookingDate) {
      setBookingError("Please choose a start date and time.");
      return;
    }
    if (!bookingServiceId) {
      setBookingError("Select a service so the correct consultation fee applies.");
      return;
    }

    setBookingBusy(true);
    setBookingError(null);
    try {
      await requestConsultation({
        inquiry: Number(inquiryId),
        starts_at: new Date(bookingDate).toISOString(),
        content,
        service: Number(bookingServiceId),
      });
      closeBookingForm();
      setActionError(null);
      await refreshBookings();
      await reloadMessages();
    } catch (e) {
      console.error(e);
      setBookingError(
        "Could not request consultation. There may already be an active booking on this conversation."
      );
    } finally {
      setBookingBusy(false);
    }
  }

  const hasActiveBooking = bookings.some((b) =>
    ACTIVE_BOOKING_STATUSES.has(b.status)
  );
  const canRequestConsultation =
    inquiryStatus === "open" &&
    inquiryClientId === currentUserId &&
    !hasActiveBooking;
  const selectedBookingService = accountantServices.find(
    (s) => String(s.id) === bookingServiceId
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ padding: "8px 12px", fontSize: 13, color: "#6b7280" }}>
        Inquiry {inquiryId} · Last read {formatDateTime(inquiryLastReadAt)}
      </div>

      <div
        style={{
          padding: "8px 12px",
          borderBottom: "1px solid #e5e7eb",
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ fontWeight: 700, fontSize: 14 }}>Consultations</div>
        {canRequestConsultation && (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={openBookingForm}
          >
            Request consultation
          </button>
        )}
      </div>

      {bookings.length > 0 && (
        <div style={{ padding: "8px 12px", borderBottom: "1px solid #e5e7eb" }}>
          {bookings.map((b) => (
            <div
              key={b.id}
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 8,
                padding: 10,
                marginBottom: 8,
                background: "#f8fafc",
              }}
            >
              <div style={{ fontSize: 14 }}>
                <strong>{b.status_label}</strong>
                {b.service_name ? ` · ${b.service_name}` : ""} ·{" "}
                {formatDateTime(b.starts_at)} – {formatDateTime(b.ends_at)}
              </div>
              {b.status === "awaiting_payment" && b.client === currentUserId && (
                <div style={{ fontSize: 13, color: "#92400e", marginTop: 6 }}>
                  Payment required · ${b.consultation_fee}
                </div>
              )}
              {b.status === "awaiting_payment" && b.accountant === currentUserId && (
                <div style={{ fontSize: 13, color: "#4b5563", marginTop: 6 }}>
                  Awaiting client payment · ${b.consultation_fee}
                </div>
              )}
              {b.payment?.status === "paid" && b.accountant === currentUserId && (
                <div style={{ fontSize: 13, color: "#4b5563", marginTop: 6 }}>
                  ${b.payment.amount} paid by client · available after consultation
                </div>
              )}
              {b.payment?.status === "payable" && b.accountant === currentUserId && (
                <div style={{ fontSize: 13, color: "#4b5563", marginTop: 6 }}>
                  ${b.payment.amount} available for payout
                </div>
              )}
              <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                {b.status === "pending" && b.accountant === currentUserId && (
                  <>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => onAccept(b.id)}
                    >
                      Accept
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => onDecline(b.id)}
                    >
                      Decline
                    </button>
                  </>
                )}
                {b.status === "awaiting_payment" && b.client === currentUserId && (
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
                    onClick={() => onCancel(b.id)}
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showBookingForm && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            zIndex: 40,
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 12,
              padding: 20,
              width: "100%",
              maxWidth: 420,
            }}
          >
            <h3 style={{ marginTop: 0 }}>Request consultation</h3>
            <p style={{ color: "#6b7280", fontSize: 13 }}>
              Fixed 30-minute consultation on this conversation.
            </p>
            <label style={{ display: "block", fontSize: 14, marginBottom: 12 }}>
              Service
              <select
                value={bookingServiceId}
                onChange={(e) => setBookingServiceId(e.target.value)}
                required
                style={{ width: "100%", marginTop: 6, padding: 8, boxSizing: "border-box" }}
              >
                <option value="">Select a service</option>
                {accountantServices.map((s) => (
                  <option key={s.id} value={String(s.id)}>
                    {s.name} — {formatFeeLabel(s.consultation_fee)}
                  </option>
                ))}
              </select>
            </label>
            {accountantServices.length === 0 && (
              <div style={{ color: "#b91c1c", fontSize: 13, marginBottom: 12 }}>
                This accountant has no active services available for consultation.
              </div>
            )}
            {selectedBookingService && (
              <div
                style={{
                  fontSize: 13,
                  color: "#374151",
                  marginBottom: 12,
                  padding: "8px 10px",
                  background: "#f8fafc",
                  border: "1px solid #e5e7eb",
                  borderRadius: 8,
                }}
              >
                <div>
                  <strong>Consultation fee:</strong>{" "}
                  {formatFeeAmount(selectedBookingService.consultation_fee)}
                </div>
                {selectedBookingService.cancellation_policy?.trim() ? (
                  <div style={{ marginTop: 6 }}>
                    <strong>Cancellation policy:</strong>{" "}
                    {selectedBookingService.cancellation_policy.trim()}
                  </div>
                ) : null}
              </div>
            )}
            <label style={{ display: "block", fontSize: 14, marginBottom: 12 }}>
              Date and time
              <input
                type="datetime-local"
                value={bookingDate}
                onChange={(e) => setBookingDate(e.target.value)}
                style={{ width: "100%", marginTop: 6, padding: 8, boxSizing: "border-box" }}
              />
            </label>
            <label style={{ display: "block", fontSize: 14, marginBottom: 12 }}>
              Brief note
              <textarea
                value={bookingNote}
                onChange={(e) => setBookingNote(e.target.value)}
                placeholder="What would you like to discuss?"
                rows={3}
                style={{
                  width: "100%",
                  marginTop: 6,
                  padding: 8,
                  boxSizing: "border-box",
                  resize: "vertical",
                }}
              />
            </label>
            {bookingError && (
              <div style={{ color: "#b91c1c", fontSize: 13, marginBottom: 12 }}>
                {bookingError}
              </div>
            )}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={closeBookingForm}
                disabled={bookingBusy}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => void submitConsultation()}
                disabled={
                  bookingBusy ||
                  !bookingDate ||
                  !bookingNote.trim() ||
                  !bookingServiceId
                }
              >
                {bookingBusy ? "Submitting…" : "Request consultation"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div
        style={{
          padding: "8px 12px",
          borderBottom: "1px solid #e5e7eb",
          background: "#fff",
          maxHeight: 160,
          overflowY: "auto",
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: 6, fontSize: 14 }}>Shared files</div>
        {attachments.length === 0 ? (
          <div style={{ fontSize: 13, color: "#6b7280" }}>No files shared yet.</div>
        ) : (
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
            {attachments.map((file) => (
              <li key={file.id} style={{ marginBottom: 6 }}>
                <button
                  type="button"
                  onClick={() => onDownloadAttachment(file)}
                  style={{
                    border: "none",
                    background: "transparent",
                    color: "#1d4ed8",
                    textDecoration: "underline",
                    cursor: "pointer",
                    padding: 0,
                    font: "inherit",
                  }}
                >
                  {file.original_filename}
                </button>
                <span style={{ color: "#6b7280" }}>
                  {" "}
                  · {file.uploaded_by_email} · {formatDateTime(file.uploaded_at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <MessageList
        messages={messages}
        currentUserId={currentUserId}
        inquiryId={inquiryId}
        onDownloadAttachment={onDownloadAttachment}
      />
      {actionError && (
        <div style={{ color: "#b91c1c", fontSize: 13, padding: "8px 12px" }}>{actionError}</div>
      )}
      {inquiryStatus === "closed" ? (
        <div style={{ padding: 12, fontSize: 13, color: "#6b7280", borderTop: "1px solid #e5e7eb" }}>
          This inquiry is closed. You can still read the conversation and download shared files.
        </div>
      ) : (
        <MessageInput onSend={handleSend} />
      )}
    </div>
  );
}

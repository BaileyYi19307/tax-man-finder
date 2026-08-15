import { useParams } from "react-router-dom";
import { useState, useEffect, useCallback } from "react";
import MessageList from "../../../components/MessageList";
import MessageInput from "../../../components/MessageInput";
import { useChatSocket } from "../../../hooks/hooks/useChatSocket";
import {
  acceptBooking,
  apiFetch,
  cancelBooking,
  declineBooking,
  listInquiryBookings,
  type Booking,
} from "../../../api/client";

type Message = {
  id: number;
  content: string;
  sender_id: number;
  created_at: string;
};

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
  const { inquiryId } = useParams<{ inquiryId: string }>();
  const [inquiryLastReadAt, setInquiryLastReadAt] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [actionError, setActionError] = useState<string | null>(null);
  const [inquiryStatus, setInquiryStatus] = useState<string | null>(null);
  const currentUserId = Number(localStorage.getItem("user_id"));

  const handleIncoming = useCallback(
    (incoming: Message) => {
      if (!incoming?.content || incoming.sender_id === currentUserId) return;
      setMessages((prev) => [...prev, incoming]);
    },
    [currentUserId]
  );

  const handleSocketClose = useCallback((code: number) => {
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
  }, [currentUserId]);

  const { sendMessage } = useChatSocket(
    Number(inquiryId),
    token,
    handleIncoming,
    handleSocketClose
  );

  function handleSend(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (inquiryStatus === "closed") {
      setActionError("This inquiry is closed. New messages were not sent.");
      return;
    }
    setMessages((prev) => [
      ...prev,
      {
        id: Date.now(),
        content: trimmed,
        sender_id: currentUserId,
        created_at: new Date().toISOString(),
      },
    ]);
    sendMessage(trimmed);
  }

  async function refreshBookings() {
    if (!inquiryId) return;
    try {
      setBookings(await listInquiryBookings(inquiryId));
    } catch (e) {
      console.error(e);
    }
  }

  useEffect(() => {
    async function fetchInquiryDetails() {
      if (!inquiryId || !token) return;
      try {
        const inquiryResponse = await apiFetch(`/api/inquiries/${inquiryId}/`);
        if (inquiryResponse.ok) {
          const inquiryData = await inquiryResponse.json();
          setMessages(inquiryData.messages);
          setInquiryStatus(inquiryData.inquiry?.status ?? null);
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
      } catch (error) {
        console.error("history fetch failed", error);
      }
    }
    fetchInquiryDetails();
  }, [inquiryId, token]);

  async function onAccept(id: number) {
    try {
      setActionError(null);
      await acceptBooking(id);
      await refreshBookings();
    } catch {
      setActionError("Could not accept booking.");
    }
  }

  async function onDecline(id: number) {
    try {
      setActionError(null);
      await declineBooking(id);
      await refreshBookings();
    } catch {
      setActionError("Could not decline booking.");
    }
  }

  async function onCancel(id: number) {
    try {
      setActionError(null);
      await cancelBooking(id);
      await refreshBookings();
    } catch {
      setActionError("Could not cancel booking.");
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ padding: "8px 12px", fontSize: 13, color: "#6b7280" }}>
        Inquiry {inquiryId} · Last read {formatDateTime(inquiryLastReadAt)}
      </div>

      {bookings.length > 0 && (
        <div style={{ padding: "8px 12px", borderBottom: "1px solid #e5e7eb" }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Consultation requests</div>
          {actionError && (
            <div style={{ color: "#b91c1c", fontSize: 13, marginBottom: 8 }}>{actionError}</div>
          )}
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
                <strong>{b.status_label}</strong> · {formatDateTime(b.starts_at)} –{" "}
                {formatDateTime(b.ends_at)}
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                {b.status === "pending" && b.accountant === currentUserId && (
                  <>
                    <button type="button" onClick={() => onAccept(b.id)}>
                      Accept
                    </button>
                    <button type="button" onClick={() => onDecline(b.id)}>
                      Decline
                    </button>
                  </>
                )}
                {(b.status === "pending" || b.status === "confirmed") && (
                  <button type="button" onClick={() => onCancel(b.id)}>
                    Cancel
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <MessageList messages={messages} currentUserId={currentUserId} />
      {inquiryStatus === "closed" ? (
        <div style={{ padding: 12, fontSize: 13, color: "#6b7280", borderTop: "1px solid #e5e7eb" }}>
          This inquiry is closed. You can still read the conversation.
        </div>
      ) : (
        <MessageInput onSend={handleSend} />
      )}
    </div>
  );
}

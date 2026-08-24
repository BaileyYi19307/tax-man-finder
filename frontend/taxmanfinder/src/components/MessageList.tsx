import MessageBubble from "./MessageBubble";
import { useRef, useEffect } from "react";
import type { AttachmentPayload } from "../api/client";

type Message = {
  id: number;
  content: string;
  sender_id: number;
  created_at: string;
  is_system?: boolean;
  attachments?: AttachmentPayload[];
};

type MessageListProps = {
  messages: Message[];
  currentUserId: number;
  inquiryId?: string | number;
  onDownloadAttachment?: (attachment: AttachmentPayload) => void;
};

export default function MessageList({
  messages,
  currentUserId,
  inquiryId,
  onDownloadAttachment,
}: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div
      style={{
        flex: 1,
        overflowY: "auto",
        padding: "12px 0",
        background: "#fafafa",
      }}
    >
      {messages.map((message) =>
        message.is_system ? (
          <div
            key={message.id}
            role="status"
            style={{
              display: "flex",
              justifyContent: "center",
              padding: "8px 16px",
            }}
          >
            <div
              style={{
                maxWidth: "90%",
                textAlign: "center",
                fontSize: 13,
                lineHeight: 1.45,
                color: "#4b5563",
                background: "#eef2ff",
                border: "1px solid #c7d2fe",
                borderRadius: 8,
                padding: "8px 12px",
              }}
            >
              {message.content}
            </div>
          </div>
        ) : (
          <MessageBubble
            key={message.id}
            text={message.content}
            isMine={message.sender_id === currentUserId}
            inquiryId={inquiryId}
            attachments={message.attachments}
            onDownload={onDownloadAttachment}
          />
        )
      )}
      <div ref={bottomRef} />
    </div>
  );
}

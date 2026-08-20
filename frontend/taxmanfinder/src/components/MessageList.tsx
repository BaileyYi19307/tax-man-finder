import MessageBubble from "./MessageBubble";
import { useRef, useEffect } from "react";
import type { AttachmentPayload } from "../api/client";

type Message = {
  id: number;
  content: string;
  sender_id: number;
  created_at: string;
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
      {messages.map((message) => (
        <MessageBubble
          key={message.id}
          text={message.content}
          isMine={message.sender_id === currentUserId}
          inquiryId={inquiryId}
          attachments={message.attachments}
          onDownload={onDownloadAttachment}
        />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}

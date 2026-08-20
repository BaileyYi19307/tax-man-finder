import { useEffect, useRef, useState } from "react";
import {
  fetchInquiryAttachmentBlob,
  isImageAttachmentFilename,
  isPdfAttachmentFilename,
  isPreviewableAttachmentFilename,
  type AttachmentPayload,
} from "../api/client";

type MessageBubbleProps = {
  text: string;
  isMine: boolean;
  inquiryId?: string | number;
  attachments?: AttachmentPayload[];
  onDownload?: (attachment: AttachmentPayload) => void;
};

function AttachmentPreview({
  inquiryId,
  attachment,
  isMine,
  onDownload,
}: {
  inquiryId: string | number;
  attachment: AttachmentPayload;
  isMine: boolean;
  onDownload?: (attachment: AttachmentPayload) => void;
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const objectUrlRef = useRef<string | null>(null);

  const isImage = isImageAttachmentFilename(attachment.original_filename);
  const isPdf = isPdfAttachmentFilename(attachment.original_filename);
  const linkColor = isMine ? "#dbeafe" : "#1d4ed8";

  useEffect(() => {
    let cancelled = false;

    fetchInquiryAttachmentBlob(inquiryId, attachment.id)
      .then((blob) => {
        if (cancelled) return;
        // Ensure the browser treats the blob as the right media type for <img>/<iframe>.
        const typed =
          isImage && !blob.type.startsWith("image/")
            ? new Blob([blob], { type: "image/jpeg" })
            : isPdf && blob.type !== "application/pdf"
              ? new Blob([blob], { type: "application/pdf" })
              : blob;
        const url = URL.createObjectURL(typed);
        objectUrlRef.current = url;
        setPreviewUrl(url);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, [inquiryId, attachment.id, isImage, isPdf]);

  return (
    <div style={{ marginBottom: 8 }}>
      {previewUrl && !failed ? (
        isImage ? (
          <button
            type="button"
            onClick={() => onDownload?.(attachment)}
            title={`Download ${attachment.original_filename}`}
            style={{
              display: "block",
              padding: 0,
              border: "none",
              background: "transparent",
              cursor: onDownload ? "pointer" : "default",
              width: "100%",
            }}
          >
            <img
              src={previewUrl}
              alt={attachment.original_filename}
              style={{
                display: "block",
                maxWidth: "100%",
                maxHeight: 220,
                borderRadius: 8,
                objectFit: "contain",
                background: isMine ? "rgba(255,255,255,0.12)" : "#fff",
              }}
            />
          </button>
        ) : (
          <iframe
            src={previewUrl}
            title={attachment.original_filename}
            style={{
              display: "block",
              width: "100%",
              height: 280,
              border: isMine ? "1px solid rgba(255,255,255,0.25)" : "1px solid #cbd5e1",
              borderRadius: 8,
              background: "#fff",
            }}
          />
        )
      ) : (
        <div style={{ fontSize: 12, opacity: 0.85, marginBottom: 4 }}>
          {failed ? "Preview unavailable" : "Loading preview…"}
        </div>
      )}
      {onDownload ? (
        <button
          type="button"
          onClick={() => onDownload(attachment)}
          style={{
            border: "none",
            background: "transparent",
            color: linkColor,
            textDecoration: "underline",
            cursor: "pointer",
            padding: 0,
            font: "inherit",
            fontSize: 12,
          }}
        >
          {attachment.original_filename}
        </button>
      ) : (
        <span style={{ fontSize: 12 }}>{attachment.original_filename}</span>
      )}
    </div>
  );
}

export default function MessageBubble({
  text,
  isMine,
  inquiryId,
  attachments = [],
  onDownload,
}: MessageBubbleProps) {
  const hasText = Boolean(text && text.trim());
  const linkColor = isMine ? "#dbeafe" : "#1d4ed8";

  return (
    <div
      style={{
        display: "flex",
        justifyContent: isMine ? "flex-end" : "flex-start",
        padding: "4px 12px",
      }}
    >
      <div
        style={{
          maxWidth: "72%",
          minWidth: 0,
          padding: "8px 12px",
          borderRadius: 12,
          background: isMine ? "#2563eb" : "#f1f5f9",
          color: isMine ? "#fff" : "#111",
          fontSize: 14,
          lineHeight: 1.4,
          whiteSpace: "pre-wrap",
        }}
      >
        {hasText && <div>{text}</div>}
        {attachments.length > 0 && (
          <div style={{ marginTop: hasText ? 8 : 0 }}>
            {attachments.map((attachment) => {
              const showPreview =
                inquiryId != null &&
                inquiryId !== "" &&
                isPreviewableAttachmentFilename(attachment.original_filename);

              if (showPreview) {
                return (
                  <AttachmentPreview
                    key={attachment.id}
                    inquiryId={inquiryId}
                    attachment={attachment}
                    isMine={isMine}
                    onDownload={onDownload}
                  />
                );
              }

              return (
                <div key={attachment.id} style={{ marginBottom: 4 }}>
                  {onDownload ? (
                    <button
                      type="button"
                      onClick={() => onDownload(attachment)}
                      style={{
                        border: "none",
                        background: "transparent",
                        color: linkColor,
                        textDecoration: "underline",
                        cursor: "pointer",
                        padding: 0,
                        font: "inherit",
                      }}
                    >
                      {attachment.original_filename}
                    </button>
                  ) : (
                    attachment.original_filename
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

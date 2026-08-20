import { useRef, useState } from "react";

export type MessageSendPayload = {
  text: string;
  files: File[];
};

export default function MessageInput({
  onSend,
}: {
  onSend: (payload: MessageSendPayload) => boolean | void | Promise<boolean | void>;
}) {
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed && files.length === 0) return;
    void Promise.resolve(onSend({ text: trimmed, files })).then((sent) => {
      if (sent !== false) {
        setText("");
        setFiles([]);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    });
  }

  function onPickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files || []);
    if (!selected.length) return;
    setFiles((prev) => [...prev, ...selected]);
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        padding: 12,
        borderTop: "1px solid #e5e7eb",
        background: "#fff",
      }}
    >
      {files.length > 0 && (
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "#374151" }}>
          {files.map((file, index) => (
            <li key={`${file.name}-${index}`} style={{ marginBottom: 4 }}>
              {file.name}{" "}
              <button
                type="button"
                onClick={() => removeFile(index)}
                style={{
                  border: "none",
                  background: "transparent",
                  color: "#b91c1c",
                  cursor: "pointer",
                  fontSize: 12,
                }}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx,application/pdf,image/jpeg,image/png"
          onChange={onPickFiles}
          style={{ display: "none" }}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          style={{
            padding: "10px 12px",
            borderRadius: 8,
            border: "1px solid #d1d5db",
            background: "#fff",
            cursor: "pointer",
            fontSize: 13,
          }}
        >
          Attach
        </button>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a message…"
          style={{
            flex: 1,
            padding: "10px 12px",
            borderRadius: 8,
            border: "1px solid #d1d5db",
            fontSize: 14,
          }}
        />
        <button
          type="submit"
          style={{
            padding: "10px 16px",
            borderRadius: 8,
            border: "none",
            background: "#2563eb",
            color: "#fff",
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          Send
        </button>
      </div>
    </form>
  );
}

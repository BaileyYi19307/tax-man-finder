//input field - should do a post after the submission button? 
import { useState } from "react";


export default function MessageInput({
  onSend,
}: {
  onSend: (t: string) => boolean | void | Promise<boolean | void>;
}) {
    const [text, setText] = useState("");
  
    function handleSubmit(e: React.FormEvent) {
      e.preventDefault();
      if (!text.trim()) return;
      void Promise.resolve(onSend(text)).then((sent) => {
        if (sent !== false) setText("");
      });
    }
  
    return (
      <form
        onSubmit={handleSubmit}
        style={{
          display: "flex",
          gap: 8,
          padding: 12,
          borderTop: "1px solid #e5e7eb",
          background: "#fff",
        }}
      >
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
      </form>
    );
  }
  
//input field - should do a post after the submission button? 
import { useState } from "react";


type MessageInputProps ={
    onSend:(text:string) => void; 
}
export default function MessageInput({ onSend }: { onSend: (t: string) => void }) {
    const [text, setText] = useState("");
  
    function handleSubmit(e: React.FormEvent) {
      e.preventDefault();
      if (!text.trim()) return;
      onSend(text);
      setText("");
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
  
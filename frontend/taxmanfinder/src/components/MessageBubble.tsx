//given a message, display it 
type MessageBubbleProps = {
    text:string;
    isMine:boolean;
}

export default function MessageBubble({
    text,
    isMine,
  }: {
    text: string;
    isMine: boolean;
  }) {
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
            maxWidth: "65%",
            padding: "8px 12px",
            borderRadius: 12,
            background: isMine ? "#2563eb" : "#f1f5f9",
            color: isMine ? "#fff" : "#111",
            fontSize: 14,
            lineHeight: 1.4,
            whiteSpace: "pre-wrap",
          }}
        >
          {text}
        </div>
      </div>
    );
  }
  
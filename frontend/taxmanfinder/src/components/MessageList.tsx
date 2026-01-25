import MessageBubble from "./MessageBubble";
export default function MessageList() {
  //given messages, display them in order
  const messages = [
    { id: 1, text: "Hey!", isMine: false },
    { id: 2, text: "Are you free later?", isMine: false },
    { id: 3, text: "Yeah, around 6 works.", isMine: true },
  ];
  //create message bubbles
  return (
    <div style={{ flex: 1, overflowY: "auto" }}>
      {messages.map((message) => (
        <MessageBubble
          key={message.id}
          text={message.text}
          isMine={message.isMine}
        />
      ))}
    </div>
  );
}

import MessageBubble from "./MessageBubble";

type Message={
    id:number;
    text:string; 
    isMine:boolean;
}
    
type MessageListProps={
    messages:Message[];
}


export default function MessageList({messages}:MessageListProps) {
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

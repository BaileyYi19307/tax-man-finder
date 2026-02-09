import MessageBubble from "./MessageBubble";
import {useRef,useEffect} from 'react';

type Message={
    id:number;
    body: string; 
    sender_id: number, 
    created_at:string; 
}
    
type MessageListProps={
    messages:Message[];
    currentUserId: number;
}


export default function MessageList({messages,currentUserId}:MessageListProps) {
  //create message bubbles
  const bottomRef = useRef<HTMLDivElement|null>(null);


  console.log(
    messages.map(m => ({
      id: m.id,
      sender_id: m.sender_id,
      isMine: m.sender_id === currentUserId
    }))
  );

  useEffect(()=>{bottomRef.current?.scrollIntoView({behavior:"smooth"})},[messages])
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
          text={message.body}
          isMine={message.sender_id === currentUserId}
        />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}  

import MessageBubble from "./MessageBubble";
import {useRef,useEffect} from 'react';

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
  const bottomRef = useRef<HTMLDivElement|null>(null);


  useEffect(()=>{bottomRef.current?.scrollIntoView({behavior:"smooth"})},[messages])

  return (
    <div style={{ flex: 1, overflowY: "auto" }}>
      {messages.map((message) => (
        <MessageBubble
          key={message.id}
          text={message.text}
          isMine={message.isMine}
        />
      ))}

      <div ref={bottomRef}/>
    </div>
  );
}

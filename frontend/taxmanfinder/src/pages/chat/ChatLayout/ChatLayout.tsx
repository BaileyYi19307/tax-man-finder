// /chat should show Inbox + empty state on right 
// /chat/:conversationId should show inbox + conversation view on right 

import { Outlet } from "react-router-dom";
import {useState} from 'react';
import InboxView from "./InboxView";


export type Message={
    id:number;
    text:string; 
    isMine:boolean;
}

export type Conversation ={
    id:string; 
    title:string;
    messages:Message[];
}

export default function ChatLayout() {
    const [conversations,setConversations] = useState<Conversation[]>([
        {
            id: "1",
            title: "Alex",
            messages: [
              { id: 1, text: "Hey!", isMine: false },
              { id: 2, text: "Are you free later?", isMine: false },
            ],
          },
          {
            id: "2",
            title: "Jamie",
            messages: [{ id: 3, text: "Did you see the doc?", isMine: false }],
          },
          {
            id: "3",
            title: "Chris",
            messages: [{ id: 4, text: "Lunch tomorrow?", isMine: false }],
          },
    ]);


    function sendMessage(conversationId: string, text: string) {
        const newMessage = {
          id: Date.now(),
          text: text,
          isMine: true,
        };
      
        setConversations((prevConversations) => {
          return prevConversations.map((conversation) => {
            // for every conversation that is NOT the one we're sending to:
            // return it unchanged
            if (conversation.id !== conversationId) {
              return conversation;
            }
      
            //for one we are sending to , return new convo with updated messages array 
            return {
              ...conversation,
              messages: [...conversation.messages, newMessage],
            };
          });
        });
      }
      
  return (
    <div style={{ display: "flex", height: "100vh" }}>
      
    <aside
        style={{
          width: 300,
          borderRight: "1px solid #ddd",
          overflowY: "auto",
        }}
      >
        <InboxView conversations ={conversations}/>
      </aside>

      <main
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <Outlet context = {{conversations,sendMessage}}/>
        {/*  render the child route here */}
      </main>

    </div>
  );
}

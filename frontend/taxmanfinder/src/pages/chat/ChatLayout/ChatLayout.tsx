// /chat should show Inbox + empty state on right 
// /chat/:conversationId should show inbox + conversation view on right 

import { Outlet } from "react-router-dom";
import {useEffect, useState} from 'react';
import InboxView from "./InboxView";


export type Message={
    id:number;
    body: string; 
    sender_id: number, 
    created_at:string; 
}

export type InquiryListItem ={
    id:number; 
    status:string; 
    created_at:string;
    accountant_name:string; 
    service_title: string; 
}

// const STORAGE_KEY = "chat_conversations";

export default function ChatLayout() {
    const [inquiries, setInquiries] = useState<InquiryListItem[]>([]);
    const token = localStorage.getItem("access_token");


    //     const stored = localStorage.getItem(STORAGE_KEY)

    //     if (stored){
    //         try{
    //             return JSON.parse(stored)
    //         }
    //         catch{
    //             console.warn("Failed to parse stored conversations")
    //         }
    //     }
        
    //     //fallback to 
        
    //     return [ {
    //         id: "1",
    //         title: "Alex",
    //         messages: [
    //           { id: 1, text: "Hey!", isMine: false },
    //           { id: 2, text: "Are you free later?", isMine: false },
    //         ],
    //       },
    //       {
    //         id: "2",
    //         title: "Jamie",
    //         messages: [{ id: 3, text: "Did you see the doc?", isMine: false }],
    //       },
    //       {
    //         id: "3",
    //         title: "Chris",
    //         messages: [{ id: 4, text: "Lunch tomorrow?", isMine: false }],
    //       },
          
    // ]});
    
    // useEffect(()=>{
    //     //save whether conversations change
    //     localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
    // }, [conversations])


    // function sendMessage(conversationId: string, text: string) {
    //     const newMessage = {
    //       id: Date.now(),
    //       text: text,
    //       isMine: true,
    //     };
      
    //     setConversations((prevConversations) => {
    //       return prevConversations.map((conversation) => {
    //         // for every conversation that is NOT the one we're sending to:
    //         // return it unchanged
    //         if (conversation.id !== conversationId) {
    //           return conversation;
    //         }
      
    //         //for one we are sending to , return new convo with updated messages array 
    //         return {
    //           ...conversation,
    //           messages: [...conversation.messages, newMessage],
    //         };
    //       });
    //     });
    //   }
    
    useEffect(() => {
        if (!token) return;
      
        fetch("http://127.0.0.1:8000/api/inquiries/", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })
          .then(async (res) => {
            if (!res.ok) {
              const text = await res.text();
              console.error("Inbox fetch failed:", res.status, text);
              return [];
            }
            return res.json();
          })
          .then((data) => {
            console.log("Inbox inquiries:", data);
            setInquiries(data);
            console.log("inquiries is now", inquiries)
          })
          .catch(console.error);
      }, [token]);
      
    useEffect(() => {
  console.log("inquiries updated:", inquiries);
}, [inquiries]);
      
  return (
    <div style={{ display: "flex", height: "100vh" }}>
      
      <aside style={{ width: 300, borderRight: "1px solid #e5e7eb" }}>
        <InboxView inquiries ={inquiries}/>
      </aside>

      <main style={{ flex: 1, background: "#fafafa" }}>

        <Outlet/>
        {/*  render the child route here */}
      </main>

    </div>
  );
}

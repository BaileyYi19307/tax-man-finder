import {useParams,useOutletContext} from "react-router-dom";
import {useState,useEffect} from "react";
import MessageList from "../../../components/MessageList";
import MessageInput from "../../../components/MessageInput";
import type { InquiryListItem } from "./ChatLayout";
import { useChatSocket } from "../../../hooks/hooks/useChatSocket";
import { useCallback } from "react";
;

type Message = {
    id: number;
    content: string;
    sender_id: number;
    created_at: string;
  };



export default function ConversationView() {
    const token = localStorage.getItem("access_token");

    const {inquiryId} = useParams<{inquiryId:string}>();
    const [messages, setMessages] = useState<Message[]>([]);

    const currentUserId = Number(localStorage.getItem("user_id"));

    const handleIncoming = useCallback((incoming: Message) => {
    // Ignore echoes of my own messages
    if (incoming.sender_id === currentUserId) return;

    setMessages((prev) => [...prev, incoming]);
    }, [currentUserId]);


    function handleSend(text: string) {
        const senderId = currentUserId;
      
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now(), 
            content: text,
            sender_id: senderId,
            created_at: new Date().toISOString(),
          },
        ]);
      
        sendMessage(text);
      }
      
      
    //load history 
    useEffect(() => {
        if (!inquiryId || !token) return;
      
        fetch(`http://127.0.0.1:8000/api/inquiries/${inquiryId}/messages/`, {
            headers: { Authorization: `Bearer ${token}` },
          })
            .then(async (r) => {
              if (!r.ok) throw new Error(await r.text());
              return r.json();
            })
            .then((data) => {
              console.log("Inquiry detail:", data);
              setMessages(data.messages);
            })
            .catch((e) => console.error("history fetch failed:", e));
          
      }, [inquiryId, token]);
      
      //live updates via websocket

        const { sendMessage } = useChatSocket(
            Number(inquiryId),
            token,
            handleIncoming
        );
        
      
    return(
        <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
            {/*message list*/}
            <MessageList messages={messages} currentUserId={Number(localStorage.getItem("user_id"))}/>

            {/* message input here*/}
            <MessageInput onSend={handleSend} />

        </div>
  
    )
}
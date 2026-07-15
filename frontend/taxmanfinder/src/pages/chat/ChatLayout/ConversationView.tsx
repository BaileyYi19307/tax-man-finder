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


  function formatDateTime(timestamp: string | null) {
  if (!timestamp) return "Not read yet";

  return new Date(timestamp).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function ConversationView() {
    const token = localStorage.getItem("access_token");

    const {inquiryId} = useParams<{inquiryId:string}>();

    const [inquiryLastReadAt, setInquiryLastReadAt] = useState<string | null>(null);
    console.log("The inquiry Id right now is", inquiryId);
    //inquiry id is not being set correctly in the url - look back into inbox view

    const [messages, setMessages] = useState<Message[]>([]);

    const currentUserId = Number(localStorage.getItem("user_id"));

    const handleIncoming = useCallback((incoming: Message) => {
    // Ignore echoes of my own messages
    if (incoming.sender_id === currentUserId) return;

    setMessages((prev) => [...prev, incoming]);
    }, [currentUserId]);


    useEffect(() => {
  console.log("ConversationView mounted");

  return () => {
    console.log("ConversationView unmounted");
  };
}, []);

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
      async function fetchInquiryDetails(){
          if (!inquiryId || !token){        
            return;
          }

          try{
          let inquiryResponse = await fetch(`http://127.0.0.1:8000/api/inquiries/${inquiryId}/`, {
              headers: { Authorization: `Bearer ${token}` },
            })

            if (inquiryResponse.ok){
              let inquiryData = await inquiryResponse.json();
              console.log("Inquiry details:", inquiryData);
              setMessages(inquiryData.messages);

            }

            let readStateResponse = await fetch(`http://127.0.0.1:8000/api/inquiries/${inquiryId}/mark-read/`,{
              method: "POST",
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`},
            });

            if (readStateResponse.ok){
              let readStateData = await readStateResponse.json();
              console.log("Read state details:", readStateData);
              setInquiryLastReadAt(readStateData.last_read_at);
            }

          }
          catch(error){
            console.error("history fetch failed", error);
          }
        }
        fetchInquiryDetails();
      }, [inquiryId, token]);
      
      //live updates via websocket

      console.log("The inquiryId here is", inquiryId);

        const { sendMessage } = useChatSocket(
            Number(inquiryId),
            token,
            handleIncoming
        );


        
        
      
    return(
        <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
            {/*message list*/}
            <div> Inquiry ID {inquiryId} - Last Read At {formatDateTime(inquiryLastReadAt)}</div>
            <MessageList messages={messages} currentUserId={Number(localStorage.getItem("user_id"))}/>

            {/* message input here*/}
            <MessageInput onSend={handleSend} />

        </div>
  
    )
}
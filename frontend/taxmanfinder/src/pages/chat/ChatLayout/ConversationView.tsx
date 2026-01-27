import {useParams} from "react-router-dom";
import {useState} from "react";
import MessageList from "../../../components/MessageList";
import MessageInput from "../../../components/MessageInput";


type Message={
    id:number;
    text:string; 
    isMine:boolean;
}




export default function ConversationView() {
    const {conversationId} = useParams<{conversationId}>();


    const [messagesByConversation, setMessagesByConversation] = useState<
    Record<string, Message[]>
    >({
        "1": [
            { id: 1, text: "Hey!", isMine: false },
            { id: 2, text: "Are you free later?", isMine: false },
        ],
        "2": [
            { id: 3, text: "Yeah, around 6 works.", isMine: false },
        ],
        "3": [
            { id: 4, text: "Yeah, around 6 works.", isMine: false },
        ],
    });

    const messages = messagesByConversation[conversationId ?? ""] ?? [];



    function handleSend(text:string){
        setMessagesByConversation((prev) => {
            const oldMessages = prev[conversationId] ?? [];
            const newMessage = { id: Date.now(), text, isMine: true };
          
            return {
              ...prev,
              [conversationId]: [...oldMessages, newMessage],
            };
          });
    }


    return(
        <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>

            {/*header*/}
            <div>
                Conversation {conversationId}
            </div>


            {/*message list*/}
            <MessageList messages={messages}/>

            {/* message input here*/}
            <MessageInput onSend={handleSend}/>



        </div>
  
    )
}
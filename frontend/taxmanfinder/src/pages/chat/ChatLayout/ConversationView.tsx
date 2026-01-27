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
    const {conversationId} = useParams();

    const [messages,setMessages] = useState<Message[]>([
        { id: 1, text: "Hey!", isMine: false },
        { id: 2, text: "Are you free later?", isMine: false },
        { id: 3, text: "Yeah, around 6 works.", isMine: true },
    ]);

    function handleSend(text:string){
        setMessages((prev)=>[
            ...prev,{ id: Date.now(),text,isMine:true}
        ]);
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
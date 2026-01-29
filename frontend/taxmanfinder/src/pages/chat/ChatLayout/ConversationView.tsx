import {useParams,useOutletContext} from "react-router-dom";
import {useState} from "react";
import MessageList from "../../../components/MessageList";
import MessageInput from "../../../components/MessageInput";
import type { Conversation } from "./ChatLayout";


type OutletCtx = {
    conversations:Conversation[];
    sendMessage:(conversationId:string,text:string)=>void;
}


export default function ConversationView() {
    const {conversationId} = useParams<{conversationId}>();
    const {conversations,sendMessage}=useOutletContext<OutletCtx>();


    const convo = conversations.find(c=>c.id == conversationId);
    const messages = convo?.messages??[];




    function handleSend(text:string){
        if(!conversationId){
            return;
        }
        sendMessage(conversationId,text);
    }


    return(
        <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>

            {/*header*/}
            <div>{convo?.title??
                `Conversation ${conversationId}`}
            </div>


            {/*message list*/}
            <MessageList messages={messages}/>

            {/* message input here*/}
            <MessageInput onSend={handleSend}/>



        </div>
  
    )
}
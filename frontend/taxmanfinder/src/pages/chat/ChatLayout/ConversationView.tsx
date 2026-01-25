import {useParams} from "react-router-dom";
import MessageList from "../../../components/MessageList";
import MessageInput from "../../../components/MessageInput";

export default function ConversationView() {
    const {conversationId} = useParams();


    return(
        <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>

            {/*header*/}
            <div>
                Conversation {conversationId}
            </div>


            {/*message list*/}
            <MessageList/>

            {/* message input here*/}
            <MessageInput/>



        </div>
  
    )
}
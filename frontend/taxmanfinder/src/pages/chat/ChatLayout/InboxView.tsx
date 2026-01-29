//should display all the conversations associated with the user id 

import {NavLink} from "react-router-dom";
import type { Conversation } from "./ChatLayout";


type InboxViewProps={
    conversations: Conversation[]
};


export default function InboxView({conversations}:InboxViewProps){
    //list all the conversations that the user is part of 
    //how to get the user id then?

    return(
        <div>
            <h3>Messages</h3>

            <ul>
                {conversations.map((c) => {
                const last = c.messages[c.messages.length - 1]?.text ?? "";
                return (
                    <li key={c.id}>
                    <NavLink to={`/chat/${c.id}`}>
                        {c.title}
                    </NavLink>
                    <div>{last}</div>
                    </li>
                );
                })}
            </ul>

        </div>
    );
}
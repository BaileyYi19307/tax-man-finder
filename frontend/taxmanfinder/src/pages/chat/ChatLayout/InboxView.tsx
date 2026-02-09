//should display all the conversations associated with the user id 

import {NavLink} from "react-router-dom";
import type { Conversation } from "./ChatLayout";


type InboxViewProps={
    conversations: Conversation[]
};

export default function InboxView({ conversations = [] }: InboxViewProps) {
    return (
      <div>
        <h3>Messages</h3>
  
        <ul>
          {conversations.length === 0 ? (
            <li>No conversations yet</li>
          ) : (
            conversations.map((c) => (
              <li key={c.id}>
                <NavLink to={`/chat/${c.id}`}>
                  {c.other_user}
                </NavLink>
                <div>{c.last_message}</div>
              </li>
            ))
          )}
        </ul>
      </div>
    );
  }
  
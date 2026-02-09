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
                <li
                key={c.id}
                style={{
                  padding: "10px 12px",
                  borderBottom: "1px solid #e5e7eb",
                }}
              >
                <NavLink
                  to={`/chat/${c.id}`}
                  style={({ isActive }) => ({
                    textDecoration: "none",
                    color: "#111",
                    fontWeight: isActive ? 600 : 400,
                    display: "block",
                  })}
                >
                  {c.other_user}
                  <div style={{ fontSize: 12, color: "#6b7280" }}>
                    {c.last_message}
                  </div>
                </NavLink>
              </li>
              
            ))
          )}
        </ul>
      </div>
    );
  }
  
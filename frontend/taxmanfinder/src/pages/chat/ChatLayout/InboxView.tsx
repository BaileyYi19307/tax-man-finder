//should display all the conversations associated with the user id 

import {NavLink} from "react-router-dom";
import type { InquiryListItem } from "./ChatLayout";


type InboxViewProps={
    inquiries: InquiryListItem[]
};

export default function InboxView({ inquiries = [] }: InboxViewProps) {

  console.log("in inbox view, inquiries is", inquiries)
    return (
      <div>
        <h3>Messages</h3>
  
        <ul>
          {inquiries.length === 0 ? (
            <li>No conversations yet</li>
          ) : (
            inquiries.map((inquiry) => (
                <li
                key={inquiry.id}
                style={{
                  padding: "10px 12px",
                  borderBottom: "1px solid #e5e7eb",
                }}
              >
                <p> Here here here {inquiry.service_title}</p>
                <NavLink
                  to={`/chat/${inquiry.id}`}
                  style={({ isActive }) => ({
                    textDecoration: "none",
                    color: "#111",
                    fontWeight: isActive ? 600 : 400,
                    display: "block",
                  })}
                >
                  {inquiry.accountant_name}
                  <div style={{ fontSize: 12, color: "#6b7280" }}>
                    {inquiry.service_title}
                  </div>
                </NavLink>
              </li>
              
            ))
          )}
        </ul>
      </div>
    );
  }
  
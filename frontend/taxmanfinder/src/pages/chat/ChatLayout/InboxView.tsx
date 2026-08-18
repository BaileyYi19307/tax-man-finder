//should display all the conversations associated with the user id 

import {NavLink} from "react-router-dom";
import type { InquiryListItem } from "./ChatLayout";


type InboxViewProps={
    inquiries: InquiryListItem[]
    loading?: boolean;
    error?: string | null;
    onMarkRead: (inquiryId: number) => void;

};

export default function InboxView({
  inquiries = [],
  loading = false,
  error = null,
  onMarkRead,
}: InboxViewProps) {
  const currentUserId = Number(localStorage.getItem("user_id"));

    return (
      <div>
        <h3>Messages</h3>
  
        <ul>
          {loading ? (
            <li>Loading conversations…</li>
          ) : error ? (
            <li style={{ color: "#b91c1c" }}>{error}</li>
          ) : inquiries.length === 0 ? (
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
                <NavLink
                  to={`/chat/${inquiry.id}`}
                  onClick={() => onMarkRead(inquiry.id)}
                  style={({ isActive }) => ({
                    textDecoration: "none",
                    color: "#111",
                    fontWeight: inquiry.unread ? 700 : isActive ? 600 : 400,
                    display: "block",
                  })}
                >
<div style={{ display: "flex", alignItems: "center", gap: 8 }}>

                      {inquiry.unread && (
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          backgroundColor: "#2563eb",
          display: "inline-block",
        }}
      />
    )}
    
                  {currentUserId === inquiry.accountant
                    ? inquiry.client_name
                    : inquiry.accountant_name}
                  </div>
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

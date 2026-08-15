import { Outlet } from "react-router-dom";
import { useEffect, useState } from "react";
import InboxView from "./InboxView";
import { apiFetch } from "../../../api/client";

export type Message = {
  id: number;
  body: string;
  sender_id: number;
  created_at: string;
};

export type InquiryListItem = {
  id: number;
  status: string;
  created_at: string;
  client: number;
  accountant: number;
  accountant_name: string;
  client_name: string;
  service_title: string | null;
  unread: boolean;
};

export default function ChatLayout() {
  const [inquiries, setInquiries] = useState<InquiryListItem[]>([]);
  const token = localStorage.getItem("access_token");

  function handleMarkRead(inquiryId: number) {
    setInquiries((prev) =>
      prev.map((inquiry) =>
        inquiry.id === inquiryId ? { ...inquiry, unread: false } : inquiry
      )
    );
  }

  useEffect(() => {
    if (!token) return;

    apiFetch("/api/inquiries/")
      .then(async (res) => {
        if (!res.ok) {
          const text = await res.text();
          console.error("Inbox fetch failed:", res.status, text);
          return [];
        }
        return res.json();
      })
      .then((data) => {
        setInquiries(data);
      })
      .catch(console.error);
  }, [token]);

  return (
    <div style={{ display: "flex", height: "100vh" }}>
      <aside style={{ width: 300, borderRight: "1px solid #e5e7eb" }}>
        <InboxView inquiries={inquiries} onMarkRead={handleMarkRead} />
      </aside>

      <main style={{ flex: 1, background: "#fafafa" }}>
        <Outlet context={{ inquiries, onMarkRead: handleMarkRead }} />
      </main>
    </div>
  );
}

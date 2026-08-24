import { Outlet, useLocation } from "react-router-dom";
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
  unread: boolean;
};

export default function ChatLayout() {
  const [inquiries, setInquiries] = useState<InquiryListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const token = localStorage.getItem("access_token");
  const location = useLocation();

  function handleMarkRead(inquiryId: number) {
    setInquiries((prev) =>
      prev.map((inquiry) =>
        inquiry.id === inquiryId ? { ...inquiry, unread: false } : inquiry
      )
    );
  }

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);
        const res = await apiFetch("/api/inquiries/");
        if (!res.ok) {
          throw new Error(await res.text());
        }
        const data = await res.json();
        if (!cancelled) setInquiries(data);
      } catch (e) {
        console.error(e);
        if (!cancelled) {
          setInquiries([]);
          setError("Could not load conversations.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
    // Refetch when entering/leaving threads so the inbox cannot keep deleted rows.
  }, [token, location.pathname]);

  return (
    <div style={{ display: "flex", flex: 1, minHeight: 0, height: "100%" }}>
      <aside style={{ width: 300, borderRight: "1px solid #e5e7eb" }}>
        <InboxView
          inquiries={inquiries}
          loading={loading}
          error={error}
          onMarkRead={handleMarkRead}
        />
      </aside>

      <main style={{ flex: 1, background: "#fafafa" }}>
        <Outlet context={{ inquiries, onMarkRead: handleMarkRead }} />
      </main>
    </div>
  );
}

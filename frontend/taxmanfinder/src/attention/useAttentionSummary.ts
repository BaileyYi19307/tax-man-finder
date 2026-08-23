import { useCallback, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  listMyBookings,
  listMyInquiries,
  type Booking,
  type InquiryListItem,
} from "../api/client";
import { useAuth } from "../auth/AuthProvider";
import { getAccessToken } from "../auth/session";
import {
  buildAttentionSummary,
  EMPTY_ATTENTION_SUMMARY,
  type AttentionRole,
  type AttentionSummary,
} from "./summary";

export function useAttentionSummary() {
  const { user } = useAuth();
  const location = useLocation();
  const [summary, setSummary] = useState<AttentionSummary>(EMPTY_ATTENTION_SUMMARY);
  const [loading, setLoading] = useState(false);

  const role: AttentionRole | null = user
    ? user.has_accountant_profile
      ? "accountant"
      : "client"
    : null;

  const refresh = useCallback(async () => {
    if (!role || !getAccessToken()) {
      setSummary(EMPTY_ATTENTION_SUMMARY);
      return;
    }
    try {
      setLoading(true);
      const [bookings, inquiries]: [Booking[], InquiryListItem[]] = await Promise.all([
        listMyBookings(),
        listMyInquiries(),
      ]);
      setSummary(buildAttentionSummary({ role, bookings, inquiries }));
    } catch (e) {
      console.error(e);
      setSummary(EMPTY_ATTENTION_SUMMARY);
    } finally {
      setLoading(false);
    }
  }, [role]);

  useEffect(() => {
    void refresh();
  }, [refresh, location.pathname]);

  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === "visible") {
        void refresh();
      }
    }
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [refresh]);

  return { summary, loading, refresh, role };
}

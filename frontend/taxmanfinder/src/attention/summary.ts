import type { Booking, InquiryListItem } from "../api/client";

export type AttentionRole = "client" | "accountant";

export type AttentionItem = {
  key: string;
  label: string;
  to: string;
};

export type AttentionSummary = {
  pendingCount: number;
  awaitingPaymentCount: number;
  upcomingConfirmedCount: number;
  unreadMessagesCount: number;
  /** Nav badge for Consultations — actionable bookings only. */
  consultationsBadge: number;
  messagesBadge: number;
  needsAttention: AttentionItem[];
  upcoming: AttentionItem[];
};

function plural(count: number, one: string, many: string) {
  return count === 1 ? one : many;
}

function isUpcomingConfirmed(booking: Booking, now: Date) {
  return (
    booking.status === "confirmed" && new Date(booking.ends_at).getTime() > now.getTime()
  );
}

export function buildAttentionSummary(input: {
  role: AttentionRole;
  bookings: Booking[];
  inquiries: InquiryListItem[];
  now?: Date;
}): AttentionSummary {
  const now = input.now ?? new Date();
  const pendingCount = input.bookings.filter((b) => b.status === "pending").length;
  const awaitingPaymentCount = input.bookings.filter(
    (b) => b.status === "awaiting_payment"
  ).length;
  const upcomingConfirmedCount = input.bookings.filter((b) =>
    isUpcomingConfirmed(b, now)
  ).length;
  const unreadMessagesCount = input.inquiries.filter((i) => i.unread).length;

  const needsAttention: AttentionItem[] = [];

  if (input.role === "client") {
    if (pendingCount > 0) {
      needsAttention.push({
        key: "pending",
        label: `${pendingCount} ${plural(
          pendingCount,
          "consultation awaiting accountant approval",
          "consultations awaiting accountant approval"
        )}`,
        to: "/bookings",
      });
    }
    if (awaitingPaymentCount > 0) {
      needsAttention.push({
        key: "awaiting_payment",
        label: `${awaitingPaymentCount} ${plural(
          awaitingPaymentCount,
          "consultation awaiting payment",
          "consultations awaiting payment"
        )}`,
        to: "/bookings",
      });
    }
  } else if (pendingCount > 0) {
    needsAttention.push({
      key: "pending",
      label: `${pendingCount} ${plural(
        pendingCount,
        "pending consultation request",
        "pending consultation requests"
      )}`,
      to: "/bookings",
    });
  }

  if (unreadMessagesCount > 0) {
    needsAttention.push({
      key: "unread",
      label: `${unreadMessagesCount} ${plural(
        unreadMessagesCount,
        "unread message",
        "unread messages"
      )}`,
      to: "/chat",
    });
  }

  const upcoming: AttentionItem[] = [];
  if (upcomingConfirmedCount > 0) {
    upcoming.push({
      key: "upcoming",
      label: `${upcomingConfirmedCount} ${plural(
        upcomingConfirmedCount,
        "upcoming consultation",
        "upcoming consultations"
      )}`,
      to: "/bookings",
    });
  }

  const consultationsBadge =
    input.role === "client" ? pendingCount + awaitingPaymentCount : pendingCount;

  return {
    pendingCount,
    awaitingPaymentCount,
    upcomingConfirmedCount,
    unreadMessagesCount,
    consultationsBadge,
    messagesBadge: unreadMessagesCount,
    needsAttention,
    upcoming,
  };
}

export function navLabel(base: string, count: number) {
  return count > 0 ? `${base} · ${count}` : base;
}

export const EMPTY_ATTENTION_SUMMARY: AttentionSummary = {
  pendingCount: 0,
  awaitingPaymentCount: 0,
  upcomingConfirmedCount: 0,
  unreadMessagesCount: 0,
  consultationsBadge: 0,
  messagesBadge: 0,
  needsAttention: [],
  upcoming: [],
};

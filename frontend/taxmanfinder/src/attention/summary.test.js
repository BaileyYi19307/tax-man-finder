import {
  buildAttentionSummary,
  navLabel,
  type AttentionSummary,
} from "./summary";

describe("buildAttentionSummary", () => {
  const now = new Date("2026-08-23T18:00:00.000Z");

  function booking(partial) {
    return {
      id: 1,
      inquiry: 1,
      inquiry_id: 1,
      client: 1,
      client_email: "c@test.com",
      accountant: 2,
      accountant_email: "a@test.com",
      starts_at: "2026-08-24T15:00:00.000Z",
      ends_at: "2026-08-24T15:30:00.000Z",
      status: "pending",
      status_label: "Pending",
      consultation_fee: "0.00",
      cancellation_policy: "",
      payment: null,
      service: null,
      service_name: null,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
      ...partial,
    };
  }

  test("client counts pending, payment due, unread, and upcoming", () => {
    const summary: AttentionSummary = buildAttentionSummary({
      role: "client",
      now,
      bookings: [
        booking({ id: 1, status: "pending" }),
        booking({ id: 2, status: "awaiting_payment" }),
        booking({
          id: 3,
          status: "confirmed",
          starts_at: "2026-08-25T15:00:00.000Z",
          ends_at: "2026-08-25T15:30:00.000Z",
        }),
        booking({
          id: 4,
          status: "confirmed",
          starts_at: "2026-08-20T15:00:00.000Z",
          ends_at: "2026-08-20T15:30:00.000Z",
        }),
      ],
      inquiries: [
        { id: 1, status: "open", created_at: "", client: 1, accountant: 2, accountant_name: "A", unread: true },
        { id: 2, status: "open", created_at: "", client: 1, accountant: 3, accountant_name: "B", unread: false },
      ],
    });

    expect(summary.consultationsBadge).toBe(2);
    expect(summary.messagesBadge).toBe(1);
    expect(summary.needsAttention.map((i) => i.label)).toEqual([
      "1 consultation awaiting accountant approval",
      "1 consultation awaiting payment",
      "1 unread message",
    ]);
    expect(summary.upcoming.map((i) => i.label)).toEqual([
      "1 upcoming consultation",
    ]);
  });

  test("accountant badge is pending only", () => {
    const summary = buildAttentionSummary({
      role: "accountant",
      now,
      bookings: [
        booking({ id: 1, status: "pending" }),
        booking({ id: 2, status: "pending" }),
        booking({ id: 3, status: "awaiting_payment" }),
        booking({ id: 4, status: "confirmed" }),
      ],
      inquiries: [],
    });

    expect(summary.consultationsBadge).toBe(2);
    expect(summary.needsAttention[0].label).toBe("2 pending consultation requests");
    expect(summary.upcoming[0].label).toBe("1 upcoming consultation");
  });

  test("navLabel omits zero counts", () => {
    expect(navLabel("Messages", 0)).toBe("Messages");
    expect(navLabel("Messages", 3)).toBe("Messages · 3");
  });
});

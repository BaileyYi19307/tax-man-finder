const API_BASE =
  process.env.REACT_APP_API_BASE || "http://127.0.0.1:8000";

export function getAccessToken(): string | null {
  return localStorage.getItem("access_token");
}

export function authHeaders(extra: HeadersInit = {}): HeadersInit {
  const token = getAccessToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

export async function apiFetch(path: string, init: RequestInit = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...authHeaders(),
      ...(init.headers || {}),
    },
  });
  return res;
}

export type Booking = {
  id: number;
  inquiry: number;
  inquiry_id: number;
  client: number;
  client_email: string;
  accountant: number;
  accountant_email: string;
  starts_at: string;
  ends_at: string;
  status: "pending" | "confirmed" | "declined" | "cancelled";
  status_label: string;
  created_at: string;
  updated_at: string;
};

export type InquiryListItem = {
  id: number;
  status: string;
  created_at: string;
  accountant_name: string;
  service_title: string | null;
  unread?: boolean;
  client_name?: string;
};

export async function startConversation(body: {
  content: string;
  service?: number;
  accountant?: number;
}) {
  const res = await apiFetch("/api/inquiries/", {
    method: "POST",
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(text || "Failed to start conversation");
  return JSON.parse(text) as { inquiry_id: number };
}

export async function requestConsultation(body: {
  content: string;
  starts_at: string;
  service?: number;
  accountant?: number;
  inquiry?: number;
}) {
  const res = await apiFetch("/bookings/request-consultation/", {
    method: "POST",
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(text || "Failed to request consultation");
  return JSON.parse(text) as { inquiry_id: number; booking: Booking };
}

export async function listMyBookings() {
  const res = await apiFetch("/bookings/");
  if (!res.ok) throw new Error(await res.text());
  return (await res.json()) as Booking[];
}

export async function listInquiryBookings(inquiryId: number | string) {
  const res = await apiFetch(`/bookings/by-inquiry/${inquiryId}/`);
  if (!res.ok) throw new Error(await res.text());
  return (await res.json()) as Booking[];
}

export async function acceptBooking(bookingId: number) {
  const res = await apiFetch(`/bookings/${bookingId}/accept/`, { method: "POST" });
  if (!res.ok) throw new Error(await res.text());
  return (await res.json()) as Booking;
}

export async function declineBooking(bookingId: number) {
  const res = await apiFetch(`/bookings/${bookingId}/decline/`, { method: "POST" });
  if (!res.ok) throw new Error(await res.text());
  return (await res.json()) as Booking;
}

export async function cancelBooking(bookingId: number) {
  const res = await apiFetch(`/bookings/${bookingId}/cancel/`, { method: "POST" });
  if (!res.ok) throw new Error(await res.text());
  return (await res.json()) as Booking;
}

export { API_BASE };

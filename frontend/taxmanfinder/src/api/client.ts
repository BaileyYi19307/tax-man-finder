import { getAccessToken } from "../auth/session";

const API_BASE =
  process.env.REACT_APP_API_BASE || "http://127.0.0.1:8000";

export { getAccessToken };

export type CurrentUser = {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  has_accountant_profile: boolean;
  accountant_profile_complete: boolean;
};

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

export type CatalogService = {
  id: number;
  name: string;
  description: string;
  pricing_type: "fixed" | "hourly" | "consultation_required";
  indicative_price: string | null;
  accountant?: number;
  is_active?: boolean;
};

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

export type AccountantProfilePayload = {
  user_id: number;
  email: string;
  first_name: string;
  last_name: string;
  bio: string | null;
  credentials: string;
  years_experience: number;
  firm_name: string;
  location: string;
  services: { id: number; name: string }[];
  profile_complete: boolean;
};

export async function getMe() {
  const res = await apiFetch("/users/me/");
  if (!res.ok) throw new Error(await res.text());
  return (await res.json()) as CurrentUser;
}

export async function getProfileStatus(userId: number) {
  const res = await fetch(`${API_BASE}/accountants/profile-status/${userId}/`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(await res.text());
  return (await res.json()) as {
    profile_info_complete: boolean;
    services_exist: boolean;
    profile_complete: boolean;
  };
}

export async function listPublicAccountants() {
  const res = await fetch(`${API_BASE}/accountants/directory/`);
  if (!res.ok) throw new Error(await res.text());
  return (await res.json()) as AccountantProfilePayload[];
}

export async function getPublicAccountantProfile(userId: number | string) {
  const res = await fetch(`${API_BASE}/accountants/${userId}/`);
  if (!res.ok) throw new Error(await res.text());
  return (await res.json()) as AccountantProfilePayload;
}

export async function getMyAccountantProfile() {
  const res = await apiFetch("/accountants/me/");
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(await res.text());
  return (await res.json()) as AccountantProfilePayload;
}

export async function createAccountantProfile(body: {
  first_name: string;
  last_name: string;
  bio: string;
  credentials: string;
  years_experience: number;
  firm_name: string;
  location: string;
  service_name?: string;
  service_description?: string;
}) {
  const res = await apiFetch("/accountants/create/", {
    method: "POST",
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(text || "Failed to save accountant profile");
  return JSON.parse(text) as AccountantProfilePayload;
}

export async function getMyServices() {
  const res = await apiFetch("/services/mine/");
  if (!res.ok) throw new Error(await res.text());
  return (await res.json()) as CatalogService[];
}

export async function updateMyService(
  serviceId: number,
  body: {
    name: string;
    description: string;
    pricing_type?: CatalogService["pricing_type"];
    indicative_price?: string | null;
  }
) {
  const res = await apiFetch(`/services/${serviceId}/`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(text || "Failed to update service");
  return JSON.parse(text) as CatalogService;
}

export async function createMyService(body: {
  name: string;
  description: string;
  pricing_type?: CatalogService["pricing_type"];
  indicative_price?: string | null;
}) {
  const res = await apiFetch("/services/", {
    method: "POST",
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(text || "Failed to create service");
  return JSON.parse(text) as CatalogService;
}

export async function deactivateMyService(serviceId: number) {
  const res = await apiFetch(`/services/${serviceId}/`, {
    method: "PATCH",
    body: JSON.stringify({ is_active: false }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(text || "Failed to deactivate service");
  return JSON.parse(text) as CatalogService;
}

export async function sendInquiryMessage(
  inquiryId: number | string,
  content: string
) {
  const res = await apiFetch(`/api/inquiries/${inquiryId}/messages/`, {
    method: "POST",
    body: JSON.stringify({ content }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(text || "Failed to send message");
  return JSON.parse(text) as { message_id: number };
}

export { API_BASE };

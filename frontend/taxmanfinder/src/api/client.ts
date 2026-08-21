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

/** Auth headers without Content-Type (for FormData multipart uploads). */
export function authBearerHeaders(): HeadersInit {
  const token = getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
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

export type AccountantServiceScope = "local" | "remote" | "nationwide";

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
  latitude?: number | null;
  longitude?: number | null;
  service_scope?: AccountantServiceScope;
  map_eligible?: boolean;
  services: {
    id: number;
    name: string;
    pricing_type?: "fixed" | "hourly" | "consultation_required";
    indicative_price?: string | null;
  }[];
  profile_complete: boolean;
};

export type GeocodeResult = {
  latitude: number;
  longitude: number;
  display_name: string;
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

export type DirectoryGeoQuery = {
  latitude: number;
  longitude: number;
  radius_miles?: number;
};

export async function listPublicAccountants(geo?: DirectoryGeoQuery) {
  const params = new URLSearchParams();
  if (geo) {
    params.set("latitude", String(geo.latitude));
    params.set("longitude", String(geo.longitude));
    if (geo.radius_miles != null) {
      params.set("radius_miles", String(geo.radius_miles));
    }
  }
  const qs = params.toString();
  const res = await fetch(
    `${API_BASE}/accountants/directory/${qs ? `?${qs}` : ""}`
  );
  if (!res.ok) throw new Error(await res.text());
  return (await res.json()) as AccountantProfilePayload[];
}

export async function geocodePlace(query: string) {
  const params = new URLSearchParams({ q: query });
  const res = await fetch(`${API_BASE}/accountants/geocode/?${params}`);
  const text = await res.text();
  if (res.status === 404) throw new Error("No results for that location.");
  if (!res.ok) throw new Error(text || "Geocoding failed");
  return JSON.parse(text) as GeocodeResult;
}

export async function listPublicServices() {
  const res = await fetch(`${API_BASE}/services/`);
  if (!res.ok) throw new Error(await res.text());
  return (await res.json()) as CatalogService[];
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
  service_scope?: AccountantServiceScope;
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
  return JSON.parse(text) as { message_id: number; message?: ChatMessagePayload };
}

export type AttachmentPayload = {
  id: number;
  inquiry_id?: number;
  message_id: number | null;
  uploaded_by_id: number;
  uploaded_by_email: string;
  original_filename: string;
  uploaded_at: string;
};

export type ChatMessagePayload = {
  id: number;
  sender_id: number;
  sender_email?: string;
  content: string;
  created_at: string;
  attachments?: AttachmentPayload[];
};

export async function sendInquiryMessageWithFiles(
  inquiryId: number | string,
  content: string,
  files: File[]
) {
  const form = new FormData();
  form.append("content", content);
  files.forEach((file) => form.append("files", file));
  const res = await fetch(`${API_BASE}/api/inquiries/${inquiryId}/messages/`, {
    method: "POST",
    headers: authBearerHeaders(),
    body: form,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(text || "Failed to send message with files");
  return JSON.parse(text) as { message_id: number; message: ChatMessagePayload };
}

export async function listInquiryAttachments(inquiryId: number | string) {
  const res = await apiFetch(`/api/inquiries/${inquiryId}/attachments/`);
  if (!res.ok) throw new Error(await res.text());
  return (await res.json()) as AttachmentPayload[];
}

export function isImageAttachmentFilename(filename: string): boolean {
  const lower = (filename || "").toLowerCase();
  return (
    lower.endsWith(".jpg") ||
    lower.endsWith(".jpeg") ||
    lower.endsWith(".png")
  );
}

export function isPdfAttachmentFilename(filename: string): boolean {
  return (filename || "").toLowerCase().endsWith(".pdf");
}

/** Types we can render inline in chat (auth blob URL). */
export function isPreviewableAttachmentFilename(filename: string): boolean {
  return (
    isImageAttachmentFilename(filename) || isPdfAttachmentFilename(filename)
  );
}

export async function fetchInquiryAttachmentBlob(
  inquiryId: number | string,
  attachmentId: number
): Promise<Blob> {
  const res = await fetch(
    `${API_BASE}/api/inquiries/${inquiryId}/attachments/${attachmentId}/download/`,
    { headers: authBearerHeaders() }
  );
  if (!res.ok) throw new Error(await res.text());
  return res.blob();
}

export async function downloadInquiryAttachment(
  inquiryId: number | string,
  attachmentId: number,
  filename: string
) {
  const blob = await fetchInquiryAttachmentBlob(inquiryId, attachmentId);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export { API_BASE };

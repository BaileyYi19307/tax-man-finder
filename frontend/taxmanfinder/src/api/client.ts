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

/**
 * Turn a failed DRF/JSON API response into a short Error message.
 * Prefers `detail` (string or list); falls back to first field error; else raw text.
 * Field-level messages are also attached on `error.fields` when present.
 */
export type ApiError = Error & { fields?: Record<string, string> };

export async function readApiError(
  res: Response,
  fallback = "Request failed"
): Promise<ApiError> {
  const text = await res.text();
  if (!text) {
    return new Error(`${fallback} (${res.status})`);
  }
  try {
    const data = JSON.parse(text) as Record<string, unknown>;
    const fields: Record<string, string> = {};
    for (const [key, value] of Object.entries(data)) {
      if (key === "detail") continue;
      if (typeof value === "string" && value.trim()) {
        fields[key] = value;
      } else if (
        Array.isArray(value) &&
        value.length > 0 &&
        typeof value[0] === "string"
      ) {
        fields[key] = value[0];
      }
    }
    const detail = data.detail;
    let message = "";
    if (typeof detail === "string" && detail.trim()) {
      message = detail;
    } else if (Array.isArray(detail) && detail.length > 0) {
      const parts = detail.map((item) =>
        typeof item === "string"
          ? item
          : item && typeof item === "object" && "string" in item
            ? String((item as { string: unknown }).string)
            : JSON.stringify(item)
      );
      message = parts.filter(Boolean).join(" ");
    } else if (Object.keys(fields).length > 0) {
      message = Object.values(fields)[0];
    }
    const err = new Error(message || fallback) as ApiError;
    if (Object.keys(fields).length > 0) {
      err.fields = fields;
    }
    return err;
  } catch {
    // Non-JSON body — use raw text below.
  }
  return new Error(text);
}

export function apiFieldError(err: unknown, field: string): string | null {
  if (!err || typeof err !== "object" || !("fields" in err)) {
    return null;
  }
  const fields = (err as ApiError).fields;
  const value = fields?.[field];
  return typeof value === "string" && value.trim() ? value : null;
}

export type ServiceCategory = {
  id: number;
  name: string;
  slug: string;
};

export type CatalogService = {
  id: number;
  name: string;
  description: string;
  pricing_type: "fixed" | "hourly" | "consultation_required";
  indicative_price: string | null;
  consultation_fee?: string | null;
  cancellation_policy?: string;
  accountant?: number;
  is_active?: boolean;
  /** Nested category from the API, or null for legacy uncategorized rows. */
  category?: ServiceCategory | null;
};

export type BookingPayment = {
  id: number;
  amount: string;
  currency: string;
  status: "pending" | "paid" | "payable";
  status_label: string;
  paid_at: string | null;
  payable_at: string | null;
  checkout_session_id: string;
  processor_reference: string;
  created_at: string;
  updated_at: string;
};

export type PaymentOptions = {
  stripe_checkout: boolean;
  demo_payment: boolean;
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
  status:
    | "pending"
    | "awaiting_payment"
    | "confirmed"
    | "declined"
    | "cancelled";
  status_label: string;
  consultation_fee: string;
  cancellation_policy: string;
  payment: BookingPayment | null;
  service: number | null;
  service_name: string | null;
  created_at: string;
  updated_at: string;
};

export type InquiryListItem = {
  id: number;
  status: string;
  created_at: string;
  client: number;
  accountant: number;
  accountant_name: string;
  client_name?: string;
  unread?: boolean;
};

export async function listMyInquiries() {
  const res = await apiFetch("/api/inquiries/");
  if (!res.ok) throw new Error(await res.text());
  return (await res.json()) as InquiryListItem[];
}

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
  service: number;
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
  if (!res.ok) throw await readApiError(res, "Could not load bookings");
  return (await res.json()) as Booking[];
}

export async function listInquiryBookings(inquiryId: number | string) {
  const res = await apiFetch(`/bookings/by-inquiry/${inquiryId}/`);
  if (!res.ok) throw await readApiError(res, "Could not load bookings");
  return (await res.json()) as Booking[];
}

export async function acceptBooking(bookingId: number) {
  const res = await apiFetch(`/bookings/${bookingId}/accept/`, { method: "POST" });
  if (!res.ok) throw await readApiError(res, "Could not accept consultation");
  return (await res.json()) as Booking;
}

export async function declineBooking(bookingId: number) {
  const res = await apiFetch(`/bookings/${bookingId}/decline/`, { method: "POST" });
  if (!res.ok) throw await readApiError(res, "Could not decline consultation");
  return (await res.json()) as Booking;
}

export async function cancelBooking(bookingId: number) {
  const res = await apiFetch(`/bookings/${bookingId}/cancel/`, { method: "POST" });
  if (!res.ok) throw await readApiError(res, "Could not cancel consultation");
  return (await res.json()) as Booking;
}

export async function getPaymentOptions() {
  const res = await apiFetch("/bookings/payment-options/");
  if (!res.ok) throw await readApiError(res, "Could not load payment options");
  return (await res.json()) as PaymentOptions;
}

export async function createBookingCheckout(bookingId: number) {
  const res = await apiFetch(`/bookings/${bookingId}/checkout/`, {
    method: "POST",
    body: JSON.stringify({}),
  });
  if (!res.ok) throw await readApiError(res, "Could not start Stripe Checkout");
  return (await res.json()) as { checkout_url: string };
}

export async function completeDemoPayment(bookingId: number) {
  const res = await apiFetch(`/bookings/${bookingId}/complete-demo-payment/`, {
    method: "POST",
    body: JSON.stringify({}),
  });
  if (!res.ok) throw await readApiError(res, "Could not complete demo payment");
  return (await res.json()) as Booking;
}

export type AccountantServiceScope = "local" | "remote" | "nationwide";

export type AccountantPublicationStatus = "draft" | "published";

/** Shared publication flags on profile and status API payloads. */
export type AccountantPublicationState = {
  publication_status: AccountantPublicationStatus;
  is_publish_ready: boolean;
  is_public: boolean;
  /** Compatibility alias of is_publish_ready (not publication_status). */
  profile_complete: boolean;
};

/** Owner/dashboard-only publish gaps (DRF-style field → message list). */
export type PublishReadinessErrors = Record<string, string[]>;

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
  headline?: string;
  latitude?: number | null;
  longitude?: number | null;
  service_scope?: AccountantServiceScope;
  map_eligible?: boolean;
  services: {
    id: number;
    name: string;
    pricing_type?: "fixed" | "hourly" | "consultation_required";
    indicative_price?: string | null;
    consultation_fee?: string | null;
    cancellation_policy?: string;
  }[];
} & AccountantPublicationState;

/** Partial owner profile create/update body (draft-safe; omit unchanged fields). */
export type AccountantProfileDraftBody = {
  first_name?: string;
  last_name?: string;
  bio?: string;
  credentials?: string;
  years_experience?: number;
  firm_name?: string;
  location?: string;
  headline?: string;
  service_scope?: AccountantServiceScope;
  service_name?: string;
  service_description?: string;
  category_id?: number;
  languages?: string[];
  offers_remote?: boolean;
  offers_in_person?: boolean;
  industries?: string[];
  website?: string;
  license_information?: string;
};

/** Authenticated accountant profile/dashboard payload. */
export type AccountantMyProfilePayload = AccountantProfilePayload & {
  publish_readiness_errors: PublishReadinessErrors;
};

export type AccountantProfileStatus = {
  profile_info_complete: boolean;
  services_exist: boolean;
} & AccountantPublicationState;

/** Owner profile-status payload (includes readiness errors). */
export type AccountantMyProfileStatus = AccountantProfileStatus & {
  publish_readiness_errors: PublishReadinessErrors;
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
  return (await res.json()) as AccountantProfileStatus | AccountantMyProfileStatus;
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
  return (await res.json()) as AccountantMyProfilePayload;
}

export async function createAccountantProfile(body: AccountantProfileDraftBody) {
  const res = await apiFetch("/accountants/create/", {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!res.ok) throw await readApiError(res, "Failed to save accountant profile");
  return (await res.json()) as AccountantMyProfilePayload;
}

export async function publishMyAccountantProfile() {
  const res = await apiFetch("/accountants/me/publish/", {
    method: "POST",
    body: JSON.stringify({}),
  });
  if (!res.ok) throw await readApiError(res, "Failed to publish profile");
  return (await res.json()) as AccountantMyProfilePayload;
}

export async function unpublishMyAccountantProfile() {
  const res = await apiFetch("/accountants/me/unpublish/", {
    method: "POST",
    body: JSON.stringify({}),
  });
  if (!res.ok) throw await readApiError(res, "Failed to unpublish profile");
  return (await res.json()) as AccountantMyProfilePayload;
}

export async function listServiceCategories() {
  const res = await fetch(`${API_BASE}/services/categories/`);
  if (!res.ok) throw await readApiError(res, "Could not load service categories");
  return (await res.json()) as ServiceCategory[];
}

export async function getMyServices() {
  const res = await apiFetch("/services/mine/");
  if (!res.ok) throw await readApiError(res, "Could not load your services");
  return (await res.json()) as CatalogService[];
}

export async function updateMyService(
  serviceId: number,
  body: {
    name?: string;
    description?: string;
    pricing_type?: CatalogService["pricing_type"];
    indicative_price?: string | null;
    consultation_fee?: string | null;
    consultation_is_paid?: boolean;
    cancellation_policy?: string;
    category_id?: number;
    is_active?: boolean;
  }
) {
  const res = await apiFetch(`/services/${serviceId}/`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
  if (!res.ok) throw await readApiError(res, "Failed to update service");
  return (await res.json()) as CatalogService;
}

export async function createMyService(body: {
  name: string;
  description: string;
  pricing_type?: CatalogService["pricing_type"];
  indicative_price?: string | null;
  consultation_fee?: string | null;
  consultation_is_paid?: boolean;
  cancellation_policy?: string;
  category_id: number;
}) {
  const res = await apiFetch("/services/", {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!res.ok) throw await readApiError(res, "Failed to create service");
  return (await res.json()) as CatalogService;
}

export async function deactivateMyService(serviceId: number) {
  const res = await apiFetch(`/services/${serviceId}/`, {
    method: "PATCH",
    body: JSON.stringify({ is_active: false }),
  });
  if (!res.ok) throw await readApiError(res, "Failed to deactivate service");
  return (await res.json()) as CatalogService;
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
  is_system?: boolean;
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

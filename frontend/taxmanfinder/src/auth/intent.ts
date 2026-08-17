const INTENT_STORAGE_KEY = "onboarding_intent";
const NEXT_STORAGE_KEY = "post_auth_next";

export type OnboardingIntent = "looking-for-help" | "tax-professional";

export function isSafeNextPath(next: string | null | undefined): next is string {
  return Boolean(next && next.startsWith("/") && !next.startsWith("//"));
}

export function setOnboardingIntent(intent: OnboardingIntent | null) {
  if (intent) {
    localStorage.setItem(INTENT_STORAGE_KEY, intent);
  } else {
    localStorage.removeItem(INTENT_STORAGE_KEY);
  }
}

export function getStoredOnboardingIntent(): OnboardingIntent | null {
  const value = localStorage.getItem(INTENT_STORAGE_KEY);
  if (value === "looking-for-help" || value === "tax-professional") {
    return value;
  }
  return null;
}

export function setStoredNextPath(next: string | null | undefined) {
  if (isSafeNextPath(next) && next !== "/dashboard/client") {
    localStorage.setItem(NEXT_STORAGE_KEY, next);
  } else if (next == null) {
    localStorage.removeItem(NEXT_STORAGE_KEY);
  }
}

export function getStoredNextPath(): string | null {
  const next = localStorage.getItem(NEXT_STORAGE_KEY);
  return isSafeNextPath(next) ? next : null;
}

export function clearPostAuthRouting() {
  localStorage.removeItem(INTENT_STORAGE_KEY);
  localStorage.removeItem(NEXT_STORAGE_KEY);
}

export function persistClientBrowseIntent() {
  setOnboardingIntent("looking-for-help");
  if (getStoredNextPath() === "/onboarding/accountant") {
    localStorage.removeItem(NEXT_STORAGE_KEY);
  }
}

export function persistAccountantSignupIntent() {
  setOnboardingIntent("tax-professional");
  setStoredNextPath("/onboarding/accountant");
}

export function persistIntentFromAuthParams(options?: {
  next?: string | null;
  intent?: string | null;
}) {
  if (options?.intent === "tax-professional") {
    persistAccountantSignupIntent();
    return;
  }
  if (options?.intent === "looking-for-help") {
    persistClientBrowseIntent();
  }
  if (options?.next) {
    setStoredNextPath(options.next);
  }
}

function accountantOnboardingPath(path: string | null | undefined) {
  return path === "/onboarding/accountant";
}

export function loginPath(options?: { next?: string | null; intent?: string | null }) {
  persistIntentFromAuthParams(options);
  const params = new URLSearchParams();
  const next =
    options?.intent === "tax-professional"
      ? "/onboarding/accountant"
      : options?.next;
  if (isSafeNextPath(next) && next !== "/dashboard/client") {
    params.set("next", next);
  }
  if (options?.intent === "tax-professional" || options?.intent === "looking-for-help") {
    params.set("intent", options.intent);
  }
  const query = params.toString();
  return query ? `/login?${query}` : "/login";
}

export function signupPath(options?: { next?: string | null; intent?: string | null }) {
  persistIntentFromAuthParams(options);
  const params = new URLSearchParams();
  const next =
    options?.intent === "tax-professional"
      ? "/onboarding/accountant"
      : options?.next;
  if (isSafeNextPath(next) && next !== "/dashboard/client") {
    params.set("next", next);
  }
  if (options?.intent === "tax-professional" || options?.intent === "looking-for-help") {
    params.set("intent", options.intent);
  }
  const query = params.toString();
  return query ? `/signup?${query}` : "/signup";
}

export function resolvePostAuthPath(options: {
  next?: string | null;
  intent?: string | null;
  hasAccountantProfile: boolean;
  profileComplete?: boolean;
}) {
  const intent = options.intent || getStoredOnboardingIntent();
  const storedNext = getStoredNextPath();
  const queryNext = isSafeNextPath(options.next) ? options.next : null;
  const accountantIntent = intent === "tax-professional";
  const profileComplete = Boolean(options.profileComplete);

  // Explicit return-to from messaging/consultation wins over leftover accountant intent,
  // except when that return-to is the default client dashboard.
  if (
    queryNext &&
    queryNext !== "/dashboard/client" &&
    !accountantOnboardingPath(queryNext)
  ) {
    return queryNext;
  }

  if (
    accountantIntent ||
    accountantOnboardingPath(queryNext) ||
    accountantOnboardingPath(storedNext)
  ) {
    if (options.hasAccountantProfile && profileComplete) {
      clearPostAuthRouting();
      return "/dashboard/accountant";
    }
    return "/onboarding/accountant";
  }

  if (storedNext && storedNext !== "/dashboard/client") {
    return storedNext;
  }

  return "/dashboard/client";
}

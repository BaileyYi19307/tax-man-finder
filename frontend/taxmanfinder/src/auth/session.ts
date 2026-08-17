export const ACCESS_TOKEN_KEY = "access_token";
export const REFRESH_TOKEN_KEY = "refresh_token";
export const USER_ID_KEY = "user_id";

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function setAuthSession(options: {
  accessToken: string;
  refreshToken: string;
  userId: number | string;
}) {
  localStorage.setItem(ACCESS_TOKEN_KEY, options.accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, options.refreshToken);
  localStorage.setItem(USER_ID_KEY, String(options.userId));
}

export function clearAuthSession() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_ID_KEY);
}

export function isLoggedIn(): boolean {
  return Boolean(getAccessToken());
}

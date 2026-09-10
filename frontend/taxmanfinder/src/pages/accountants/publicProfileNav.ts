/** Owner entry context for the canonical public accountant profile URL. */

export type PublicProfileFrom = "dashboard" | "profile-editor";

export function publicAccountantProfilePath(
  userId: number | string,
  from?: PublicProfileFrom
): string {
  const base = `/accountants/${userId}`;
  if (from === "dashboard") {
    return `${base}?from=dashboard`;
  }
  if (from === "profile-editor") {
    return `${base}?from=profile-editor`;
  }
  return base;
}

export function resolvePublicProfileBackNav(from: string | null | undefined): {
  label: string;
  to: string;
} {
  if (from === "dashboard") {
    return {
      label: "← Back to accountant dashboard",
      to: "/dashboard/accountant",
    };
  }
  if (from === "profile-editor") {
    return {
      label: "← Back to profile editor",
      to: "/onboarding/accountant/preview",
    };
  }
  return {
    label: "← Back to accountants",
    to: "/accountants",
  };
}

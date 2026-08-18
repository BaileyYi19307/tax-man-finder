export type AccountantNameFields = {
  first_name?: string | null;
  last_name?: string | null;
  firm_name?: string | null;
  location?: string | null;
};

export function accountantDisplayName(profile: AccountantNameFields): string {
  const name = `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim();
  if (name) return name;
  const firm = (profile.firm_name ?? "").trim();
  if (firm) return firm;
  return "Tax professional";
}

export function accountantFirmLocationLine(profile: AccountantNameFields): string | null {
  const name = `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim();
  const firm = (profile.firm_name ?? "").trim();
  const location = (profile.location ?? "").trim();
  const parts: string[] = [];
  if (name && firm) parts.push(firm);
  if (location) parts.push(location);
  return parts.length ? parts.join(" · ") : null;
}

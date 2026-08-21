import type { AccountantProfilePayload } from "../../api/client";

/** Accountants that can render as map pins. */
export function pinEligibleAccountants(
  rows: AccountantProfilePayload[]
): AccountantProfilePayload[] {
  return rows.filter(
    (a) =>
      a.latitude != null &&
      a.longitude != null &&
      !Number.isNaN(Number(a.latitude)) &&
      !Number.isNaN(Number(a.longitude))
  );
}

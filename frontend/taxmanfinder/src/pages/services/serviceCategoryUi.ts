import type { ServiceCategory } from "../../api/client";

/** True when the service category is present in the active public list. */
export function isSelectableCategory(
  category: ServiceCategory | null | undefined,
  options: ServiceCategory[]
): boolean {
  if (!category) return false;
  return options.some((option) => option.id === category.id);
}

/** Select value for a service: category id string, or "" when legacy/invalid. */
export function categorySelectValue(
  category: ServiceCategory | null | undefined,
  options: ServiceCategory[]
): string {
  return isSelectableCategory(category, options) ? String(category!.id) : "";
}

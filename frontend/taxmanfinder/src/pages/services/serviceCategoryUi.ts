import type { ServiceCategory } from "../../api/client";

/** True when the category id is present in the active public list. */
export function isSelectableCategoryId(
  categoryId: string,
  options: ServiceCategory[]
): boolean {
  if (!categoryId) return false;
  return options.some((option) => String(option.id) === categoryId);
}

/** True when the service category is present in the active public list. */
export function isSelectableCategory(
  category: ServiceCategory | null | undefined,
  options: ServiceCategory[]
): boolean {
  if (!category) return false;
  return isSelectableCategoryId(String(category.id), options);
}

/** Initialize edit/create select state from a service category, ignoring option load. */
export function categoryIdFromService(
  category: ServiceCategory | null | undefined
): string {
  return category?.id != null ? String(category.id) : "";
}

/**
 * After active categories load, keep the id only if it is still assignable.
 * Clears null/legacy/inactive/missing ids so the user must pick a valid category.
 */
export function reconcileCategorySelectValue(
  currentId: string,
  options: ServiceCategory[]
): string {
  return isSelectableCategoryId(currentId, options) ? currentId : "";
}

/** Select value for a service: category id string, or "" when legacy/invalid. */
export function categorySelectValue(
  category: ServiceCategory | null | undefined,
  options: ServiceCategory[]
): string {
  return reconcileCategorySelectValue(categoryIdFromService(category), options);
}

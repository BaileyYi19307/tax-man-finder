import { categorySelectValue, isSelectableCategory } from "./serviceCategoryUi";

const options = [
  { id: 1, name: "Individual tax returns", slug: "individual-tax-returns" },
  { id: 3, name: "Bookkeeping", slug: "bookkeeping" },
];

test("selectable when category is in the active options list", () => {
  expect(
    isSelectableCategory(
      { id: 3, name: "Bookkeeping", slug: "bookkeeping" },
      options
    )
  ).toBe(true);
  expect(categorySelectValue({ id: 3, name: "Bookkeeping", slug: "bookkeeping" }, options)).toBe(
    "3"
  );
});

test("legacy null or unavailable categories force an empty placeholder value", () => {
  expect(isSelectableCategory(null, options)).toBe(false);
  expect(categorySelectValue(null, options)).toBe("");
  expect(
    categorySelectValue(
      { id: 99, name: "Uncategorized", slug: "uncategorized" },
      options
    )
  ).toBe("");
});

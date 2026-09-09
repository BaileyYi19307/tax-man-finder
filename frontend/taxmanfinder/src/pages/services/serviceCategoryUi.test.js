import {
  categoryIdFromService,
  categorySelectValue,
  isSelectableCategory,
  reconcileCategorySelectValue,
} from "./serviceCategoryUi";

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

test("categoryIdFromService ignores whether options have loaded", () => {
  expect(
    categoryIdFromService({ id: 1, name: "Individual tax returns", slug: "individual-tax-returns" })
  ).toBe("1");
  expect(categoryIdFromService(null)).toBe("");
  expect(reconcileCategorySelectValue("1", [])).toBe("");
  expect(reconcileCategorySelectValue("1", options)).toBe("1");
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
  expect(reconcileCategorySelectValue("99", options)).toBe("");
});

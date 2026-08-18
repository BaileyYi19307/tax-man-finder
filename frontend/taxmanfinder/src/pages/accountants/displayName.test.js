import { accountantDisplayName, accountantFirmLocationLine } from "./displayName";

test("prefers the person's name over firm and email", () => {
  expect(
    accountantDisplayName({
      first_name: "Ada",
      last_name: "Lovelace",
      firm_name: "Lovelace Tax",
    })
  ).toBe("Ada Lovelace");
});

test("falls back to firm when the name is blank", () => {
  expect(
    accountantDisplayName({
      first_name: "",
      last_name: "",
      firm_name: "Lovelace Tax",
    })
  ).toBe("Lovelace Tax");
});

test("uses a generic label instead of email when name and firm are blank", () => {
  expect(
    accountantDisplayName({
      first_name: "",
      last_name: "",
      firm_name: "",
    })
  ).toBe("Tax professional");
});

test("subtitle shows firm and location under a named title", () => {
  expect(
    accountantFirmLocationLine({
      first_name: "Ada",
      last_name: "Lovelace",
      firm_name: "Lovelace Tax",
      location: "Remote",
    })
  ).toBe("Lovelace Tax · Remote");
});

test("subtitle does not repeat firm when the title already is the firm", () => {
  expect(
    accountantFirmLocationLine({
      first_name: "",
      last_name: "",
      firm_name: "Lovelace Tax",
      location: "Boston, MA",
    })
  ).toBe("Boston, MA");
});

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  CancellationPolicySelect,
  CANCELLATION_POLICY_UNSET,
  cancellationPolicySelectValue,
  hasCancellationPolicyCode,
} from "./cancellationPolicyUi";

const options = [
  {
    code: "free_24h",
    label:
      "Full refund if cancelled at least 24 hours before the consultation. Cancellations within 24 hours are non-refundable.",
  },
  {
    code: "free_48h",
    label:
      "Full refund if cancelled at least 48 hours before the consultation. Cancellations within 48 hours are non-refundable.",
  },
  {
    code: "non_refundable",
    label: "The consultation fee is non-refundable after booking.",
  },
];

test("helpers recognize codes and map legacy unset", () => {
  expect(hasCancellationPolicyCode("free_24h")).toBe(true);
  expect(hasCancellationPolicyCode(null)).toBe(false);
  expect(cancellationPolicySelectValue(null)).toBe(CANCELLATION_POLICY_UNSET);
  expect(cancellationPolicySelectValue("free_48h")).toBe("free_48h");
});

test("select shows placeholder and full option wording", () => {
  const onChange = jest.fn();
  render(
    <CancellationPolicySelect
      id="policy"
      value={CANCELLATION_POLICY_UNSET}
      options={options}
      onChange={onChange}
    />
  );

  const select = screen.getByLabelText("Cancellation policy");
  expect(select).toHaveValue("");
  expect(
    screen.getByRole("option", { name: "Select a cancellation policy" })
  ).toBeInTheDocument();
  expect(
    screen.getByRole("option", {
      name: /Full refund if cancelled at least 24 hours/i,
    })
  ).toBeInTheDocument();

  userEvent.selectOptions(select, "non_refundable");
  expect(onChange).toHaveBeenCalledWith("non_refundable");
});

test("field error is shown next to the select", () => {
  render(
    <CancellationPolicySelect
      id="policy"
      value={CANCELLATION_POLICY_UNSET}
      options={options}
      onChange={() => {}}
      error="Select a cancellation policy."
    />
  );
  expect(screen.getByRole("alert")).toHaveTextContent(
    "Select a cancellation policy."
  );
});

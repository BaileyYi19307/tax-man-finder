import { MemoryRouter } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import AccountantDashboard from "./AccountantDashboard";

jest.mock("../../api/client", () => ({
  apiFetch: jest.fn(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve([]),
    })
  ),
}));

test("My Services routes to the accountant-owned services page", () => {
  render(
    <MemoryRouter>
      <AccountantDashboard />
    </MemoryRouter>
  );

  expect(screen.getByText("My Services").closest("a")).toHaveAttribute(
    "href",
    "/dashboard/services"
  );
});

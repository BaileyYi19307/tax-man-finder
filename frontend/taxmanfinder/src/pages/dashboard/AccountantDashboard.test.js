import { MemoryRouter } from "react-router-dom";
import { render, screen, waitFor } from "@testing-library/react";
import AccountantDashboard from "./AccountantDashboard";
import { apiFetch } from "../../api/client";
import { ACCESS_TOKEN_KEY } from "../../auth/session";

jest.mock("../../api/client", () => ({
  apiFetch: jest.fn(),
}));

function renderDashboard() {
  return render(
    <MemoryRouter>
      <AccountantDashboard />
    </MemoryRouter>
  );
}

beforeEach(() => {
  localStorage.clear();
  apiFetch.mockReset();
});

test("My Services routes to the accountant-owned services page", () => {
  renderDashboard();

  expect(screen.getByText("My Services").closest("a")).toHaveAttribute(
    "href",
    "/dashboard/services"
  );
});

test("My profile routes to the accountant profile editor", () => {
  renderDashboard();

  expect(screen.getByText("My profile").closest("a")).toHaveAttribute(
    "href",
    "/dashboard/profile"
  );
});

test("empty inquiry list is not treated as an error", async () => {
  localStorage.setItem(ACCESS_TOKEN_KEY, "token");
  apiFetch.mockResolvedValue({
    ok: true,
    json: async () => [],
    text: async () => "",
  });
  renderDashboard();

  expect(await screen.findByText("No inquiries yet.")).toBeInTheDocument();
  expect(screen.queryByText("Could not load inquiries.")).not.toBeInTheDocument();
});

test("failed inquiry fetch does not look like an empty inbox", async () => {
  localStorage.setItem(ACCESS_TOKEN_KEY, "token");
  apiFetch.mockResolvedValue({
    ok: false,
    json: async () => [],
    text: async () => "nope",
  });
  renderDashboard();

  expect(await screen.findByText("Could not load inquiries.")).toBeInTheDocument();
  expect(screen.queryByText("No inquiries yet.")).not.toBeInTheDocument();
  await waitFor(() => {
    expect(apiFetch).toHaveBeenCalledWith("/api/inquiries/");
  });
});

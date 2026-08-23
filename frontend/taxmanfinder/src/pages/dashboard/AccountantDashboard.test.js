import { MemoryRouter } from "react-router-dom";
import { render, screen, waitFor } from "@testing-library/react";
import { AuthProvider } from "../../auth/AuthProvider";
import AccountantDashboard from "./AccountantDashboard";
import { getMe, listMyBookings, listMyInquiries } from "../../api/client";
import { ACCESS_TOKEN_KEY, USER_ID_KEY } from "../../auth/session";

jest.mock("../../api/client", () => ({
  getMe: jest.fn(),
  listMyBookings: jest.fn(async () => []),
  listMyInquiries: jest.fn(),
}));

function renderDashboard() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <AccountantDashboard />
      </AuthProvider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  localStorage.clear();
  getMe.mockReset();
  listMyBookings.mockReset();
  listMyInquiries.mockReset();
  listMyBookings.mockResolvedValue([]);
  getMe.mockResolvedValue({
    id: 22,
    email: "pro@test.com",
    first_name: "Pat",
    last_name: "Pro",
    has_accountant_profile: true,
    accountant_profile_complete: true,
  });
});

test("My Services routes to the accountant-owned services page", async () => {
  localStorage.setItem(ACCESS_TOKEN_KEY, "token");
  localStorage.setItem(USER_ID_KEY, "22");
  listMyInquiries.mockResolvedValue([]);
  renderDashboard();

  expect(await screen.findByText("My Services")).toBeInTheDocument();
  expect(screen.getByText("My Services").closest("a")).toHaveAttribute(
    "href",
    "/dashboard/services"
  );
});

test("My profile routes to the accountant profile editor", async () => {
  localStorage.setItem(ACCESS_TOKEN_KEY, "token");
  localStorage.setItem(USER_ID_KEY, "22");
  listMyInquiries.mockResolvedValue([]);
  renderDashboard();

  expect(await screen.findByText("My profile")).toBeInTheDocument();
  expect(screen.getByText("My profile").closest("a")).toHaveAttribute(
    "href",
    "/dashboard/profile"
  );
});

test("empty inquiry list is not treated as an error", async () => {
  localStorage.setItem(ACCESS_TOKEN_KEY, "token");
  localStorage.setItem(USER_ID_KEY, "22");
  listMyInquiries.mockResolvedValue([]);
  renderDashboard();

  expect(await screen.findByText("No inquiries yet.")).toBeInTheDocument();
  expect(screen.queryByText("Could not load inquiries.")).not.toBeInTheDocument();
});

test("failed inquiry fetch does not look like an empty inbox", async () => {
  localStorage.setItem(ACCESS_TOKEN_KEY, "token");
  localStorage.setItem(USER_ID_KEY, "22");
  listMyInquiries.mockRejectedValue(new Error("nope"));
  renderDashboard();

  expect(await screen.findByText("Could not load inquiries.")).toBeInTheDocument();
  expect(screen.queryByText("No inquiries yet.")).not.toBeInTheDocument();
  await waitFor(() => {
    expect(listMyInquiries).toHaveBeenCalled();
  });
});

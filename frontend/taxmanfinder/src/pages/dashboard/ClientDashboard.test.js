import { MemoryRouter } from "react-router-dom";
import { render, screen, waitFor } from "@testing-library/react";
import { AuthProvider } from "../../auth/AuthProvider";
import ClientDashboard from "./ClientDashboard";
import { getMe, listMyBookings, listMyInquiries } from "../../api/client";
import { ACCESS_TOKEN_KEY, USER_ID_KEY } from "../../auth/session";

jest.mock("../../api/client", () => ({
  getMe: jest.fn(),
  listMyBookings: jest.fn(async () => []),
  listMyInquiries: jest.fn(async () => []),
}));

test("Find a Tax Professional goes to the accountant directory", async () => {
  localStorage.setItem(ACCESS_TOKEN_KEY, "token");
  localStorage.setItem(USER_ID_KEY, "11");
  getMe.mockResolvedValue({
    id: 11,
    email: "client@test.com",
    first_name: "Ann",
    last_name: "Client",
    has_accountant_profile: false,
    accountant_profile_complete: false,
  });

  render(
    <MemoryRouter>
      <AuthProvider>
        <ClientDashboard />
      </AuthProvider>
    </MemoryRouter>
  );

  expect(
    await screen.findByRole("link", { name: "Browse accountants" })
  ).toHaveAttribute("href", "/accountants");
  expect(screen.queryByText(/Logged in as user/i)).not.toBeInTheDocument();
  await waitFor(() => {
    expect(listMyBookings).toHaveBeenCalled();
    expect(listMyInquiries).toHaveBeenCalled();
  });
});

import { MemoryRouter, Route, Routes } from "react-router-dom";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthProvider } from "../auth/AuthProvider";
import { AppLayout } from "./AppHeader";
import Home from "../pages/Home";
import { getMe, listPublicServices } from "../api/client";
import {
  ACCESS_TOKEN_KEY,
  REFRESH_TOKEN_KEY,
  USER_ID_KEY,
} from "../auth/session";

jest.mock("../api/client", () => ({
  __esModule: true,
  getMe: jest.fn(),
  listPublicServices: jest.fn(async () => []),
  listMyBookings: jest.fn(async () => []),
  listMyInquiries: jest.fn(async () => []),
}));

const clientUser = {
  id: 11,
  email: "client@test.com",
  first_name: "Ann",
  last_name: "Client",
  has_accountant_profile: false,
  accountant_profile_complete: false,
};

const accountantUser = {
  id: 22,
  email: "pro@test.com",
  first_name: "Pat",
  last_name: "Pro",
  has_accountant_profile: true,
  accountant_profile_complete: true,
};

function renderShell(initialPath = "/accountants") {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <AuthProvider>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/accountants" element={<div>Directory page</div>} />
            <Route path="/chat" element={<div>Messages page</div>} />
            <Route path="/bookings" element={<div>Consultations page</div>} />
            <Route path="/dashboard/client" element={<div>Client dash</div>} />
            <Route path="/dashboard/accountant" element={<div>Accountant dash</div>} />
            <Route path="/dashboard/profile" element={<div>Profile edit</div>} />
            <Route path="/login" element={<div>Login page</div>} />
            <Route path="/signup" element={<div>Signup page</div>} />
            <Route path="/onboarding/accountant" element={<div>Onboarding</div>} />
          </Route>
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  );
}

function seedSession(user) {
  localStorage.setItem(ACCESS_TOKEN_KEY, "access-token");
  localStorage.setItem(REFRESH_TOKEN_KEY, "refresh-token");
  localStorage.setItem(USER_ID_KEY, String(user.id));
  getMe.mockResolvedValue(user);
}

beforeEach(() => {
  localStorage.clear();
  getMe.mockReset();
  listPublicServices.mockReset();
  listPublicServices.mockResolvedValue([]);
});

test("logged-out header shows browse, how it works, login, and for professionals", () => {
  renderShell();

  expect(screen.getByRole("link", { name: "Browse professionals" })).toHaveAttribute(
    "href",
    "/accountants"
  );
  expect(screen.getByRole("link", { name: "How it works" })).toHaveAttribute(
    "href",
    "/#how-it-works"
  );
  expect(screen.getByRole("link", { name: "Log in" })).toHaveAttribute(
    "href",
    "/login"
  );
  expect(screen.getByRole("link", { name: "For professionals" })).toHaveAttribute(
    "href",
    "/onboarding/accountant"
  );
  expect(screen.queryByRole("link", { name: "Sign up" })).not.toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "Messages" })).not.toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "Consultations" })).not.toBeInTheDocument();
  expect(
    screen.queryByRole("link", { name: "Client Dashboard" })
  ).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Log out" })).not.toBeInTheDocument();
});

test("client header shows client dashboard and authenticated links", async () => {
  seedSession(clientUser);
  renderShell();

  expect(await screen.findByRole("link", { name: /^Messages/ })).toHaveAttribute(
    "href",
    "/chat"
  );
  expect(screen.getByRole("link", { name: "Browse professionals" })).toHaveAttribute(
    "href",
    "/accountants"
  );
  expect(screen.getByRole("link", { name: /^Consultations/ })).toHaveAttribute(
    "href",
    "/bookings"
  );
  expect(screen.getByRole("link", { name: "Client Dashboard" })).toHaveAttribute(
    "href",
    "/dashboard/client"
  );
  expect(screen.getByRole("link", { name: "For professionals" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Log out" })).toBeInTheDocument();
  expect(
    screen.queryByRole("link", { name: "Accountant Dashboard" })
  ).not.toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "My profile" })).not.toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "Log in" })).not.toBeInTheDocument();
});

test("accountant header uses profile capability, not leftover signup intent", async () => {
  localStorage.setItem("onboarding_intent", "looking-for-help");
  seedSession(accountantUser);
  renderShell();

  expect(
    await screen.findByRole("link", { name: "Accountant Dashboard" })
  ).toHaveAttribute("href", "/dashboard/accountant");
  expect(screen.getByRole("link", { name: "My profile" })).toHaveAttribute(
    "href",
    "/dashboard/profile"
  );
  expect(screen.getByRole("link", { name: /^Messages/ })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /^Consultations/ })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Browse professionals" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Log out" })).toBeInTheDocument();
  expect(
    screen.queryByRole("link", { name: "Client Dashboard" })
  ).not.toBeInTheDocument();
});

test("client user is not treated as an accountant because of leftover tax-professional intent", async () => {
  localStorage.setItem("onboarding_intent", "tax-professional");
  seedSession(clientUser);
  renderShell();

  expect(
    await screen.findByRole("link", { name: "Client Dashboard" })
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("link", { name: "Accountant Dashboard" })
  ).not.toBeInTheDocument();
});

test("logout clears session, updates the header, and returns to home", async () => {
  seedSession(clientUser);
  renderShell("/");

  expect(await screen.findByRole("button", { name: "Log out" })).toBeInTheDocument();
  userEvent.click(screen.getByRole("button", { name: "Log out" }));

  await waitFor(() => {
    expect(localStorage.getItem(ACCESS_TOKEN_KEY)).toBeNull();
  });
  expect(localStorage.getItem(REFRESH_TOKEN_KEY)).toBeNull();
  expect(localStorage.getItem(USER_ID_KEY)).toBeNull();
  expect(screen.getByRole("link", { name: "Log in" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Log out" })).not.toBeInTheDocument();
  expect(
    screen.queryByRole("link", { name: "Client Dashboard" })
  ).not.toBeInTheDocument();
  expect(
    screen.getByRole("heading", {
      name: "Find the right tax professional for your situation.",
    })
  ).toBeInTheDocument();
});

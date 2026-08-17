import { MemoryRouter, Route, Routes } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import { AuthProvider } from "../auth/AuthProvider";
import { AppLayout } from "../components/AppHeader";
import Home from "./Home";
import { getMe } from "../api/client";
import { ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY, USER_ID_KEY } from "../auth/session";

jest.mock("../api/client", () => ({
  getMe: jest.fn(),
}));

function renderHome() {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <AuthProvider>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/accountants" element={<div>Directory page</div>} />
            <Route path="/dashboard/client" element={<div>Client dash</div>} />
            <Route path="/dashboard/accountant" element={<div>Accountant dash</div>} />
          </Route>
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  localStorage.clear();
  getMe.mockReset();
});

test("logged-out Home still exposes login and signup in the header", () => {
  renderHome();

  expect(screen.getByRole("link", { name: "Log in" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Sign up" })).toBeInTheDocument();
  expect(
    screen.queryByRole("link", { name: "Go to client dashboard" })
  ).not.toBeInTheDocument();
});

test("logged-in Home does not prompt the user to sign up again", async () => {
  localStorage.setItem(ACCESS_TOKEN_KEY, "access-token");
  localStorage.setItem(REFRESH_TOKEN_KEY, "refresh-token");
  localStorage.setItem(USER_ID_KEY, "11");
  getMe.mockResolvedValue({
    id: 11,
    email: "client@test.com",
    first_name: "Ann",
    last_name: "Client",
    has_accountant_profile: false,
    accountant_profile_complete: false,
  });

  renderHome();

  expect(
    await screen.findByRole("link", { name: "Go to client dashboard" })
  ).toHaveAttribute("href", "/dashboard/client");
  expect(screen.getByRole("link", { name: "Browse accountants" })).toHaveAttribute(
    "href",
    "/accountants"
  );
  expect(screen.queryByRole("link", { name: "Log in" })).not.toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "Sign up" })).not.toBeInTheDocument();
});

test("logged-in accountant Home continues to the accountant dashboard", async () => {
  localStorage.setItem(ACCESS_TOKEN_KEY, "access-token");
  getMe.mockResolvedValue({
    id: 22,
    email: "pro@test.com",
    first_name: "Pat",
    last_name: "Pro",
    has_accountant_profile: true,
    accountant_profile_complete: true,
  });

  renderHome();

  expect(
    await screen.findByRole("link", { name: "Go to accountant dashboard" })
  ).toHaveAttribute("href", "/dashboard/accountant");
});

import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import { AuthProvider } from "./AuthProvider";
import { RequireAccountantDashboard, RequireAuth } from "./RequireAuth";
import { getMe } from "../api/client";
import { ACCESS_TOKEN_KEY } from "./session";

jest.mock("../api/client", () => ({
  getMe: jest.fn(),
}));

function LoginPage() {
  const location = useLocation();
  return (
    <div>
      Login page
      <span data-testid="login-search">{location.search}</span>
    </div>
  );
}

function renderGuarded(initialPath) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/onboarding/accountant" element={<div>Onboarding page</div>} />
          <Route path="/dashboard/client" element={<div>Client dash</div>} />
          <Route element={<RequireAuth />}>
            <Route path="/chat" element={<div>Messages page</div>} />
            <Route element={<RequireAccountantDashboard />}>
              <Route path="/dashboard/accountant" element={<div>Accountant dash</div>} />
            </Route>
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

test("unauthenticated /chat redirects to login with next", async () => {
  renderGuarded("/chat");
  expect(await screen.findByText("Login page")).toBeInTheDocument();
  expect(screen.getByTestId("login-search")).toHaveTextContent("next=%2Fchat");
  expect(screen.queryByText("Messages page")).not.toBeInTheDocument();
});

test("unauthenticated accountant dashboard redirects to login", async () => {
  renderGuarded("/dashboard/accountant");
  expect(await screen.findByText("Login page")).toBeInTheDocument();
  expect(screen.getByTestId("login-search")).toHaveTextContent(
    "next=%2Fdashboard%2Faccountant"
  );
  expect(screen.queryByText("Accountant dash")).not.toBeInTheDocument();
});

test("complete accountant can open the accountant dashboard", async () => {
  localStorage.setItem(ACCESS_TOKEN_KEY, "token");
  getMe.mockResolvedValue({
    id: 22,
    email: "pro@test.com",
    first_name: "Pat",
    last_name: "Pro",
    has_accountant_profile: true,
    accountant_profile_complete: true,
  });
  renderGuarded("/dashboard/accountant");
  expect(await screen.findByText("Accountant dash")).toBeInTheDocument();
});

test("incomplete accountant is sent from accountant dashboard to onboarding", async () => {
  localStorage.setItem(ACCESS_TOKEN_KEY, "token");
  getMe.mockResolvedValue({
    id: 22,
    email: "pro@test.com",
    first_name: "Pat",
    last_name: "Pro",
    has_accountant_profile: true,
    accountant_profile_complete: false,
  });
  renderGuarded("/dashboard/accountant");
  expect(await screen.findByText("Onboarding page")).toBeInTheDocument();
});

test("client cannot stay on the accountant dashboard", async () => {
  localStorage.setItem(ACCESS_TOKEN_KEY, "token");
  getMe.mockResolvedValue({
    id: 11,
    email: "client@test.com",
    first_name: "Ann",
    last_name: "Client",
    has_accountant_profile: false,
    accountant_profile_complete: false,
  });
  renderGuarded("/dashboard/accountant");
  expect(await screen.findByText("Client dash")).toBeInTheDocument();
});

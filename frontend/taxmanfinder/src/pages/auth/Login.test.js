import { MemoryRouter, Route, Routes } from "react-router-dom";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axios from "axios";
import { AuthProvider } from "../../auth/AuthProvider";
import LoginPage from "./Login";

jest.mock("axios");
jest.mock("../../api/client", () => ({
  getMe: jest.fn().mockResolvedValue({
    id: 1,
    email: "client@test.com",
    first_name: "Client",
    last_name: "User",
    has_accountant_profile: false,
    accountant_profile_complete: false,
  }),
}));

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={["/login"]}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/dashboard/client" element={<div>Client dash</div>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  localStorage.clear();
  axios.post.mockReset();
});

async function submitLogin() {
  userEvent.type(screen.getByLabelText("Email"), "client@test.com");
  userEvent.type(screen.getByLabelText("Password"), "password123");
  userEvent.click(screen.getByRole("button", { name: "Login" }));
}

test("displays string detail login errors", async () => {
  axios.post.mockRejectedValue({
    response: { status: 400, data: { detail: "Invalid credentials." } },
  });
  renderLogin();
  await submitLogin();
  expect(await screen.findByText("Invalid credentials.")).toBeInTheDocument();
});

test("joins array detail login errors", async () => {
  axios.post.mockRejectedValue({
    response: {
      status: 400,
      data: { detail: ["Unable to log in.", "Check your password."] },
    },
  });
  renderLogin();
  await submitLogin();
  expect(
    await screen.findByText("Unable to log in. Check your password.")
  ).toBeInTheDocument();
});

test("falls back when detail is a non-string object", async () => {
  axios.post.mockRejectedValue({
    response: { status: 400, data: { detail: { code: "auth_failed" } } },
  });
  renderLogin();
  await submitLogin();
  expect(
    await screen.findByText("Login failed. Check email/password.")
  ).toBeInTheDocument();
});

test("uses message when detail is absent", async () => {
  axios.post.mockRejectedValue({
    response: { status: 400, data: { message: "Account locked." } },
  });
  renderLogin();
  await submitLogin();
  expect(await screen.findByText("Account locked.")).toBeInTheDocument();
});

test("successful login navigates to the client dashboard", async () => {
  axios.post.mockResolvedValue({
    data: {
      tokens: { access: "access-token", refresh: "refresh-token" },
      user: {
        id: 9,
        has_accountant_profile: false,
        accountant_profile_complete: false,
      },
    },
  });
  renderLogin();
  await submitLogin();
  expect(await screen.findByText("Client dash")).toBeInTheDocument();
  await waitFor(() => {
    expect(localStorage.getItem("access_token")).toBe("access-token");
  });
});

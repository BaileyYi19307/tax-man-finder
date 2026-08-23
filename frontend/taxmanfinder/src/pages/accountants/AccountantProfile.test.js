import { MemoryRouter, Route, Routes } from "react-router-dom";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AccountantProfilePage from "./AccountantProfile";
import { AuthProvider } from "../../auth/AuthProvider";
import {
  getMe,
  getPublicAccountantProfile,
  listMyInquiries,
} from "../../api/client";
import { ACCESS_TOKEN_KEY } from "../../auth/session";

jest.mock("../../api/client", () => ({
  getMe: jest.fn(),
  getPublicAccountantProfile: jest.fn(),
  listMyInquiries: jest.fn(),
  startConversation: jest.fn(),
  requestConsultation: jest.fn(),
}));

const listed = {
  user_id: 12,
  email: "ada@test.com",
  first_name: "Ada",
  last_name: "Lovelace",
  bio: "I prepare individual returns.",
  credentials: "EA",
  years_experience: 4,
  firm_name: "Lovelace Tax",
  location: "Remote",
  services: [{ id: 3, name: "Individual tax returns" }],
  profile_complete: true,
};

function renderProfile() {
  return render(
    <MemoryRouter initialEntries={["/accountants/12"]}>
      <AuthProvider>
        <Routes>
          <Route path="/accountants/:userId" element={<AccountantProfilePage />} />
          <Route path="/accountants" element={<div>Directory page</div>} />
          <Route path="/chat/:inquiryId" element={<div>Chat thread</div>} />
          <Route path="/chat" element={<div>Inbox</div>} />
          <Route path="/dashboard/profile" element={<div>Profile editor</div>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  localStorage.clear();
  getMe.mockReset();
  getPublicAccountantProfile.mockReset();
  listMyInquiries.mockReset();
  getPublicAccountantProfile.mockResolvedValue(listed);
  listMyInquiries.mockResolvedValue([]);
});

test("shows name, firm, and location instead of email", async () => {
  renderProfile();
  expect(await screen.findByText("Ada Lovelace")).toBeInTheDocument();
  expect(screen.getByText("Lovelace Tax · Remote")).toBeInTheDocument();
  expect(screen.queryByText("ada@test.com")).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "← Back to accountants" })).toHaveAttribute(
    "href",
    "/accountants"
  );
});

test("shows Message Accountant and never Go to inbox", async () => {
  renderProfile();
  expect(await screen.findByText("Ada Lovelace")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Message Accountant" })).toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "Go to inbox" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Go to inbox" })).not.toBeInTheDocument();
});

test("shows Continue Conversation when an open inquiry exists", async () => {
  localStorage.setItem(ACCESS_TOKEN_KEY, "token");
  getMe.mockResolvedValue({
    id: 99,
    email: "client@test.com",
    first_name: "Ann",
    last_name: "Client",
    has_accountant_profile: false,
    accountant_profile_complete: false,
  });
  listMyInquiries.mockResolvedValue([
    {
      id: 44,
      status: "open",
      created_at: "2026-08-20T12:00:00Z",
      client: 99,
      accountant: 12,
      accountant_name: "ada@test.com",
      service_title: null,
    },
  ]);
  renderProfile();
  expect(
    await screen.findByRole("button", { name: "Continue Conversation" })
  ).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Message Accountant" })).not.toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "Go to inbox" })).not.toBeInTheDocument();

  userEvent.click(screen.getByRole("button", { name: "Continue Conversation" }));
  await waitFor(() => {
    expect(screen.getByText("Chat thread")).toBeInTheDocument();
  });
});

test("owner can optionally open the profile editor", async () => {
  localStorage.setItem(ACCESS_TOKEN_KEY, "token");
  getMe.mockResolvedValue({
    id: 12,
    email: "ada@test.com",
    first_name: "Ada",
    last_name: "Lovelace",
    has_accountant_profile: true,
    accountant_profile_complete: true,
  });
  renderProfile();
  expect(await screen.findByRole("link", { name: "Edit profile" })).toHaveAttribute(
    "href",
    "/dashboard/profile"
  );
  expect(screen.queryByRole("button", { name: "Message Accountant" })).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Continue Conversation" })
  ).not.toBeInTheDocument();
});

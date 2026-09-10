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
  headline: "Friendly tax help",
  languages: ["English"],
  offers_remote: true,
  offers_in_person: false,
  industries: ["Individuals"],
  website: "https://ada.example",
  license_information: "EA #9",
  services: [
    {
      id: 3,
      name: "Individual Tax Services",
      description: "1040s",
      pricing_type: "consultation_required",
      consultation_fee: "0",
      category: { id: 1, name: "Individual Tax Services", slug: "individual-tax-services" },
    },
  ],
  publication_status: "published",
  is_publish_ready: true,
  is_public: true,
  profile_complete: true,
};

function renderProfile(initialPath = "/accountants/12") {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <AuthProvider>
        <Routes>
          <Route path="/accountants/:userId" element={<AccountantProfilePage />} />
          <Route path="/accountants" element={<div>Directory page</div>} />
          <Route path="/dashboard/accountant" element={<div>Accountant dashboard</div>} />
          <Route
            path="/onboarding/accountant/preview"
            element={<div>Preview editor</div>}
          />
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

test("from=dashboard shows back to accountant dashboard", async () => {
  renderProfile("/accountants/12?from=dashboard");
  expect(await screen.findByText("Ada Lovelace")).toBeInTheDocument();
  expect(
    screen.getByRole("link", { name: "← Back to accountant dashboard" })
  ).toHaveAttribute("href", "/dashboard/accountant");
  expect(screen.queryByRole("link", { name: "← Back to accountants" })).not.toBeInTheDocument();
});

test("from=profile-editor shows back to profile editor", async () => {
  renderProfile("/accountants/12?from=profile-editor");
  expect(await screen.findByText("Ada Lovelace")).toBeInTheDocument();
  expect(
    screen.getByRole("link", { name: "← Back to profile editor" })
  ).toHaveAttribute("href", "/onboarding/accountant/preview");
});

test("unknown from falls back to Back to accountants", async () => {
  renderProfile("/accountants/12?from=somewhere-else");
  expect(await screen.findByText("Ada Lovelace")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "← Back to accountants" })).toHaveAttribute(
    "href",
    "/accountants"
  );
});

test("profile body content is unchanged across entry contexts", async () => {
  const { unmount } = renderProfile("/accountants/12?from=dashboard");
  expect(await screen.findByText("Ada Lovelace")).toBeInTheDocument();
  expect(screen.getByText("Friendly tax help")).toBeInTheDocument();
  expect(screen.getByText("1040s")).toBeInTheDocument();
  expect(screen.getByText("AL")).toBeInTheDocument();
  unmount();

  renderProfile("/accountants/12");
  expect(await screen.findByText("Ada Lovelace")).toBeInTheDocument();
  expect(screen.getByText("Friendly tax help")).toBeInTheDocument();
  expect(screen.getByText("1040s")).toBeInTheDocument();
  expect(screen.getByText("AL")).toBeInTheDocument();
});

test("reuses presentation fields on the public profile route", async () => {
  renderProfile();
  expect(await screen.findByText("Friendly tax help")).toBeInTheDocument();
  expect(screen.getByText("English")).toBeInTheDocument();
  expect(screen.getAllByText("Remote").length).toBeGreaterThan(0);
  expect(screen.getByText("Individuals")).toBeInTheDocument();
  expect(screen.getByText("EA #9")).toBeInTheDocument();
  expect(screen.getByText("1040s")).toBeInTheDocument();
  expect(screen.getByText("AL")).toBeInTheDocument();
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
    "/onboarding/accountant/basic"
  );
  expect(screen.queryByRole("button", { name: "Message Accountant" })).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Continue Conversation" })
  ).not.toBeInTheDocument();
});

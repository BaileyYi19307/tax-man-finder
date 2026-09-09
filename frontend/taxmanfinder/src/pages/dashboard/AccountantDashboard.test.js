import { MemoryRouter } from "react-router-dom";
import { render, screen, waitFor } from "@testing-library/react";
import { AuthProvider } from "../../auth/AuthProvider";
import AccountantDashboard from "./AccountantDashboard";
import {
  getMe,
  getMyAccountantProfile,
  listMyBookings,
  listMyInquiries,
} from "../../api/client";
import { ACCESS_TOKEN_KEY, USER_ID_KEY } from "../../auth/session";

jest.mock("../../api/client", () => ({
  getMe: jest.fn(),
  getMyAccountantProfile: jest.fn(),
  listMyBookings: jest.fn(async () => []),
  listMyInquiries: jest.fn(),
  publishMyAccountantProfile: jest.fn(),
  unpublishMyAccountantProfile: jest.fn(),
  apiFieldError: jest.requireActual("../../api/client").apiFieldError,
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
  getMyAccountantProfile.mockReset();
  listMyBookings.mockReset();
  listMyInquiries.mockReset();
  listMyBookings.mockResolvedValue([]);
  getMyAccountantProfile.mockResolvedValue({
    user_id: 22,
    email: "pro@test.com",
    first_name: "Pat",
    last_name: "Pro",
    bio: "Helps with taxes",
    credentials: "CPA",
    years_experience: 5,
    firm_name: "Pro Tax",
    location: "Austin, TX",
    services: [],
    publication_status: "draft",
    is_publish_ready: true,
    is_public: false,
    profile_complete: true,
    publish_readiness_errors: {},
  });
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

test("separate Continue setup / My profile dashboard card is removed", async () => {
  localStorage.setItem(ACCESS_TOKEN_KEY, "token");
  localStorage.setItem(USER_ID_KEY, "22");
  listMyInquiries.mockResolvedValue([]);
  renderDashboard();

  expect(
    await screen.findByRole("link", { name: "Preview and publish" })
  ).toBeInTheDocument();
  expect(screen.queryByText("My profile")).not.toBeInTheDocument();
  expect(
    screen.queryByRole("link", { name: "Continue profile setup" })
  ).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Preview and publish" }).closest("section")).toHaveAttribute(
    "aria-label",
    "Profile visibility"
  );
  expect(screen.getByText("My Services")).toBeInTheDocument();
  expect(screen.getByText("Inbox")).toBeInTheDocument();
  expect(screen.getByText("Consultations")).toBeInTheDocument();
});

test("incomplete draft shows Continue profile setup inside Profile Visibility", async () => {
  localStorage.setItem(ACCESS_TOKEN_KEY, "token");
  localStorage.setItem(USER_ID_KEY, "22");
  getMe.mockResolvedValue({
    id: 22,
    email: "pro@test.com",
    first_name: "Pat",
    last_name: "Pro",
    has_accountant_profile: true,
    accountant_profile_complete: false,
  });
  getMyAccountantProfile.mockResolvedValue({
    user_id: 22,
    email: "pro@test.com",
    first_name: "Pat",
    last_name: "Pro",
    bio: "",
    credentials: "",
    years_experience: 0,
    firm_name: "",
    location: "",
    services: [],
    publication_status: "draft",
    is_publish_ready: false,
    is_public: false,
    profile_complete: false,
    publish_readiness_errors: {
      bio: ["Add a bio."],
    },
  });
  listMyInquiries.mockResolvedValue([]);
  renderDashboard();

  expect(
    await screen.findByRole("link", { name: "Continue profile setup" })
  ).toHaveAttribute("href", "/onboarding/accountant/basic");
  expect(screen.getByText("Profile visibility")).toBeInTheDocument();
});

test("dashboard includes profile visibility controls", async () => {
  localStorage.setItem(ACCESS_TOKEN_KEY, "token");
  localStorage.setItem(USER_ID_KEY, "22");
  listMyInquiries.mockResolvedValue([]);
  renderDashboard();

  expect(await screen.findByText("Profile visibility")).toBeInTheDocument();
  expect(
    await screen.findByText("Your profile is ready to publish.")
  ).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Preview and publish" })).toHaveAttribute(
    "href",
    "/onboarding/accountant/preview"
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

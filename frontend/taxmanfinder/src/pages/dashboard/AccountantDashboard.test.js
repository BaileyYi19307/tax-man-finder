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

test("incomplete draft shows continue profile setup action", async () => {
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

  expect(await screen.findByText("Continue profile setup")).toBeInTheDocument();
  expect(screen.getByText("Continue profile setup").closest("a")).toHaveAttribute(
    "href",
    "/onboarding/accountant/basic"
  );
  expect(await screen.findByText("Profile visibility")).toBeInTheDocument();
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

import { MemoryRouter, Navigate, Route, Routes } from "react-router-dom";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthProvider } from "../../auth/AuthProvider";
import BasicProfileStep from "./BasicProfileStep";
import {
  createAccountantProfile,
  getMe,
  getMyAccountantProfile,
} from "../../api/client";
import { ACCESS_TOKEN_KEY } from "../../auth/session";
import { ACCOUNTANT_ONBOARDING_ENTRY } from "./onboardingSteps";

jest.mock("../../api/client", () => ({
  getMe: jest.fn(),
  getMyAccountantProfile: jest.fn(),
  createAccountantProfile: jest.fn(),
  apiFieldError: jest.requireActual("../../api/client").apiFieldError,
}));

const me = {
  id: 9,
  email: "newpro@test.com",
  first_name: "Ada",
  last_name: "",
  has_accountant_profile: false,
  accountant_profile_complete: false,
};

function draftProfile(overrides = {}) {
  return {
    user_id: 9,
    email: "newpro@test.com",
    first_name: "Ada",
    last_name: "Lovelace",
    bio: "Helps founders with taxes",
    credentials: "",
    years_experience: 0,
    firm_name: "",
    location: "Austin, TX",
    headline: "Startup tax help",
    services: [],
    publication_status: "draft",
    is_publish_ready: false,
    is_public: false,
    profile_complete: false,
    publish_readiness_errors: {
      credentials: ["Add credentials to publish."],
    },
    ...overrides,
  };
}

function renderBasic(initialPath = "/onboarding/accountant/basic") {
  localStorage.setItem(ACCESS_TOKEN_KEY, "token");
  getMe.mockResolvedValue(me);
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <AuthProvider>
        <Routes>
          <Route path="/onboarding/accountant/basic" element={<BasicProfileStep />} />
          <Route
            path="/onboarding/accountant/professional"
            element={<div>Professional details step</div>}
          />
          <Route path="/dashboard/accountant" element={<div>Accountant dash</div>} />
          <Route path="/signup" element={<div>Signup</div>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  );
}

function renderWithLegacyRedirect() {
  localStorage.setItem(ACCESS_TOKEN_KEY, "token");
  getMe.mockResolvedValue(me);
  getMyAccountantProfile.mockResolvedValue(null);
  return render(
    <MemoryRouter initialEntries={["/onboarding/accountant"]}>
      <AuthProvider>
        <Routes>
          <Route
            path="/onboarding/accountant"
            element={<Navigate to={ACCOUNTANT_ONBOARDING_ENTRY} replace />}
          />
          <Route path="/onboarding/accountant/basic" element={<BasicProfileStep />} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  localStorage.clear();
  getMe.mockReset();
  getMyAccountantProfile.mockReset();
  createAccountantProfile.mockReset();
});

test("wizard shell shows progress steps with basic profile active", async () => {
  getMyAccountantProfile.mockResolvedValue(null);
  renderBasic();

  expect(await screen.findByRole("button", { name: "Save and continue" })).toBeInTheDocument();
  expect(screen.getByLabelText("Onboarding progress")).toBeInTheDocument();
  expect(screen.getByText("1. Basic profile")).toHaveAttribute("aria-current", "step");
  expect(screen.getByRole("link", { name: "Professional details" })).toHaveAttribute(
    "href",
    "/onboarding/accountant/professional"
  );
  expect(screen.getByText("3. Services").closest("a")).toHaveAttribute(
    "href",
    "/onboarding/accountant/services"
  );
  expect(screen.getByText("4. Preview").closest("a")).toHaveAttribute(
    "href",
    "/onboarding/accountant/preview"
  );
  expect(screen.getByRole("button", { name: "Save and exit" })).toBeInTheDocument();
});

test("existing /onboarding/accountant redirects to basic profile step", async () => {
  renderWithLegacyRedirect();
  expect(await screen.findByLabelText("First name")).toBeInTheDocument();
  expect(screen.getByText("1. Basic profile")).toHaveAttribute("aria-current", "step");
});

test("prefills form from existing draft profile", async () => {
  getMyAccountantProfile.mockResolvedValue(draftProfile());
  renderBasic();

  expect(await screen.findByDisplayValue("Ada")).toBeInTheDocument();
  expect(screen.getByDisplayValue("Lovelace")).toBeInTheDocument();
  expect(screen.getByDisplayValue("Startup tax help")).toBeInTheDocument();
  expect(screen.getByDisplayValue("Helps founders with taxes")).toBeInTheDocument();
  expect(screen.getByDisplayValue("Austin, TX")).toBeInTheDocument();
  expect(screen.getByText("AL")).toBeInTheDocument();
});

test("creates a first profile from an empty draft", async () => {
  getMyAccountantProfile.mockResolvedValue(null);
  createAccountantProfile.mockResolvedValue(
    draftProfile({ first_name: "Ada", last_name: "Lovelace", bio: "New bio" })
  );
  renderBasic();

  expect(await screen.findByLabelText("First name")).toBeInTheDocument();
  userEvent.clear(screen.getByLabelText("First name"));
  userEvent.type(screen.getByLabelText("First name"), "Ada");
  userEvent.type(screen.getByLabelText("Last name"), "Lovelace");
  userEvent.type(screen.getByLabelText("Bio"), "New bio");
  userEvent.type(screen.getByLabelText(/Location \(city\/state\)/), "Austin, TX");

  userEvent.click(screen.getByRole("button", { name: "Save and continue" }));

  await waitFor(() => expect(createAccountantProfile).toHaveBeenCalledTimes(1));
  expect(createAccountantProfile).toHaveBeenCalledWith({
    first_name: "Ada",
    last_name: "Lovelace",
    bio: "New bio",
    location: "Austin, TX",
    headline: "",
  });
  expect(await screen.findByText("Professional details step")).toBeInTheDocument();
  expect(screen.queryByText("Accountant dash")).not.toBeInTheDocument();
});

test("partial draft save omits blank names and updates existing draft", async () => {
  getMyAccountantProfile.mockResolvedValue(
    draftProfile({ first_name: "Ada", last_name: "Lovelace", bio: "Old", location: "" })
  );
  createAccountantProfile.mockResolvedValue(
    draftProfile({ bio: "Updated bio", location: "Denver, CO", headline: "" })
  );
  renderBasic();

  expect(await screen.findByDisplayValue("Old")).toBeInTheDocument();
  userEvent.clear(screen.getByLabelText("First name"));
  userEvent.clear(screen.getByLabelText("Last name"));
  userEvent.clear(screen.getByLabelText("Bio"));
  userEvent.type(screen.getByLabelText("Bio"), "Updated bio");
  userEvent.type(screen.getByLabelText(/Location \(city\/state\)/), "Denver, CO");
  userEvent.clear(screen.getByLabelText(/Professional headline/));

  userEvent.click(screen.getByRole("button", { name: "Save and continue" }));

  await waitFor(() => expect(createAccountantProfile).toHaveBeenCalledTimes(1));
  expect(createAccountantProfile.mock.calls[0][0]).toEqual({
    bio: "Updated bio",
    location: "Denver, CO",
    headline: "",
  });
});

test("save pending disables buttons and prevents duplicate submissions", async () => {
  getMyAccountantProfile.mockResolvedValue(null);
  let resolveSave;
  createAccountantProfile.mockImplementation(
    () =>
      new Promise((resolve) => {
        resolveSave = resolve;
      })
  );
  renderBasic();

  expect(await screen.findByLabelText("First name")).toBeInTheDocument();
  userEvent.type(screen.getByLabelText("First name"), "Ada");
  userEvent.click(screen.getByRole("button", { name: "Save and exit" }));

  await waitFor(() => {
    const buttons = screen.getAllByRole("button", { name: "Saving…" });
    expect(buttons).toHaveLength(2);
    expect(buttons[0]).toBeDisabled();
    expect(buttons[1]).toBeDisabled();
  });
  userEvent.click(screen.getAllByRole("button", { name: "Saving…" })[0]);
  userEvent.click(screen.getAllByRole("button", { name: "Saving…" })[1]);
  expect(createAccountantProfile).toHaveBeenCalledTimes(1);

  await act(async () => {
    resolveSave(draftProfile());
  });
  expect(await screen.findByText("Accountant dash")).toBeInTheDocument();
});

test("shows field-level API errors", async () => {
  getMyAccountantProfile.mockResolvedValue(null);
  const err = new Error("First name cannot be blank.");
  err.fields = { first_name: "First name cannot be blank." };
  createAccountantProfile.mockRejectedValue(err);
  renderBasic();

  expect(await screen.findByLabelText("First name")).toBeInTheDocument();
  userEvent.click(screen.getByRole("button", { name: "Save and continue" }));

  expect(await screen.findByRole("alert")).toHaveTextContent(
    "First name cannot be blank."
  );
  expect(screen.getByLabelText("First name")).toHaveAttribute("aria-invalid", "true");
});

test("load failure shows retryable error", async () => {
  getMyAccountantProfile.mockRejectedValue(new Error("network"));
  renderBasic();

  expect(
    await screen.findByText(/Could not load your profile draft/i)
  ).toBeInTheDocument();
  getMyAccountantProfile.mockResolvedValue(draftProfile());
  userEvent.click(screen.getByRole("button", { name: "Retry" }));
  expect(await screen.findByDisplayValue("Startup tax help")).toBeInTheDocument();
});

test("save and exit navigates to accountant dashboard", async () => {
  getMyAccountantProfile.mockResolvedValue(null);
  createAccountantProfile.mockResolvedValue(draftProfile());
  renderBasic();

  expect(await screen.findByLabelText("First name")).toBeInTheDocument();
  userEvent.type(screen.getByLabelText("First name"), "Ada");
  userEvent.click(screen.getByRole("button", { name: "Save and exit" }));

  expect(await screen.findByText("Accountant dash")).toBeInTheDocument();
  expect(createAccountantProfile).toHaveBeenCalledTimes(1);
});

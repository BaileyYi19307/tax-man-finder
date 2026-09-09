import { MemoryRouter, Route, Routes } from "react-router-dom";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthProvider } from "../../auth/AuthProvider";
import ProfessionalDetailsStep from "./ProfessionalDetailsStep";
import BasicProfileStep from "./BasicProfileStep";
import {
  createAccountantProfile,
  getMe,
  getMyAccountantProfile,
} from "../../api/client";
import { ACCESS_TOKEN_KEY } from "../../auth/session";

jest.mock("../../api/client", () => ({
  getMe: jest.fn(),
  getMyAccountantProfile: jest.fn(),
  createAccountantProfile: jest.fn(),
  apiFieldError: jest.requireActual("../../api/client").apiFieldError,
}));

const me = {
  id: 9,
  email: "pro@test.com",
  first_name: "Ada",
  last_name: "Lovelace",
  has_accountant_profile: true,
  accountant_profile_complete: false,
};

function draftProfile(overrides = {}) {
  return {
    user_id: 9,
    email: "pro@test.com",
    first_name: "Ada",
    last_name: "Lovelace",
    bio: "Helps founders",
    credentials: "CPA",
    years_experience: 5,
    firm_name: "Lovelace Tax",
    location: "Austin, TX",
    headline: "Startup tax",
    languages: ["English", "Spanish"],
    offers_remote: true,
    offers_in_person: false,
    industries: ["Startups"],
    website: "https://example.com",
    license_information: "TX CPA",
    services: [],
    publication_status: "draft",
    is_publish_ready: false,
    is_public: false,
    profile_complete: false,
    publish_readiness_errors: {},
    ...overrides,
  };
}

function renderProfessional() {
  localStorage.setItem(ACCESS_TOKEN_KEY, "token");
  getMe.mockResolvedValue(me);
  return render(
    <MemoryRouter initialEntries={["/onboarding/accountant/professional"]}>
      <AuthProvider>
        <Routes>
          <Route path="/onboarding/accountant/basic" element={<BasicProfileStep />} />
          <Route
            path="/onboarding/accountant/professional"
            element={<ProfessionalDetailsStep />}
          />
          <Route path="/dashboard/accountant" element={<div>Accountant dash</div>} />
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

test("route shows professional details as the active wizard step", async () => {
  getMyAccountantProfile.mockResolvedValue(draftProfile());
  renderProfessional();

  expect(await screen.findByLabelText("Credentials")).toBeInTheDocument();
  expect(screen.getByText("2. Professional details")).toHaveAttribute(
    "aria-current",
    "step"
  );
  expect(screen.getByText("1. Basic profile").closest("a")).toHaveAttribute(
    "href",
    "/onboarding/accountant/basic"
  );
  expect(screen.getByText("3. Services").closest("a")).toBeNull();
  expect(screen.getByText("4. Preview").closest("a")).toBeNull();
  expect(
    screen.getByText(/Credentials, at least one language, and remote or in-person availability are required before publishing/i)
  ).toBeInTheDocument();
});

test("prefills existing professional details", async () => {
  getMyAccountantProfile.mockResolvedValue(draftProfile());
  renderProfessional();

  expect(await screen.findByDisplayValue("CPA")).toBeInTheDocument();
  expect(screen.getByDisplayValue("5")).toBeInTheDocument();
  expect(screen.getByText("English")).toBeInTheDocument();
  expect(screen.getByText("Spanish")).toBeInTheDocument();
  expect(screen.getByLabelText("Remote")).toBeChecked();
  expect(screen.getByLabelText("In person")).not.toBeChecked();
  expect(screen.getByText("Startups")).toBeInTheDocument();
  expect(screen.getByDisplayValue("https://example.com")).toBeInTheDocument();
  expect(screen.getByDisplayValue("TX CPA")).toBeInTheDocument();
  expect(screen.getByDisplayValue("Lovelace Tax")).toBeInTheDocument();
});

test("partial draft save sends professional fields without blocking empty availability", async () => {
  getMyAccountantProfile.mockResolvedValue(
    draftProfile({
      credentials: "",
      languages: [],
      offers_remote: false,
      offers_in_person: false,
      industries: [],
      website: "",
      license_information: "",
      firm_name: "",
      years_experience: 0,
    })
  );
  createAccountantProfile.mockResolvedValue(draftProfile({ credentials: "EA" }));
  renderProfessional();

  expect(await screen.findByLabelText("Credentials")).toBeInTheDocument();
  userEvent.type(screen.getByLabelText("Credentials"), "EA");
  userEvent.click(screen.getByRole("button", { name: "Save and continue" }));

  await waitFor(() => expect(createAccountantProfile).toHaveBeenCalledTimes(1));
  expect(createAccountantProfile).toHaveBeenCalledWith({
    credentials: "EA",
    years_experience: 0,
    languages: [],
    offers_remote: false,
    offers_in_person: false,
    industries: [],
    website: "",
    license_information: "",
    firm_name: "",
  });
  expect(await screen.findByText(/Services setup coming next/i)).toBeInTheDocument();
});

test("languages support add, remove, and case-insensitive deduplication", async () => {
  getMyAccountantProfile.mockResolvedValue(
    draftProfile({ languages: ["English"], industries: [] })
  );
  createAccountantProfile.mockResolvedValue(draftProfile());
  renderProfessional();

  expect(await screen.findByText("English")).toBeInTheDocument();
  const languagesInput = screen.getByRole("textbox", { name: "Languages" });
  userEvent.type(languagesInput, "spanish");
  userEvent.click(screen.getByRole("button", { name: "Add Languages" }));
  expect(await screen.findByText("spanish")).toBeInTheDocument();

  userEvent.type(languagesInput, "Spanish");
  userEvent.click(screen.getByRole("button", { name: "Add Languages" }));
  expect(screen.getAllByText(/^spanish$/i)).toHaveLength(1);

  userEvent.click(screen.getByRole("button", { name: "Remove spanish" }));
  await waitFor(() => {
    expect(screen.queryByText("spanish")).not.toBeInTheDocument();
  });

  userEvent.click(screen.getByRole("button", { name: "Save and continue" }));
  await waitFor(() => expect(createAccountantProfile).toHaveBeenCalled());
  expect(createAccountantProfile.mock.calls[0][0].languages).toEqual(["English"]);
});

test("optional industries are included when provided", async () => {
  getMyAccountantProfile.mockResolvedValue(draftProfile({ industries: [] }));
  createAccountantProfile.mockResolvedValue(draftProfile({ industries: ["Freelancers"] }));
  renderProfessional();

  const industriesInput = await screen.findByRole("textbox", {
    name: /Industries \/ client types/i,
  });
  userEvent.type(industriesInput, "Freelancers");
  userEvent.click(
    screen.getByRole("button", { name: "Add Industries / client types" })
  );
  expect(await screen.findByText("Freelancers")).toBeInTheDocument();
  userEvent.click(screen.getByRole("button", { name: "Save and continue" }));

  await waitFor(() => expect(createAccountantProfile).toHaveBeenCalled());
  expect(createAccountantProfile.mock.calls[0][0].industries).toEqual(["Freelancers"]);
});

test("availability checkboxes are independent", async () => {
  getMyAccountantProfile.mockResolvedValue(
    draftProfile({ offers_remote: false, offers_in_person: false })
  );
  createAccountantProfile.mockResolvedValue(draftProfile());
  renderProfessional();

  expect(await screen.findByLabelText("Remote")).not.toBeChecked();
  userEvent.click(screen.getByLabelText("Remote"));
  userEvent.click(screen.getByLabelText("In person"));
  expect(screen.getByLabelText("Remote")).toBeChecked();
  expect(screen.getByLabelText("In person")).toBeChecked();

  userEvent.click(screen.getByLabelText("Remote"));
  expect(screen.getByLabelText("Remote")).not.toBeChecked();
  expect(screen.getByLabelText("In person")).toBeChecked();

  userEvent.click(screen.getByRole("button", { name: "Save and continue" }));
  await waitFor(() => expect(createAccountantProfile).toHaveBeenCalled());
  expect(createAccountantProfile.mock.calls[0][0].offers_remote).toBe(false);
  expect(createAccountantProfile.mock.calls[0][0].offers_in_person).toBe(true);
});

test("years of experience rejects invalid values without calling the API", async () => {
  getMyAccountantProfile.mockResolvedValue(draftProfile({ years_experience: 1 }));
  renderProfessional();

  expect(await screen.findByLabelText(/Years of experience/i)).toBeInTheDocument();
  userEvent.clear(screen.getByLabelText(/Years of experience/i));
  userEvent.type(screen.getByLabelText(/Years of experience/i), "-2");
  userEvent.click(screen.getByRole("button", { name: "Save and continue" }));

  expect(
    await screen.findByRole("alert")
  ).toHaveTextContent(/non-negative whole number/i);
  expect(createAccountantProfile).not.toHaveBeenCalled();
});

test("shows website API validation errors", async () => {
  getMyAccountantProfile.mockResolvedValue(draftProfile({ website: "" }));
  const err = new Error("Enter a valid URL.");
  err.fields = { website: "Enter a valid URL." };
  createAccountantProfile.mockRejectedValue(err);
  renderProfessional();

  expect(await screen.findByLabelText(/Website/i)).toBeInTheDocument();
  userEvent.type(screen.getByLabelText(/Website/i), "not-a-url");
  userEvent.click(screen.getByRole("button", { name: "Save and continue" }));

  expect(await screen.findByRole("alert")).toHaveTextContent("Enter a valid URL.");
  expect(screen.getByLabelText(/Website/i)).toHaveAttribute("aria-invalid", "true");
});

test("Back navigates to Basic Profile", async () => {
  getMyAccountantProfile.mockResolvedValue(draftProfile());
  renderProfessional();

  expect(await screen.findByRole("button", { name: "Back" })).toBeInTheDocument();
  userEvent.click(screen.getByRole("button", { name: "Back" }));
  expect(await screen.findByLabelText("First name")).toBeInTheDocument();
});

test("Save and exit goes to the accountant dashboard", async () => {
  getMyAccountantProfile.mockResolvedValue(draftProfile());
  createAccountantProfile.mockResolvedValue(draftProfile());
  renderProfessional();

  expect(await screen.findByRole("button", { name: "Save and exit" })).toBeInTheDocument();
  userEvent.click(screen.getByRole("button", { name: "Save and exit" }));
  expect(await screen.findByText("Accountant dash")).toBeInTheDocument();
  expect(createAccountantProfile).toHaveBeenCalledTimes(1);
});

test("pending save disables controls and prevents duplicate submissions", async () => {
  getMyAccountantProfile.mockResolvedValue(draftProfile());
  let resolveSave;
  createAccountantProfile.mockImplementation(
    () =>
      new Promise((resolve) => {
        resolveSave = resolve;
      })
  );
  renderProfessional();

  expect(await screen.findByRole("button", { name: "Save and continue" })).toBeInTheDocument();
  userEvent.click(screen.getByRole("button", { name: "Save and continue" }));

  await waitFor(() => {
    const buttons = screen.getAllByRole("button", { name: "Saving…" });
    expect(buttons.length).toBeGreaterThanOrEqual(2);
    buttons.forEach((button) => expect(button).toBeDisabled());
  });
  userEvent.click(screen.getAllByRole("button", { name: "Saving…" })[0]);
  expect(createAccountantProfile).toHaveBeenCalledTimes(1);

  await act(async () => {
    resolveSave(draftProfile());
  });
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Save and continue" })).not.toBeDisabled()
  );
});

test("load failure shows retryable error", async () => {
  getMyAccountantProfile.mockRejectedValue(new Error("network"));
  renderProfessional();

  expect(
    await screen.findByText(/Could not load your profile draft/i)
  ).toBeInTheDocument();
  getMyAccountantProfile.mockResolvedValue(draftProfile());
  userEvent.click(screen.getByRole("button", { name: "Retry" }));
  expect(await screen.findByDisplayValue("CPA")).toBeInTheDocument();
});

test("navigation from Basic Profile lands on Professional Details", async () => {
  localStorage.setItem(ACCESS_TOKEN_KEY, "token");
  getMe.mockResolvedValue(me);
  getMyAccountantProfile.mockResolvedValue(draftProfile());
  createAccountantProfile.mockResolvedValue(draftProfile());

  render(
    <MemoryRouter initialEntries={["/onboarding/accountant/basic"]}>
      <AuthProvider>
        <Routes>
          <Route path="/onboarding/accountant/basic" element={<BasicProfileStep />} />
          <Route
            path="/onboarding/accountant/professional"
            element={<ProfessionalDetailsStep />}
          />
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  );

  expect(await screen.findByRole("button", { name: "Save and continue" })).toBeInTheDocument();
  userEvent.click(screen.getByRole("button", { name: "Save and continue" }));
  expect(await screen.findByLabelText("Credentials")).toBeInTheDocument();
  expect(screen.getByText("2. Professional details")).toHaveAttribute(
    "aria-current",
    "step"
  );
});

import { MemoryRouter, Route, Routes } from "react-router-dom";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthProvider } from "../../auth/AuthProvider";
import AccountantProfileEdit from "./AccountantProfileEdit";
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
}));

const profile = {
  user_id: 22,
  email: "pro@test.com",
  first_name: "Pat",
  last_name: "Pro",
  bio: "Helps with taxes",
  credentials: "CPA",
  years_experience: 5,
  firm_name: "Pro Tax",
  location: "Boston, MA",
  headline: "Tax help for founders",
  languages: ["English", "Spanish"],
  offers_remote: true,
  offers_in_person: false,
  industries: ["Startups"],
  website: "https://protax.example",
  license_information: "MA CPA #1",
  services: [{ id: 3, name: "Individual returns" }],
  publication_status: "published",
  is_publish_ready: true,
  is_public: true,
  profile_complete: true,
  publish_readiness_errors: {},
};

const me = {
  id: 22,
  email: "pro@test.com",
  first_name: "Pat",
  last_name: "Pro",
  has_accountant_profile: true,
  accountant_profile_complete: true,
};

function renderPage() {
  localStorage.setItem(ACCESS_TOKEN_KEY, "token");
  getMe.mockResolvedValue(me);
  return render(
    <MemoryRouter initialEntries={["/dashboard/profile"]}>
      <AuthProvider>
        <Routes>
          <Route path="/dashboard/profile" element={<AccountantProfileEdit />} />
          <Route path="/dashboard/accountant" element={<div>Accountant dash</div>} />
          <Route path="/onboarding/accountant" element={<div>Onboarding page</div>} />
          <Route path="/accountants/:userId" element={<div>Public profile</div>} />
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

test("loads current profile fields and links to the public listing", async () => {
  getMyAccountantProfile.mockResolvedValue(profile);
  renderPage();

  expect(await screen.findByDisplayValue("Pat")).toBeInTheDocument();
  expect(screen.getByDisplayValue("Pro")).toBeInTheDocument();
  expect(screen.getByDisplayValue("Pro Tax")).toBeInTheDocument();
  expect(screen.getByDisplayValue("Boston, MA")).toBeInTheDocument();
  expect(screen.getByDisplayValue("Helps with taxes")).toBeInTheDocument();
  expect(screen.getByDisplayValue("Tax help for founders")).toBeInTheDocument();
  expect(screen.getByText("English")).toBeInTheDocument();
  expect(screen.getByText("Spanish")).toBeInTheDocument();
  expect(screen.getByRole("checkbox", { name: "Remote" })).toBeChecked();
  expect(screen.getByRole("checkbox", { name: "In person" })).not.toBeChecked();
  expect(screen.getByText("Startups")).toBeInTheDocument();
  expect(screen.getByDisplayValue("https://protax.example")).toBeInTheDocument();
  expect(screen.getByDisplayValue("MA CPA #1")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Cancel and view public profile" })).toHaveAttribute(
    "href",
    "/accountants/22"
  );
  expect(screen.getByRole("link", { name: "← Dashboard" })).toHaveAttribute(
    "href",
    "/dashboard/accountant"
  );
});

test("saving updates the profile and opens the public listing", async () => {
  getMyAccountantProfile.mockResolvedValue(profile);
  createAccountantProfile.mockResolvedValue({
    ...profile,
    bio: "Updated bio.",
  });
  renderPage();

  const bio = await screen.findByDisplayValue("Helps with taxes");
  userEvent.clear(bio);
  userEvent.type(bio, "Updated bio.");
  userEvent.click(screen.getByRole("button", { name: "Save profile" }));

  await waitFor(() => {
    expect(createAccountantProfile).toHaveBeenCalledTimes(1);
  });
  expect(createAccountantProfile).toHaveBeenCalledWith(
    expect.objectContaining({
      first_name: "Pat",
      last_name: "Pro",
      bio: "Updated bio.",
      credentials: "CPA",
      firm_name: "Pro Tax",
      location: "Boston, MA",
      headline: "Tax help for founders",
      languages: ["English", "Spanish"],
      offers_remote: true,
      offers_in_person: false,
      industries: ["Startups"],
      website: "https://protax.example",
      license_information: "MA CPA #1",
      service_scope: "local",
    })
  );
  expect(createAccountantProfile.mock.calls[0][0].service_name).toBeUndefined();
  expect(await screen.findByText("Public profile")).toBeInTheDocument();
});

test("edit form exposes all new professional fields for save", async () => {
  getMyAccountantProfile.mockResolvedValue({
    ...profile,
    headline: "",
    languages: [],
    offers_remote: false,
    offers_in_person: false,
    industries: [],
    website: "",
    license_information: "",
  });
  createAccountantProfile.mockResolvedValue(profile);
  renderPage();

  expect(await screen.findByLabelText("Headline")).toBeInTheDocument();
  userEvent.type(screen.getByLabelText("Headline"), "New headline");
  const languagesInput = screen.getByRole("textbox", { name: "Languages" });
  userEvent.type(languagesInput, "French");
  userEvent.click(screen.getByRole("button", { name: "Add Languages" }));
  userEvent.click(screen.getByRole("checkbox", { name: "Remote" }));
  const industriesInput = screen.getByRole("textbox", {
    name: "Industries / client types",
  });
  userEvent.type(industriesInput, "Nonprofits");
  userEvent.click(screen.getByRole("button", { name: "Add Industries / client types" }));
  userEvent.type(screen.getByLabelText("Website"), "https://new.example");
  userEvent.type(screen.getByLabelText("License information"), "EA #2");
  userEvent.click(screen.getByRole("button", { name: "Save profile" }));

  await waitFor(() => {
    expect(createAccountantProfile).toHaveBeenCalledTimes(1);
  });
  expect(createAccountantProfile).toHaveBeenCalledWith(
    expect.objectContaining({
      headline: "New headline",
      languages: ["French"],
      offers_remote: true,
      industries: ["Nonprofits"],
      website: "https://new.example",
      license_information: "EA #2",
    })
  );
});

test("missing profile resumes onboarding", async () => {
  getMyAccountantProfile.mockResolvedValue(null);
  renderPage();
  expect(await screen.findByText("Onboarding page")).toBeInTheDocument();
});

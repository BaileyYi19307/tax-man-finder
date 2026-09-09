import { MemoryRouter, Route, Routes } from "react-router-dom";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthProvider } from "../../auth/AuthProvider";
import PreviewOnboardingStep from "./PreviewOnboardingStep";
import ServicesOnboardingStep from "./ServicesOnboardingStep";
import {
  getMe,
  getMyAccountantPreview,
  getMyAccountantProfile,
  getMyServices,
  listServiceCategories,
  publishMyAccountantProfile,
} from "../../api/client";
import { ACCESS_TOKEN_KEY } from "../../auth/session";

jest.mock("../../api/client", () => ({
  getMe: jest.fn(),
  getMyAccountantPreview: jest.fn(),
  getMyAccountantProfile: jest.fn(),
  getMyServices: jest.fn(),
  listServiceCategories: jest.fn(),
  publishMyAccountantProfile: jest.fn(),
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

function previewProfile(overrides = {}) {
  return {
    user_id: 9,
    email: "pro@test.com",
    first_name: "Ada",
    last_name: "Lovelace",
    bio: "Helps founders with tax filings.",
    credentials: "CPA",
    years_experience: 5,
    firm_name: "Lovelace Tax",
    location: "Austin, TX",
    headline: "Startup tax help",
    languages: ["English", "Spanish"],
    offers_remote: true,
    offers_in_person: true,
    industries: ["Startups", "SaaS"],
    website: "https://example.com",
    license_information: "TX CPA #123",
    services: [
      {
        id: 7,
        name: "Primary offering",
        description: "Year-round tax support",
        pricing_type: "consultation_required",
        indicative_price: null,
        consultation_fee: "25.00",
        category: {
          id: 1,
          name: "Individual tax returns",
          slug: "individual-tax-returns",
        },
      },
    ],
    publication_status: "draft",
    is_publish_ready: true,
    is_public: false,
    profile_complete: true,
    publish_readiness_errors: {},
    ...overrides,
  };
}

function renderPreview(initialPath = "/onboarding/accountant/preview") {
  localStorage.setItem(ACCESS_TOKEN_KEY, "token");
  getMe.mockResolvedValue(me);
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <AuthProvider>
        <Routes>
          <Route
            path="/onboarding/accountant/basic"
            element={<div>Basic wizard step</div>}
          />
          <Route
            path="/onboarding/accountant/professional"
            element={<div>Professional step</div>}
          />
          <Route
            path="/onboarding/accountant/services"
            element={<ServicesOnboardingStep />}
          />
          <Route
            path="/onboarding/accountant/preview"
            element={<PreviewOnboardingStep />}
          />
          <Route path="/dashboard/accountant" element={<div>Accountant dash</div>} />
          <Route
            path="/accountants/:userId"
            element={<div>Customer public profile</div>}
          />
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  localStorage.clear();
  getMe.mockReset();
  getMyAccountantPreview.mockReset();
  getMyAccountantProfile.mockReset();
  getMyServices.mockReset();
  listServiceCategories.mockReset();
  publishMyAccountantProfile.mockReset();
  getMyAccountantPreview.mockResolvedValue(previewProfile());
  getMyAccountantProfile.mockResolvedValue(previewProfile());
  getMyServices.mockResolvedValue([]);
  listServiceCategories.mockResolvedValue([]);
});

test("loads owner draft preview with professional fields and active services", async () => {
  renderPreview();

  expect(await screen.findByText("Ada Lovelace")).toBeInTheDocument();
  expect(screen.getByText("Startup tax help")).toBeInTheDocument();
  expect(screen.getByText("CPA")).toBeInTheDocument();
  expect(screen.getByText("Austin, TX")).toBeInTheDocument();
  expect(screen.getByText("Remote · In person")).toBeInTheDocument();
  expect(screen.getByText("English, Spanish")).toBeInTheDocument();
  expect(screen.getByText("5 years experience")).toBeInTheDocument();
  expect(screen.getByText("Helps founders with tax filings.")).toBeInTheDocument();
  expect(screen.getByText("Startups, SaaS")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "https://example.com" })).toBeInTheDocument();
  expect(screen.getByText("TX CPA #123")).toBeInTheDocument();
  expect(screen.getByText("Primary offering")).toBeInTheDocument();
  expect(screen.getByText(/Year-round tax support/)).toBeInTheDocument();
  expect(screen.queryByText("pro@test.com")).not.toBeInTheDocument();
  expect(screen.getByText("4. Preview")).toHaveAttribute("aria-current", "step");
});

test("omits inactive services from presentation payload", async () => {
  getMyAccountantPreview.mockResolvedValue(
    previewProfile({
      services: [
        {
          id: 7,
          name: "Active only",
          description: "Shown",
          pricing_type: "fixed",
          indicative_price: "100.00",
          consultation_fee: "0",
          category: { id: 1, name: "Bookkeeping", slug: "bookkeeping" },
        },
      ],
    })
  );
  renderPreview();
  expect(await screen.findByText("Active only")).toBeInTheDocument();
  expect(screen.queryByText("Hidden books")).not.toBeInTheDocument();
});

test("shows readiness errors with links to the correct steps and disables Publish", async () => {
  getMyAccountantPreview.mockResolvedValue(
    previewProfile({
      is_publish_ready: false,
      profile_complete: false,
      publish_readiness_errors: {
        bio: ["Bio is required to publish."],
        credentials: ["Credentials are required to publish."],
        services: [
          "At least one active service with a valid public category is required to publish.",
        ],
      },
      services: [],
    })
  );
  renderPreview();

  expect(
    await screen.findByText(/Finish these requirements before publishing/i)
  ).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Fix in Basic Profile" })).toHaveAttribute(
    "href",
    "/onboarding/accountant/basic"
  );
  expect(
    screen.getByRole("link", { name: "Fix in Professional Details" })
  ).toHaveAttribute("href", "/onboarding/accountant/professional");
  expect(screen.getByRole("link", { name: "Fix in Services" })).toHaveAttribute(
    "href",
    "/onboarding/accountant/services"
  );
  expect(screen.getByRole("button", { name: "Publish profile" })).toBeDisabled();
});

test("Publish success shows live confirmation and customer view link from API user_id", async () => {
  publishMyAccountantProfile.mockResolvedValue(
    previewProfile({
      publication_status: "published",
      is_public: true,
      is_publish_ready: true,
      user_id: 42,
    })
  );
  renderPreview();

  expect(await screen.findByRole("button", { name: "Publish profile" })).toBeEnabled();
  userEvent.click(screen.getByRole("button", { name: "Publish profile" }));

  expect(await screen.findByText("Your profile is live")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "View as a customer" })).toHaveAttribute(
    "href",
    "/accountants/42"
  );
  expect(screen.getByRole("link", { name: "Go to dashboard" })).toHaveAttribute(
    "href",
    "/dashboard/accountant"
  );
  expect(screen.getByRole("link", { name: "Edit profile" })).toHaveAttribute(
    "href",
    "/onboarding/accountant/basic"
  );
});

test("Publish API failure shows error and keeps Publish available", async () => {
  const err = Object.assign(new Error("Bio is required to publish."), {
    fields: { bio: "Bio is required to publish." },
  });
  publishMyAccountantProfile.mockRejectedValue(err);
  renderPreview();

  expect(await screen.findByRole("button", { name: "Publish profile" })).toBeEnabled();
  userEvent.click(screen.getByRole("button", { name: "Publish profile" }));

  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Bio is required to publish."
  );
  expect(screen.getByRole("button", { name: "Publish profile" })).toBeEnabled();
});

test("prevents duplicate Publish submissions while in flight", async () => {
  let resolvePublish;
  publishMyAccountantProfile.mockImplementation(
    () =>
      new Promise((resolve) => {
        resolvePublish = resolve;
      })
  );
  renderPreview();

  const button = await screen.findByRole("button", { name: "Publish profile" });
  userEvent.click(button);
  userEvent.click(button);
  userEvent.click(button);

  expect(await screen.findByRole("button", { name: "Publishing…" })).toBeDisabled();
  expect(publishMyAccountantProfile).toHaveBeenCalledTimes(1);

  await act(async () => {
    resolvePublish(
      previewProfile({
        publication_status: "published",
        is_public: true,
      })
    );
  });
  expect(await screen.findByText("Your profile is live")).toBeInTheDocument();
});

test("Back goes to Services", async () => {
  renderPreview();
  expect(await screen.findByRole("button", { name: "Back" })).toBeInTheDocument();
  userEvent.click(screen.getByRole("button", { name: "Back" }));
  expect(
    await screen.findByText("List one or more services", { exact: false })
  ).toBeInTheDocument();
  expect(screen.getByText("3. Services")).toHaveAttribute("aria-current", "step");
});

test("Save and exit goes to the accountant dashboard", async () => {
  renderPreview();
  expect(await screen.findByRole("button", { name: "Save and exit" })).toBeInTheDocument();
  userEvent.click(screen.getByRole("button", { name: "Save and exit" }));
  expect(await screen.findByText("Accountant dash")).toBeInTheDocument();
});

test("wizard marks previous steps clickable and Preview active", async () => {
  renderPreview();
  expect(await screen.findByText("4. Preview")).toHaveAttribute("aria-current", "step");
  expect(screen.getByRole("link", { name: "1. Basic profile" })).toHaveAttribute(
    "href",
    "/onboarding/accountant/basic"
  );
  expect(screen.getByRole("link", { name: "2. Professional details" })).toHaveAttribute(
    "href",
    "/onboarding/accountant/professional"
  );
  expect(screen.getByRole("link", { name: "3. Services" })).toHaveAttribute(
    "href",
    "/onboarding/accountant/services"
  );
});

test("Edit profile from live confirmation navigates to the wizard", async () => {
  getMyAccountantPreview.mockResolvedValue(
    previewProfile({
      publication_status: "published",
      is_public: true,
    })
  );
  renderPreview();
  expect(await screen.findByText("Your profile is live")).toBeInTheDocument();
  userEvent.click(screen.getByRole("link", { name: "Edit profile" }));
  expect(await screen.findByText("Basic wizard step")).toBeInTheDocument();
});

test("View as a customer navigates to public profile route", async () => {
  getMyAccountantPreview.mockResolvedValue(
    previewProfile({
      publication_status: "published",
      is_public: true,
      user_id: 9,
    })
  );
  renderPreview();
  expect(await screen.findByText("Your profile is live")).toBeInTheDocument();
  userEvent.click(screen.getByRole("link", { name: "View as a customer" }));
  expect(await screen.findByText("Customer public profile")).toBeInTheDocument();
});

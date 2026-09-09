import { MemoryRouter, Route, Routes } from "react-router-dom";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthProvider } from "../../auth/AuthProvider";
import ServicesOnboardingStep from "./ServicesOnboardingStep";
import ProfessionalDetailsStep from "./ProfessionalDetailsStep";
import BasicProfileStep from "./BasicProfileStep";
import {
  createMyService,
  deactivateMyService,
  getMe,
  getMyAccountantProfile,
  getMyServices,
  listServiceCategories,
  updateMyService,
} from "../../api/client";
import { ACCESS_TOKEN_KEY } from "../../auth/session";

jest.mock("../../api/client", () => ({
  getMe: jest.fn(),
  getMyAccountantProfile: jest.fn(),
  getMyServices: jest.fn(),
  updateMyService: jest.fn(),
  createMyService: jest.fn(),
  deactivateMyService: jest.fn(),
  listServiceCategories: jest.fn(),
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

const categories = [
  { id: 3, name: "Bookkeeping", slug: "bookkeeping" },
  { id: 1, name: "Individual tax returns", slug: "individual-tax-returns" },
];

function profile(overrides = {}) {
  return {
    user_id: 9,
    email: "pro@test.com",
    first_name: "Ada",
    last_name: "Lovelace",
    bio: "Bio",
    credentials: "CPA",
    years_experience: 5,
    firm_name: "",
    location: "Austin, TX",
    services: [],
    publication_status: "draft",
    is_publish_ready: false,
    is_public: false,
    profile_complete: false,
    publish_readiness_errors: {},
    ...overrides,
  };
}

function service(overrides = {}) {
  return {
    id: 7,
    name: "My Returns",
    description: "Owned by this accountant",
    pricing_type: "consultation_required",
    indicative_price: null,
    consultation_fee: "25.00",
    cancellation_policy: "24h notice",
    is_active: true,
    category: {
      id: 1,
      name: "Individual tax returns",
      slug: "individual-tax-returns",
    },
    ...overrides,
  };
}

function renderServices(initialPath = "/onboarding/accountant/services") {
  localStorage.setItem(ACCESS_TOKEN_KEY, "token");
  getMe.mockResolvedValue(me);
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <AuthProvider>
        <Routes>
          <Route path="/onboarding/accountant/basic" element={<BasicProfileStep />} />
          <Route
            path="/onboarding/accountant/professional"
            element={<ProfessionalDetailsStep />}
          />
          <Route
            path="/onboarding/accountant/services"
            element={<ServicesOnboardingStep />}
          />
          <Route path="/onboarding/accountant/preview" element={<div>Preview step</div>} />
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
  getMyServices.mockReset();
  updateMyService.mockReset();
  createMyService.mockReset();
  deactivateMyService.mockReset();
  listServiceCategories.mockReset();
  listServiceCategories.mockResolvedValue(categories);
  getMyServices.mockResolvedValue([]);
  getMyAccountantProfile.mockResolvedValue(profile());
});

test("services route shows active wizard step with previous steps linked", async () => {
  renderServices();

  expect(
    await screen.findByRole("button", { name: "+ Add another service" })
  ).toBeInTheDocument();
  expect(screen.getByText("3. Services")).toHaveAttribute("aria-current", "step");
  expect(screen.getByText("1. Basic profile").closest("a")).toHaveAttribute(
    "href",
    "/onboarding/accountant/basic"
  );
  expect(screen.getByText("2. Professional details").closest("a")).toHaveAttribute(
    "href",
    "/onboarding/accountant/professional"
  );
  expect(screen.getByText("4. Preview").closest("a")).toHaveAttribute(
    "href",
    "/onboarding/accountant/preview"
  );
});

test("redirects to Basic Profile when no accountant profile exists", async () => {
  getMyAccountantProfile.mockResolvedValue(null);
  renderServices();

  expect(await screen.findByLabelText("First name")).toBeInTheDocument();
  expect(getMyServices).not.toHaveBeenCalled();
});

test("existing services load as cards with key details", async () => {
  getMyServices.mockResolvedValue([service()]);
  renderServices();

  expect(await screen.findByText("My Returns")).toBeInTheDocument();
  expect(screen.getByText("Owned by this accountant")).toBeInTheDocument();
  expect(
    screen.getByText(/Category: Individual tax returns/i)
  ).toBeInTheDocument();
  expect(screen.getByText(/Pricing: Consultation required/i)).toBeInTheDocument();
  expect(screen.getByText(/Consultation fee: \$25\.00/i)).toBeInTheDocument();
  expect(screen.getByText(/Cancellation: 24h notice/i)).toBeInTheDocument();
  expect(screen.getByText("Active")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Deactivate" })).toBeInTheDocument();
});

test("can add multiple services including the same category", async () => {
  getMyServices.mockResolvedValue([service()]);
  createMyService
    .mockResolvedValueOnce(
      service({
        id: 8,
        name: "Business taxes",
        description: "S-corp help",
        category: { id: 1, name: "Individual tax returns", slug: "individual-tax-returns" },
      })
    )
    .mockResolvedValueOnce(
      service({
        id: 9,
        name: "Personal returns plus",
        description: "Another individual offering",
        category: { id: 1, name: "Individual tax returns", slug: "individual-tax-returns" },
      })
    );
  renderServices();

  expect(await screen.findByText("My Returns")).toBeInTheDocument();

  userEvent.click(screen.getByRole("button", { name: "+ Add another service" }));
  const categorySelect = await screen.findByLabelText("Service category");
  await waitFor(() => expect(categorySelect).toBeEnabled());
  userEvent.type(screen.getByLabelText("Name"), "Business taxes");
  userEvent.type(screen.getByLabelText("Description"), "S-corp help");
  userEvent.selectOptions(categorySelect, "1");
  userEvent.click(screen.getByRole("button", { name: "Create service" }));
  expect(await screen.findByText("Business taxes")).toBeInTheDocument();

  userEvent.click(screen.getByRole("button", { name: "+ Add another service" }));
  const categorySelect2 = await screen.findByLabelText("Service category");
  await waitFor(() => expect(categorySelect2).toBeEnabled());
  userEvent.type(screen.getByLabelText("Name"), "Personal returns plus");
  userEvent.type(screen.getByLabelText("Description"), "Another individual offering");
  userEvent.selectOptions(categorySelect2, "1");
  userEvent.click(screen.getByRole("button", { name: "Create service" }));

  expect(await screen.findByText("Personal returns plus")).toBeInTheDocument();
  expect(createMyService).toHaveBeenCalledTimes(2);
  expect(createMyService.mock.calls[0][0].category_id).toBe(1);
  expect(createMyService.mock.calls[1][0].category_id).toBe(1);
});

test("can edit a service", async () => {
  getMyServices.mockResolvedValue([service()]);
  updateMyService.mockResolvedValue(
    service({ name: "Updated Returns", description: "Corrected" })
  );
  renderServices();

  expect(await screen.findByText("My Returns")).toBeInTheDocument();
  userEvent.click(screen.getByRole("button", { name: "Edit" }));
  const nameInput = await screen.findByDisplayValue("My Returns");
  userEvent.clear(nameInput);
  userEvent.type(nameInput, "Updated Returns");
  userEvent.click(screen.getByRole("button", { name: "Save" }));

  await waitFor(() => expect(updateMyService).toHaveBeenCalled());
  expect(await screen.findByText("Updated Returns")).toBeInTheDocument();
});

test("can deactivate and reactivate a service", async () => {
  getMyServices.mockResolvedValue([service()]);
  deactivateMyService.mockResolvedValue(service({ is_active: false }));
  updateMyService.mockResolvedValue(service({ is_active: true }));
  jest.spyOn(window, "confirm").mockReturnValue(true);
  renderServices();

  expect(await screen.findByText("My Returns")).toBeInTheDocument();
  userEvent.click(screen.getByRole("button", { name: "Deactivate" }));
  await waitFor(() => expect(deactivateMyService).toHaveBeenCalledWith(7));
  expect(await screen.findByText("Inactive")).toBeInTheDocument();

  userEvent.click(screen.getByRole("button", { name: "Reactivate" }));
  await waitFor(() =>
    expect(updateMyService).toHaveBeenCalledWith(7, { is_active: true })
  );
  expect(await screen.findByText("Active")).toBeInTheDocument();
  window.confirm.mockRestore();
});

test("category loading failure shows retry", async () => {
  listServiceCategories
    .mockRejectedValueOnce(new Error("network"))
    .mockResolvedValueOnce(categories);
  renderServices();

  userEvent.click(await screen.findByRole("button", { name: "+ Add another service" }));
  expect(
    await screen.findByText(/Could not load service categories/i)
  ).toBeInTheDocument();
  userEvent.click(screen.getByRole("button", { name: "Retry loading categories" }));
  await waitFor(() => {
    expect(screen.getByLabelText("Service category")).toBeEnabled();
  });
});

test("empty services show publish guidance", async () => {
  renderServices();

  expect(
    await screen.findByText(/At least one active service in a public category is required before publishing/i)
  ).toBeInTheDocument();
  expect(screen.getByText(/No services yet/i)).toBeInTheDocument();
});

test("shows field-level validation errors from the API", async () => {
  const err = new Error("Name is required.");
  err.fields = { name: "Name is required." };
  createMyService.mockRejectedValue(err);
  renderServices();

  userEvent.click(await screen.findByRole("button", { name: "+ Add another service" }));
  const categorySelect = await screen.findByLabelText("Service category");
  await waitFor(() => expect(categorySelect).toBeEnabled());
  userEvent.type(screen.getByLabelText("Name"), "Temp");
  userEvent.type(screen.getByLabelText("Description"), "Details");
  userEvent.selectOptions(categorySelect, "3");
  userEvent.click(screen.getByRole("button", { name: "Create service" }));

  expect(await screen.findByRole("alert")).toHaveTextContent("Name is required.");
});

test("duplicate create submissions are prevented while saving", async () => {
  let resolveCreate;
  createMyService.mockImplementation(
    () =>
      new Promise((resolve) => {
        resolveCreate = resolve;
      })
  );
  renderServices();

  userEvent.click(await screen.findByRole("button", { name: "+ Add another service" }));
  const categorySelect = await screen.findByLabelText("Service category");
  await waitFor(() => expect(categorySelect).toBeEnabled());
  userEvent.type(screen.getByLabelText("Name"), "New offering");
  userEvent.type(screen.getByLabelText("Description"), "Details");
  userEvent.selectOptions(categorySelect, "3");
  userEvent.click(screen.getByRole("button", { name: "Create service" }));

  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Creating..." })).toBeDisabled()
  );
  userEvent.click(screen.getByRole("button", { name: "Creating..." }));
  expect(createMyService).toHaveBeenCalledTimes(1);

  await act(async () => {
    resolveCreate(service({ id: 11, name: "New offering" }));
  });
  expect(await screen.findByText("New offering")).toBeInTheDocument();
});

test("Back goes to Professional Details", async () => {
  getMyServices.mockResolvedValue([service()]);
  renderServices();

  expect(await screen.findByRole("button", { name: "Back" })).toBeInTheDocument();
  userEvent.click(screen.getByRole("button", { name: "Back" }));
  expect(await screen.findByLabelText("Credentials")).toBeInTheDocument();
});

test("Save and exit goes to the accountant dashboard", async () => {
  renderServices();

  expect(await screen.findByRole("button", { name: "Save and exit" })).toBeInTheDocument();
  userEvent.click(screen.getByRole("button", { name: "Save and exit" }));
  expect(await screen.findByText("Accountant dash")).toBeInTheDocument();
});

test("Save and continue navigates to Preview", async () => {
  renderServices();

  expect(await screen.findByRole("button", { name: "Save and continue" })).toBeInTheDocument();
  userEvent.click(screen.getByRole("button", { name: "Save and continue" }));
  expect(await screen.findByText("Preview step")).toBeInTheDocument();
});

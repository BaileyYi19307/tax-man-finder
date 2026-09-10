import { MemoryRouter, Route, Routes } from "react-router-dom";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthProvider } from "../../auth/AuthProvider";
import AccountantOnboarding from "./AccountantOnboarding";
import {
  createAccountantProfile,
  getMe,
  getMyAccountantProfile,
  listServiceCategories,
} from "../../api/client";
import { ACCESS_TOKEN_KEY } from "../../auth/session";

jest.mock("../../api/client", () => ({
  getMe: jest.fn(),
  getMyAccountantProfile: jest.fn(),
  createAccountantProfile: jest.fn(),
  listServiceCategories: jest.fn(),
  apiFieldError: jest.requireActual("../../api/client").apiFieldError,
}));

const categories = [
  { id: 1, name: "Individual Tax Services", slug: "individual-tax-services" },
  { id: 3, name: "Bookkeeping", slug: "bookkeeping" },
];

const me = {
  id: 9,
  email: "newpro@test.com",
  first_name: "Ada",
  last_name: "",
  has_accountant_profile: false,
  accountant_profile_complete: false,
};

function renderOnboarding() {
  localStorage.setItem(ACCESS_TOKEN_KEY, "token");
  getMe.mockResolvedValue(me);
  return render(
    <MemoryRouter initialEntries={["/onboarding/accountant"]}>
      <AuthProvider>
        <Routes>
          <Route path="/onboarding/accountant" element={<AccountantOnboarding />} />
          <Route path="/dashboard/accountant" element={<div>Accountant dash</div>} />
          <Route path="/signup" element={<div>Signup</div>} />
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
  listServiceCategories.mockReset();
  listServiceCategories.mockResolvedValue(categories);
});

test("onboarding without an existing primary service loads categories", async () => {
  getMyAccountantProfile.mockResolvedValue(null);
  renderOnboarding();

  expect(await screen.findByLabelText("Primary service")).toBeInTheDocument();
  await waitFor(() => expect(listServiceCategories).toHaveBeenCalled());
  expect(await screen.findByLabelText("Service category")).toBeInTheDocument();
});

test("onboarding with existing services does not require category_id", async () => {
  getMyAccountantProfile.mockResolvedValue({
    user_id: 9,
    email: "newpro@test.com",
    first_name: "Ada",
    last_name: "Lovelace",
    bio: "Almost done",
    credentials: "EA",
    years_experience: 2,
    firm_name: "",
    location: "",
    service_scope: "local",
    services: [{ id: 4, name: "Existing service" }],
    profile_complete: false,
  });
  createAccountantProfile.mockResolvedValue({
    user_id: 9,
    profile_complete: true,
    services: [{ id: 4, name: "Existing service" }],
  });

  renderOnboarding();

  expect(await screen.findByDisplayValue("Almost done")).toBeInTheDocument();
  expect(screen.queryByLabelText("Primary service")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Service category")).not.toBeInTheDocument();

  userEvent.clear(screen.getByLabelText("Last name"));
  userEvent.type(screen.getByLabelText("Last name"), "Lovelace");
  userEvent.click(screen.getByRole("button", { name: "Save profile and continue" }));

  await waitFor(() => {
    expect(createAccountantProfile).toHaveBeenCalledTimes(1);
  });
  const payload = createAccountantProfile.mock.calls[0][0];
  expect(payload.service_name).toBeUndefined();
  expect(payload.category_id).toBeUndefined();
  expect(await screen.findByText("Accountant dash")).toBeInTheDocument();
});

test("onboarding with a service but no category blocks submit", async () => {
  getMyAccountantProfile.mockResolvedValue(null);
  renderOnboarding();

  const categorySelect = await screen.findByLabelText("Service category");
  await waitFor(() => expect(categorySelect).toBeEnabled());
  userEvent.type(screen.getByLabelText("First name"), "Ada");
  userEvent.type(screen.getByLabelText("Last name"), "Lovelace");
  userEvent.type(screen.getByLabelText("Credentials"), "CPA");
  userEvent.type(screen.getByLabelText("Short professional bio"), "I prepare returns.");
  userEvent.type(screen.getByLabelText("Primary service"), "Individual Tax Services");
  userEvent.click(screen.getByRole("button", { name: "Save profile and continue" }));

  expect(await screen.findByText("Select a service category.")).toBeInTheDocument();
  expect(createAccountantProfile).not.toHaveBeenCalled();
});

test("onboarding with a valid service category sends category_id", async () => {
  getMyAccountantProfile.mockResolvedValue(null);
  createAccountantProfile.mockResolvedValue({
    user_id: 9,
    profile_complete: true,
    services: [{ id: 11, name: "Individual Tax Services" }],
  });
  renderOnboarding();

  const categorySelect = await screen.findByLabelText("Service category");
  await waitFor(() => expect(categorySelect).toBeEnabled());
  userEvent.type(screen.getByLabelText("First name"), "Ada");
  userEvent.type(screen.getByLabelText("Last name"), "Lovelace");
  userEvent.type(screen.getByLabelText("Credentials"), "CPA");
  userEvent.type(screen.getByLabelText("Short professional bio"), "I prepare returns.");
  userEvent.type(screen.getByLabelText("Primary service"), "Individual Tax Services");
  userEvent.type(
    screen.getByLabelText("Service description"),
    "Form 1040 preparation"
  );
  userEvent.selectOptions(categorySelect, "1");
  userEvent.click(screen.getByRole("button", { name: "Save profile and continue" }));

  await waitFor(() => {
    expect(createAccountantProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        service_name: "Individual Tax Services",
        service_description: "Form 1040 preparation",
        category_id: 1,
      })
    );
  });
  expect(await screen.findByText("Accountant dash")).toBeInTheDocument();
});

test("onboarding shows loading categories before the request resolves", async () => {
  getMyAccountantProfile.mockResolvedValue(null);
  listServiceCategories.mockImplementation(() => new Promise(() => {}));
  renderOnboarding();

  expect(await screen.findByLabelText("Primary service")).toBeInTheDocument();
  expect(await screen.findByLabelText("Service category")).toBeDisabled();
  expect(screen.getByText("Loading categories…")).toBeInTheDocument();
  expect(
    screen.queryByText(/No service categories are available right now/i)
  ).not.toBeInTheDocument();
});

test("onboarding shows empty-state only after a successful empty response", async () => {
  getMyAccountantProfile.mockResolvedValue(null);
  listServiceCategories.mockResolvedValue([]);
  renderOnboarding();

  expect(
    await screen.findByText(/No service categories are available right now/i)
  ).toBeInTheDocument();
  expect(screen.queryByText(/Could not load service categories/i)).not.toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Save profile and continue" })
  ).toBeDisabled();
});

test("onboarding shows failure/retry instead of empty-state on load error", async () => {
  getMyAccountantProfile.mockResolvedValue(null);
  listServiceCategories
    .mockRejectedValueOnce(new Error("network"))
    .mockResolvedValueOnce(categories);
  renderOnboarding();

  expect(
    await screen.findByText(/Could not load service categories/i)
  ).toBeInTheDocument();
  expect(
    screen.queryByText(/No service categories are available right now/i)
  ).not.toBeInTheDocument();

  userEvent.click(screen.getByRole("button", { name: "Retry loading categories" }));
  const categorySelect = await screen.findByLabelText("Service category");
  await waitFor(() => expect(categorySelect).toBeEnabled());
  expect(listServiceCategories).toHaveBeenCalledTimes(2);
});

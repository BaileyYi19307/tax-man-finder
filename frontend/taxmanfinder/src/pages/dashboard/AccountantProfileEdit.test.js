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
  services: [{ id: 3, name: "Individual returns" }],
  profile_complete: true,
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
    })
  );
  expect(createAccountantProfile.mock.calls[0][0].service_name).toBeUndefined();
  expect(await screen.findByText("Public profile")).toBeInTheDocument();
});

test("missing profile resumes onboarding", async () => {
  getMyAccountantProfile.mockResolvedValue(null);
  renderPage();
  expect(await screen.findByText("Onboarding page")).toBeInTheDocument();
});

import { MemoryRouter, Route, Routes } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import AccountantProfilePage from "./AccountantProfile";
import { getPublicAccountantProfile } from "../../api/client";
import { ACCESS_TOKEN_KEY } from "../../auth/session";

jest.mock("../../api/client", () => ({
  getPublicAccountantProfile: jest.fn(),
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
  services: [{ id: 3, name: "Individual tax returns" }],
  profile_complete: true,
};

function renderProfile() {
  return render(
    <MemoryRouter initialEntries={["/accountants/12"]}>
      <Routes>
        <Route path="/accountants/:userId" element={<AccountantProfilePage />} />
        <Route path="/accountants" element={<div>Directory page</div>} />
        <Route path="/chat" element={<div>Inbox</div>} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  localStorage.clear();
  getPublicAccountantProfile.mockReset();
  getPublicAccountantProfile.mockResolvedValue(listed);
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

test("hides Go to inbox when logged out", async () => {
  renderProfile();
  expect(await screen.findByText("Ada Lovelace")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Message Accountant" })).toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "Go to inbox" })).not.toBeInTheDocument();
});

test("shows Go to inbox when logged in", async () => {
  localStorage.setItem(ACCESS_TOKEN_KEY, "token");
  renderProfile();
  expect(await screen.findByText("Ada Lovelace")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Go to inbox" })).toHaveAttribute("href", "/chat");
});

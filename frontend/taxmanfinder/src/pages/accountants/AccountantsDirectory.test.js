import { MemoryRouter } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import AccountantsDirectory from "./AccountantsDirectory";
import { listPublicAccountants } from "../../api/client";

jest.mock("../../api/client", () => ({
  listPublicAccountants: jest.fn(),
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

function renderDirectory() {
  return render(
    <MemoryRouter>
      <AccountantsDirectory />
    </MemoryRouter>
  );
}

beforeEach(() => {
  listPublicAccountants.mockReset();
});

test("shows loading then names instead of email", async () => {
  let resolveList;
  listPublicAccountants.mockReturnValue(
    new Promise((resolve) => {
      resolveList = resolve;
    })
  );
  renderDirectory();
  expect(screen.getByText("Loading tax professionals…")).toBeInTheDocument();

  resolveList([listed]);
  expect(await screen.findByText("Ada Lovelace")).toBeInTheDocument();
  expect(screen.getByText("Lovelace Tax · Remote")).toBeInTheDocument();
  expect(screen.queryByText("ada@test.com")).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "View profile" })).toHaveAttribute(
    "href",
    "/accountants/12"
  );
});

test("shows an empty state when the directory has no complete profiles", async () => {
  listPublicAccountants.mockResolvedValue([]);
  renderDirectory();
  expect(
    await screen.findByText("No tax professionals are listed yet.")
  ).toBeInTheDocument();
});

test("shows an error when the directory cannot load", async () => {
  listPublicAccountants.mockRejectedValue(new Error("network"));
  renderDirectory();
  expect(await screen.findByText("Could not load accountants.")).toBeInTheDocument();
  expect(
    screen.queryByText("No tax professionals are listed yet.")
  ).not.toBeInTheDocument();
});

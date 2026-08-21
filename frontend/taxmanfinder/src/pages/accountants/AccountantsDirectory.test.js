import { MemoryRouter } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AccountantsDirectory from "./AccountantsDirectory";
import { listPublicAccountants } from "../../api/client";

jest.mock("../../api/client", () => ({
  listPublicAccountants: jest.fn(),
  geocodePlace: jest.fn(),
}));

jest.mock("./DirectoryMap", () => ({
  __esModule: true,
  default: function MockDirectoryMap(props) {
    return (
      <div
        data-testid="directory-map"
        data-pin-count={(props.pinAccountants || []).length}
        data-selected={props.selectedUserId ?? ""}
      />
    );
  },
}));

jest.mock("./mapPins", () => ({
  pinEligibleAccountants: (rows) =>
    (rows || []).filter((a) => a.latitude != null && a.longitude != null),
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
  service_scope: "remote",
  latitude: null,
  longitude: null,
  map_eligible: false,
  services: [{ id: 3, name: "Individual tax returns" }],
  profile_complete: true,
};

const listedWithCoords = {
  ...listed,
  user_id: 13,
  email: "map@test.com",
  first_name: "Map",
  last_name: "Pin",
  firm_name: "Map Tax",
  location: "Philadelphia, PA",
  service_scope: "local",
  latitude: 39.9526,
  longitude: -75.1652,
  map_eligible: true,
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
  window.HTMLElement.prototype.scrollIntoView = jest.fn();
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

test("passes coordinate-bearing accountants to the map and selects a listing", async () => {
  listPublicAccountants.mockResolvedValue([listed, listedWithCoords]);
  renderDirectory();
  expect(await screen.findByText("Map Pin")).toBeInTheDocument();

  const map = screen.getByTestId("directory-map");
  expect(map).toHaveAttribute("data-pin-count", "1");

  await userEvent.click(screen.getByText("Map Pin"));
  expect(map).toHaveAttribute("data-selected", "13");
});

import { MemoryRouter } from "react-router-dom";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AccountantsDirectory from "./AccountantsDirectory";
import { geocodePlace, listPublicAccountants } from "../../api/client";

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
        data-list-count={(props.accountants || []).length}
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

const nycAccountant = {
  ...listedWithCoords,
  user_id: 14,
  email: "nyc@test.com",
  first_name: "New",
  last_name: "York",
  firm_name: "NY Tax",
  location: "New York, NY",
  latitude: 40.7128,
  longitude: -74.006,
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
  geocodePlace.mockReset();
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
  expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();

  const map = screen.getByTestId("directory-map");
  expect(map).toHaveAttribute("data-pin-count", "1");
  expect(map).toHaveAttribute("data-list-count", "2");

  await userEvent.click(screen.getByText("Map Pin"));
  expect(map).toHaveAttribute("data-selected", "13");
});

test("geographic search filters list and pins to the same result set", async () => {
  listPublicAccountants
    .mockResolvedValueOnce([listed, listedWithCoords, nycAccountant])
    .mockResolvedValueOnce([listedWithCoords]);
  geocodePlace.mockResolvedValue({
    latitude: 39.95,
    longitude: -75.16,
    display_name: "Philadelphia, Pennsylvania, United States",
  });

  renderDirectory();
  expect(await screen.findByText("Ada Lovelace")).toBeInTheDocument();
  expect(screen.getByText("Map Pin")).toBeInTheDocument();
  expect(screen.getByText("New York")).toBeInTheDocument();

  await userEvent.type(screen.getByLabelText("Search by location"), "Philadelphia");
  await userEvent.click(screen.getByRole("button", { name: "Search" }));

  await waitFor(() => {
    expect(screen.getByText("1 accountant near Philadelphia")).toBeInTheDocument();
  });
  expect(screen.getByText("Map Pin")).toBeInTheDocument();
  expect(screen.queryByText("Ada Lovelace")).not.toBeInTheDocument();
  expect(screen.queryByText("New York")).not.toBeInTheDocument();

  const map = screen.getByTestId("directory-map");
  expect(map).toHaveAttribute("data-pin-count", "1");
  expect(map).toHaveAttribute("data-list-count", "1");

  await userEvent.click(screen.getByText("Map Pin"));
  expect(map).toHaveAttribute("data-selected", "13");
});

test("geographic search with no matches shows an empty state", async () => {
  listPublicAccountants
    .mockResolvedValueOnce([listed, listedWithCoords])
    .mockResolvedValueOnce([]);
  geocodePlace.mockResolvedValue({
    latitude: 0,
    longitude: 0,
    display_name: "Nowhere, Ocean",
  });

  renderDirectory();
  expect(await screen.findByText("Ada Lovelace")).toBeInTheDocument();

  await userEvent.type(screen.getByLabelText("Search by location"), "Nowhere");
  await userEvent.click(screen.getByRole("button", { name: "Search" }));

  expect(await screen.findByText("No accountants near Nowhere")).toBeInTheDocument();
  expect(
    screen.getByText("Try a different place or a larger radius.")
  ).toBeInTheDocument();
  expect(screen.queryByText("Ada Lovelace")).not.toBeInTheDocument();
  expect(screen.getByTestId("directory-map")).toHaveAttribute("data-pin-count", "0");
});

test("clearing geographic search restores the flat directory", async () => {
  listPublicAccountants
    .mockResolvedValueOnce([listed, listedWithCoords])
    .mockResolvedValueOnce([listedWithCoords]);
  geocodePlace.mockResolvedValue({
    latitude: 39.95,
    longitude: -75.16,
    display_name: "Philadelphia, Pennsylvania, United States",
  });

  renderDirectory();
  expect(await screen.findByText("Ada Lovelace")).toBeInTheDocument();

  await userEvent.type(screen.getByLabelText("Search by location"), "Philadelphia");
  await userEvent.click(screen.getByRole("button", { name: "Search" }));
  expect(await screen.findByText("1 accountant near Philadelphia")).toBeInTheDocument();
  expect(screen.queryByText("Ada Lovelace")).not.toBeInTheDocument();

  await userEvent.click(screen.getByRole("button", { name: "Clear" }));
  expect(await screen.findByText("Ada Lovelace")).toBeInTheDocument();
  expect(screen.getByText("Map Pin")).toBeInTheDocument();
  expect(screen.queryByText(/accountant near/)).not.toBeInTheDocument();
  expect(screen.getByTestId("directory-map")).toHaveAttribute("data-list-count", "2");
});

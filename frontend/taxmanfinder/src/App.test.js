import { render, screen } from "@testing-library/react";
import App from "./App";

jest.mock("./api/client", () => ({
  __esModule: true,
  getMe: jest.fn(async () => {
    throw new Error("unauthenticated");
  }),
  listPublicServices: jest.fn(async () => []),
  listMyBookings: jest.fn(async () => []),
  listMyInquiries: jest.fn(async () => []),
  listPublicAccountants: jest.fn(async () => []),
  geocodePlace: jest.fn(async () => []),
}));

// App → AccountantsDirectory → DirectoryMap → react-leaflet (ESM). CRA/Jest cannot
// parse that package without extra transform config; mock the map leaf like other tests.
jest.mock("./pages/accountants/DirectoryMap", () => ({
  __esModule: true,
  default: function MockDirectoryMap() {
    return <div data-testid="directory-map" />;
  },
}));

test("renders the home page with shared navigation", async () => {
  render(<App />);

  expect(await screen.findByRole("link", { name: "Browse professionals" })).toHaveAttribute(
    "href",
    "/accountants"
  );
  expect(
    screen.getByRole("heading", {
      name: "Find the right tax professional for your situation.",
    })
  ).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Search" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Log in" })).toBeInTheDocument();
});

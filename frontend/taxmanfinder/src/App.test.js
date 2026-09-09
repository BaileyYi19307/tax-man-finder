import { render, screen } from "@testing-library/react";
import App from "./App";

jest.mock("./api/client", () => ({
  getMe: jest.fn(),
}));

// App eagerly imports AccountantsDirectory → DirectoryMap → react-leaflet (ESM).
// This smoke test does not exercise the map; stub the leaf dependency.
jest.mock("./pages/accountants/DirectoryMap", () => ({
  __esModule: true,
  default: function MockDirectoryMap() {
    return <div data-testid="directory-map" />;
  },
}));

test("renders the home page with shared navigation", async () => {
  render(<App />);

  expect(await screen.findByRole("link", { name: "Browse" })).toHaveAttribute(
    "href",
    "/accountants"
  );
  expect(screen.getByText(/Find tax help, or join as a professional/i)).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Log in" })).toBeInTheDocument();
});

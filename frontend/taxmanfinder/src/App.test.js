import { render, screen } from "@testing-library/react";
import App from "./App";

jest.mock("./api/client", () => ({
  getMe: jest.fn(),
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

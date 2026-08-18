import { MemoryRouter } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import ClientDashboard from "./ClientDashboard";

test("Find a Tax Professional goes to the accountant directory", () => {
  render(
    <MemoryRouter>
      <ClientDashboard />
    </MemoryRouter>
  );

  expect(screen.getByRole("link", { name: "Browse accountants" })).toHaveAttribute(
    "href",
    "/accountants"
  );
  expect(screen.queryByText(/Logged in as user/i)).not.toBeInTheDocument();
});

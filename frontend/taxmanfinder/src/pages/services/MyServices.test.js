import { MemoryRouter } from "react-router-dom";
import { render, screen, waitFor } from "@testing-library/react";
import MyServices from "./MyServices";
import { getMyServices } from "../../api/client";

jest.mock("../../api/client", () => ({
  getMyServices: jest.fn(),
}));

jest.mock("../../auth/intent", () => ({
  loginPath: ({ next }) => `/login?next=${next}`,
}));

beforeEach(() => {
  localStorage.clear();
  getMyServices.mockReset();
});

test("My Services calls the authenticated own-services API", async () => {
  localStorage.setItem("access_token", "token");
  getMyServices.mockResolvedValue([]);

  render(
    <MemoryRouter>
      <MyServices />
    </MemoryRouter>
  );

  await waitFor(() => {
    expect(getMyServices).toHaveBeenCalledTimes(1);
  });
  expect(
    await screen.findByText("You have not listed any services yet.")
  ).toBeInTheDocument();
});

test("only returned own-service rows are rendered", async () => {
  localStorage.setItem("access_token", "token");
  getMyServices.mockResolvedValue([
    {
      id: 7,
      name: "My Returns",
      description: "Owned by this accountant",
      pricing_type: "consultation_required",
      indicative_price: null,
    },
  ]);

  render(
    <MemoryRouter>
      <MyServices />
    </MemoryRouter>
  );

  expect(await screen.findByText("My Returns")).toBeInTheDocument();
  expect(screen.getByText("Owned by this accountant")).toBeInTheDocument();
  expect(screen.queryByText("Someone Else's Service")).not.toBeInTheDocument();
  expect(screen.getByText("View details").closest("a")).toHaveAttribute(
    "href",
    "/services/7"
  );
});

test("empty state works", async () => {
  localStorage.setItem("access_token", "token");
  getMyServices.mockResolvedValue([]);

  render(
    <MemoryRouter>
      <MyServices />
    </MemoryRouter>
  );

  expect(
    await screen.findByText("You have not listed any services yet.")
  ).toBeInTheDocument();
});

import { MemoryRouter } from "react-router-dom";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MyServices from "./MyServices";
import { getMyServices, updateMyService } from "../../api/client";

jest.mock("../../api/client", () => ({
  getMyServices: jest.fn(),
  updateMyService: jest.fn(),
}));

jest.mock("../../auth/intent", () => ({
  loginPath: ({ next }) => `/login?next=${next}`,
}));

beforeEach(() => {
  localStorage.clear();
  getMyServices.mockReset();
  updateMyService.mockReset();
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

test("accountant can edit name and description of an owned service", async () => {
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
  updateMyService.mockResolvedValue({
    id: 7,
    name: "Updated Returns",
    description: "Corrected description",
    pricing_type: "consultation_required",
    indicative_price: null,
  });

  render(
    <MemoryRouter>
      <MyServices />
    </MemoryRouter>
  );

  expect(await screen.findByText("My Returns")).toBeInTheDocument();
  userEvent.click(screen.getByRole("button", { name: "Edit" }));
  const nameInput = await screen.findByDisplayValue("My Returns");
  const descriptionInput = screen.getByDisplayValue("Owned by this accountant");
  userEvent.clear(nameInput);
  userEvent.type(nameInput, "Updated Returns");
  userEvent.clear(descriptionInput);
  userEvent.type(descriptionInput, "Corrected description");
  userEvent.click(screen.getByRole("button", { name: "Save" }));

  await waitFor(() => {
    expect(updateMyService).toHaveBeenCalledWith(7, {
      name: "Updated Returns",
      description: "Corrected description",
    });
  });
  expect(await screen.findByText("Updated Returns")).toBeInTheDocument();
  expect(screen.getByText("Corrected description")).toBeInTheDocument();
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

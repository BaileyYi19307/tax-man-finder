import { MemoryRouter } from "react-router-dom";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MyServices from "./MyServices";
import {
  getMyServices,
  updateMyService,
  createMyService,
  deactivateMyService,
  listServiceCategories,
  listCancellationPolicies,
} from "../../api/client";

jest.mock("../../api/client", () => ({
  getMyServices: jest.fn(),
  updateMyService: jest.fn(),
  createMyService: jest.fn(),
  deactivateMyService: jest.fn(),
  listServiceCategories: jest.fn(),
  listCancellationPolicies: jest.fn(),
  apiFieldError: jest.requireActual("../../api/client").apiFieldError,
}));

jest.mock("../../auth/intent", () => ({
  loginPath: ({ next }) => `/login?next=${next}`,
}));

const categories = [
  { id: 3, name: "Bookkeeping", slug: "bookkeeping" },
  { id: 1, name: "Individual tax returns", slug: "individual-tax-returns" },
];

const policyOptions = [
  {
    code: "free_24h",
    label:
      "Full refund if cancelled at least 24 hours before the consultation. Cancellations within 24 hours are non-refundable.",
  },
  {
    code: "free_48h",
    label:
      "Full refund if cancelled at least 48 hours before the consultation. Cancellations within 48 hours are non-refundable.",
  },
  {
    code: "non_refundable",
    label: "The consultation fee is non-refundable after booking.",
  },
];

function categorizedService(overrides = {}) {
  return {
    id: 7,
    name: "My Returns",
    description: "Owned by this accountant",
    pricing_type: "consultation_required",
    indicative_price: null,
    consultation_fee: "0.00",
    cancellation_policy_code: "free_24h",
    cancellation_policy:
      "Full refund if cancelled at least 24 hours before the consultation. Cancellations within 24 hours are non-refundable.",
    is_active: true,
    category: { id: 1, name: "Individual tax returns", slug: "individual-tax-returns" },
    ...overrides,
  };
}

beforeEach(() => {
  localStorage.clear();
  getMyServices.mockReset();
  updateMyService.mockReset();
  createMyService.mockReset();
  deactivateMyService.mockReset();
  listServiceCategories.mockReset();
  listCancellationPolicies.mockReset();
  listServiceCategories.mockResolvedValue(categories);
  listCancellationPolicies.mockResolvedValue(policyOptions);
});

test("My Services calls the authenticated own-services API and loads categories", async () => {
  localStorage.setItem("access_token", "token");
  getMyServices.mockResolvedValue([]);

  render(
    <MemoryRouter>
      <MyServices />
    </MemoryRouter>
  );

  await waitFor(() => {
    expect(getMyServices).toHaveBeenCalledTimes(1);
    expect(listServiceCategories).toHaveBeenCalledTimes(1);
    expect(listCancellationPolicies).toHaveBeenCalledTimes(1);
  });
  expect(
    await screen.findByText("You have not listed any services yet.")
  ).toBeInTheDocument();
});

test("only returned own-service rows are rendered", async () => {
  localStorage.setItem("access_token", "token");
  getMyServices.mockResolvedValue([categorizedService()]);

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

test("accountant can create a service with a selected category_id", async () => {
  localStorage.setItem("access_token", "token");
  getMyServices.mockResolvedValue([categorizedService()]);
  createMyService.mockResolvedValue(
    categorizedService({
      id: 8,
      name: "Business taxes",
      description: "S-corp and partnership returns",
      category: { id: 3, name: "Bookkeeping", slug: "bookkeeping" },
    })
  );

  render(
    <MemoryRouter>
      <MyServices />
    </MemoryRouter>
  );

  expect(await screen.findByText("My Returns")).toBeInTheDocument();
  userEvent.click(screen.getByRole("button", { name: "Add service" }));
  expect(await screen.findByText("New service")).toBeInTheDocument();
  const categorySelect = await screen.findByLabelText("Service category");
  await waitFor(() => expect(categorySelect).toBeEnabled());

  const nameInput = screen.getByLabelText("Name");
  const descriptionInput = screen.getByLabelText("Description");
  userEvent.type(nameInput, "Business taxes");
  userEvent.type(descriptionInput, "S-corp and partnership returns");
  userEvent.selectOptions(categorySelect, "3");
  const policySelect = screen.getByLabelText("Cancellation policy");
  await waitFor(() => expect(policySelect).toBeEnabled());
  userEvent.selectOptions(policySelect, "free_24h");
  userEvent.click(screen.getByRole("button", { name: "Create service" }));

  await waitFor(() => {
    expect(createMyService).toHaveBeenCalledWith({
      name: "Business taxes",
      description: "S-corp and partnership returns",
      pricing_type: "consultation_required",
      consultation_fee: "0.00",
      consultation_is_paid: false,
      cancellation_policy_code: "free_24h",
      category_id: 3,
    });
  });
  expect(await screen.findByText("Business taxes")).toBeInTheDocument();
});

test("edit form preserves an existing valid category and sends category_id", async () => {
  localStorage.setItem("access_token", "token");
  getMyServices.mockResolvedValue([categorizedService()]);
  updateMyService.mockResolvedValue(
    categorizedService({
      name: "Updated Returns",
      description: "Corrected description",
    })
  );

  render(
    <MemoryRouter>
      <MyServices />
    </MemoryRouter>
  );

  expect(await screen.findByText("My Returns")).toBeInTheDocument();
  userEvent.click(screen.getByRole("button", { name: "Edit" }));
  const categorySelect = await screen.findByLabelText("Service category");
  await waitFor(() => expect(categorySelect).toBeEnabled());
  expect(categorySelect).toHaveValue("1");

  const nameInput = screen.getByDisplayValue("My Returns");
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
      pricing_type: "consultation_required",
      consultation_fee: "0.00",
      consultation_is_paid: false,
      cancellation_policy_code: "free_24h",
      category_id: 1,
    });
  });
  expect(await screen.findByText("Updated Returns")).toBeInTheDocument();
  expect(screen.getByText("Service saved.")).toBeInTheDocument();
});

test("create requires a cancellation policy selection", async () => {
  localStorage.setItem("access_token", "token");
  getMyServices.mockResolvedValue([]);

  render(
    <MemoryRouter>
      <MyServices />
    </MemoryRouter>
  );

  userEvent.click(await screen.findByRole("button", { name: "Add service" }));
  const categorySelect = await screen.findByLabelText("Service category");
  await waitFor(() => expect(categorySelect).toBeEnabled());
  userEvent.type(screen.getByLabelText("Name"), "New offering");
  userEvent.type(screen.getByLabelText("Description"), "Details");
  userEvent.selectOptions(categorySelect, "3");
  userEvent.click(screen.getByRole("button", { name: "Create service" }));

  expect(await screen.findByText("Select a cancellation policy.")).toBeInTheDocument();
  expect(createMyService).not.toHaveBeenCalled();
});

test("legacy service edit requires selecting a cancellation policy", async () => {
  localStorage.setItem("access_token", "token");
  getMyServices.mockResolvedValue([
    categorizedService({
      cancellation_policy_code: null,
      cancellation_policy: "Custom freeform legacy text",
    }),
  ]);
  updateMyService.mockResolvedValue(
    categorizedService({
      cancellation_policy_code: "non_refundable",
      cancellation_policy: "The consultation fee is non-refundable after booking.",
    })
  );

  render(
    <MemoryRouter>
      <MyServices />
    </MemoryRouter>
  );

  expect(await screen.findByText("My Returns")).toBeInTheDocument();
  expect(
    screen.getByText(/Cancellation: Custom freeform legacy text/i)
  ).toBeInTheDocument();
  userEvent.click(screen.getByRole("button", { name: "Edit" }));
  const policySelect = await screen.findByLabelText("Cancellation policy");
  await waitFor(() => expect(policySelect).toBeEnabled());
  expect(policySelect).toHaveValue("");

  userEvent.click(screen.getByRole("button", { name: "Save" }));
  expect(await screen.findByText("Select a cancellation policy.")).toBeInTheDocument();
  expect(updateMyService).not.toHaveBeenCalled();

  userEvent.selectOptions(policySelect, "non_refundable");
  userEvent.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() => {
    expect(updateMyService).toHaveBeenCalledWith(
      7,
      expect.objectContaining({ cancellation_policy_code: "non_refundable" })
    );
  });
});

test("legacy inactive service reactivation opens edit until policy is chosen", async () => {
  localStorage.setItem("access_token", "token");
  getMyServices.mockResolvedValue([
    categorizedService({
      is_active: false,
      cancellation_policy_code: null,
      cancellation_policy: "Legacy text",
    }),
  ]);
  updateMyService.mockResolvedValue(
    categorizedService({
      is_active: true,
      cancellation_policy_code: "free_48h",
      cancellation_policy:
        "Full refund if cancelled at least 48 hours before the consultation. Cancellations within 48 hours are non-refundable.",
    })
  );

  render(
    <MemoryRouter>
      <MyServices />
    </MemoryRouter>
  );

  expect(await screen.findByText("My Returns")).toBeInTheDocument();
  userEvent.click(screen.getByRole("button", { name: "Reactivate" }));
  expect(
    await screen.findByText(
      "Select a cancellation policy before reactivating this service."
    )
  ).toBeInTheDocument();
  expect(updateMyService).not.toHaveBeenCalled();

  const policySelect = screen.getByLabelText("Cancellation policy");
  await waitFor(() => expect(policySelect).toBeEnabled());
  userEvent.selectOptions(policySelect, "free_48h");
  userEvent.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() => {
    expect(updateMyService).toHaveBeenCalledWith(
      7,
      expect.objectContaining({
        cancellation_policy_code: "free_48h",
        is_active: true,
      })
    );
  });
});

test("legacy service with no valid category requires a new selection", async () => {
  localStorage.setItem("access_token", "token");
  getMyServices.mockResolvedValue([
    categorizedService({
      category: null,
    }),
  ]);
  updateMyService.mockResolvedValue(
    categorizedService({
      category: { id: 3, name: "Bookkeeping", slug: "bookkeeping" },
    })
  );

  render(
    <MemoryRouter>
      <MyServices />
    </MemoryRouter>
  );

  expect(await screen.findByText("My Returns")).toBeInTheDocument();
  userEvent.click(screen.getByRole("button", { name: "Edit" }));
  const categorySelect = await screen.findByLabelText("Service category");
  await waitFor(() => expect(categorySelect).toBeEnabled());
  expect(categorySelect).toHaveValue("");

  userEvent.click(screen.getByRole("button", { name: "Save" }));
  expect(await screen.findByText("Select a service category.")).toBeInTheDocument();
  expect(updateMyService).not.toHaveBeenCalled();

  userEvent.selectOptions(categorySelect, "3");
  userEvent.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() => {
    expect(updateMyService).toHaveBeenCalledWith(
      7,
      expect.objectContaining({ category_id: 3 })
    );
  });
});

test("category loading failure shows retry and blocks create submit", async () => {
  localStorage.setItem("access_token", "token");
  getMyServices.mockResolvedValue([]);
  listServiceCategories
    .mockRejectedValueOnce(new Error("network"))
    .mockResolvedValueOnce(categories);

  render(
    <MemoryRouter>
      <MyServices />
    </MemoryRouter>
  );

  userEvent.click(await screen.findByRole("button", { name: "Add service" }));
  expect(
    await screen.findByText(/Could not load service categories/i)
  ).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Create service" })).toBeDisabled();

  userEvent.click(screen.getByRole("button", { name: "Retry loading categories" }));
  await waitFor(() => {
    expect(screen.getByLabelText("Service category")).toBeEnabled();
  });
  expect(listServiceCategories).toHaveBeenCalledTimes(2);
});

test("empty category response disables create submission", async () => {
  localStorage.setItem("access_token", "token");
  getMyServices.mockResolvedValue([]);
  listServiceCategories.mockResolvedValue([]);

  render(
    <MemoryRouter>
      <MyServices />
    </MemoryRouter>
  );

  userEvent.click(await screen.findByRole("button", { name: "Add service" }));
  expect(
    await screen.findByText(/No service categories are available right now/i)
  ).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Create service" })).toBeDisabled();
});

test("backend category_id errors are shown on the category field", async () => {
  localStorage.setItem("access_token", "token");
  getMyServices.mockResolvedValue([]);
  const err = new Error("Category is not active.");
  err.fields = { category_id: "Category is not active." };
  createMyService.mockRejectedValue(err);

  render(
    <MemoryRouter>
      <MyServices />
    </MemoryRouter>
  );

  userEvent.click(await screen.findByRole("button", { name: "Add service" }));
  const categorySelect = await screen.findByLabelText("Service category");
  await waitFor(() => expect(categorySelect).toBeEnabled());
  userEvent.type(screen.getByLabelText("Name"), "New offering");
  userEvent.type(screen.getByLabelText("Description"), "Details");
  userEvent.selectOptions(categorySelect, "3");
  userEvent.selectOptions(screen.getByLabelText("Cancellation policy"), "free_24h");
  userEvent.click(screen.getByRole("button", { name: "Create service" }));

  expect(await screen.findByText("Category is not active.")).toBeInTheDocument();
});

test("backend name uniqueness errors are shown on the name field", async () => {
  localStorage.setItem("access_token", "token");
  getMyServices.mockResolvedValue([]);
  const err = new Error(
    "You already have a service with this title. Edit or reactivate the existing service instead."
  );
  err.fields = {
    name: "You already have a service with this title. Edit or reactivate the existing service instead.",
  };
  createMyService.mockRejectedValue(err);

  render(
    <MemoryRouter>
      <MyServices />
    </MemoryRouter>
  );

  userEvent.click(await screen.findByRole("button", { name: "Add service" }));
  const categorySelect = await screen.findByLabelText("Service category");
  await waitFor(() => expect(categorySelect).toBeEnabled());
  userEvent.type(screen.getByLabelText("Name"), "Freelancer Tax Filing");
  userEvent.type(screen.getByLabelText("Description"), "Details");
  userEvent.selectOptions(categorySelect, "3");
  userEvent.selectOptions(screen.getByLabelText("Cancellation policy"), "free_24h");
  userEvent.click(screen.getByRole("button", { name: "Create service" }));

  expect(await screen.findByRole("alert")).toHaveTextContent(
    /You already have a service with this title/i
  );
  expect(screen.getByLabelText("Name")).toHaveAttribute("aria-invalid", "true");
});

test("accountant can remove a service from their public profile", async () => {
  localStorage.setItem("access_token", "token");
  getMyServices.mockResolvedValue([categorizedService()]);
  deactivateMyService.mockResolvedValue(
    categorizedService({ is_active: false })
  );
  jest.spyOn(window, "confirm").mockReturnValue(true);

  render(
    <MemoryRouter>
      <MyServices />
    </MemoryRouter>
  );

  expect(await screen.findByText("My Returns")).toBeInTheDocument();
  userEvent.click(screen.getByRole("button", { name: "Remove" }));

  await waitFor(() => {
    expect(deactivateMyService).toHaveBeenCalledWith(7);
  });
  expect(await screen.findByText("Hidden")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Remove" })).not.toBeInTheDocument();
  window.confirm.mockRestore();
});

test("edit before categories resolve keeps the existing category id", async () => {
  localStorage.setItem("access_token", "token");
  getMyServices.mockResolvedValue([categorizedService()]);
  let resolveCategories;
  listServiceCategories.mockImplementation(
    () =>
      new Promise((resolve) => {
        resolveCategories = resolve;
      })
  );

  render(
    <MemoryRouter>
      <MyServices />
    </MemoryRouter>
  );

  expect(await screen.findByText("My Returns")).toBeInTheDocument();
  userEvent.click(screen.getByRole("button", { name: "Edit" }));

  const categorySelect = await screen.findByLabelText("Service category");
  expect(categorySelect).toBeDisabled();
  expect(categorySelect).toHaveValue("1");
  expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();

  resolveCategories(categories);
  await waitFor(() => expect(categorySelect).toBeEnabled());
  expect(categorySelect).toHaveValue("1");
  expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
});

test("category load failure then retry while edit is open restores selection", async () => {
  localStorage.setItem("access_token", "token");
  getMyServices.mockResolvedValue([categorizedService()]);
  listServiceCategories
    .mockRejectedValueOnce(new Error("network"))
    .mockResolvedValueOnce(categories);

  render(
    <MemoryRouter>
      <MyServices />
    </MemoryRouter>
  );

  expect(await screen.findByText("My Returns")).toBeInTheDocument();
  userEvent.click(screen.getByRole("button", { name: "Edit" }));

  expect(
    await screen.findByText(/Could not load service categories/i)
  ).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();

  userEvent.click(screen.getByRole("button", { name: "Retry loading categories" }));
  const categorySelect = await screen.findByLabelText("Service category");
  await waitFor(() => expect(categorySelect).toBeEnabled());
  expect(categorySelect).toHaveValue("1");
});

test("existing category absent from active response clears the select", async () => {
  localStorage.setItem("access_token", "token");
  getMyServices.mockResolvedValue([categorizedService()]);
  listServiceCategories.mockResolvedValue([
    { id: 3, name: "Bookkeeping", slug: "bookkeeping" },
  ]);

  render(
    <MemoryRouter>
      <MyServices />
    </MemoryRouter>
  );

  expect(await screen.findByText("My Returns")).toBeInTheDocument();
  userEvent.click(screen.getByRole("button", { name: "Edit" }));
  const categorySelect = await screen.findByLabelText("Service category");
  await waitFor(() => {
    expect(categorySelect).toBeEnabled();
    expect(categorySelect).toHaveValue("");
  });
  expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
});

test("save stays disabled while categories are unavailable", async () => {
  localStorage.setItem("access_token", "token");
  getMyServices.mockResolvedValue([categorizedService()]);
  listServiceCategories.mockImplementation(() => new Promise(() => {}));

  render(
    <MemoryRouter>
      <MyServices />
    </MemoryRouter>
  );

  expect(await screen.findByText("My Returns")).toBeInTheDocument();
  userEvent.click(screen.getByRole("button", { name: "Edit" }));
  expect(await screen.findByLabelText("Service category")).toBeDisabled();
  expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
});

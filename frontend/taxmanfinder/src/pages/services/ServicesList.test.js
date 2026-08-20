import { MemoryRouter } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import ServicesList from "./ServicesList";
import { listPublicServices } from "../../api/client";

jest.mock("../../api/client", () => ({
  listPublicServices: jest.fn(),
}));

const service = {
  id: 7,
  name: "Individual returns",
  description: "Form 1040 preparation",
  pricing_type: "consultation_required",
  indicative_price: null,
};

function renderList() {
  return render(
    <MemoryRouter>
      <ServicesList />
    </MemoryRouter>
  );
}

beforeEach(() => {
  listPublicServices.mockReset();
});

test("shows loading then active services", async () => {
  let resolveList;
  listPublicServices.mockReturnValue(
    new Promise((resolve) => {
      resolveList = resolve;
    })
  );
  renderList();
  expect(screen.getByText("Loading services…")).toBeInTheDocument();

  resolveList([service]);
  expect(await screen.findByText("Individual returns")).toBeInTheDocument();
  expect(screen.getByText("Form 1040 preparation")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "View details" })).toHaveAttribute(
    "href",
    "/services/7"
  );
});

test("shows an empty state when no active services exist", async () => {
  listPublicServices.mockResolvedValue([]);
  renderList();
  expect(await screen.findByText(/No active services are listed yet/)).toBeInTheDocument();
});

test("shows an error when the catalog cannot load", async () => {
  listPublicServices.mockRejectedValue(new Error("network"));
  renderList();
  expect(await screen.findByText("Could not load services.")).toBeInTheDocument();
  expect(screen.queryByText(/No active services are listed yet/)).not.toBeInTheDocument();
});

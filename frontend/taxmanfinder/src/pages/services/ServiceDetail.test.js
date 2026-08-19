import { MemoryRouter, Route, Routes } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import axios from "axios";
import ServiceDetail from "./ServiceDetail";

jest.mock("axios");

const service = {
  id: 3,
  name: "Individual returns",
  description: "Form 1040 preparation",
  pricing_type: "consultation_required",
  indicative_price: null,
  accountant: 12,
};

function renderPage(serviceId = "3") {
  return render(
    <MemoryRouter initialEntries={[`/services/${serviceId}`]}>
      <Routes>
        <Route path="/services/:serviceId" element={<ServiceDetail />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  axios.get.mockReset();
});

test("shows loading then service details", async () => {
  let resolveGet;
  axios.get.mockReturnValue(
    new Promise((resolve) => {
      resolveGet = resolve;
    })
  );
  renderPage();

  expect(screen.getByText("Loading service…")).toBeInTheDocument();
  resolveGet({ data: service });
  expect(await screen.findByText("Individual returns")).toBeInTheDocument();
  expect(screen.getByText("Form 1040 preparation")).toBeInTheDocument();
});

test("failed fetch shows an error instead of staying on loading", async () => {
  axios.get.mockRejectedValue(new Error("network"));
  renderPage();

  expect(await screen.findByText("Could not load this service.")).toBeInTheDocument();
  expect(screen.queryByText("Loading service…")).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Browse tax professionals" })).toHaveAttribute(
    "href",
    "/accountants"
  );
  expect(screen.getByRole("link", { name: "Back to services" })).toHaveAttribute(
    "href",
    "/services"
  );
});

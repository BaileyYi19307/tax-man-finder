import { MemoryRouter, Route, Routes, useSearchParams } from "react-router-dom";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthProvider } from "../auth/AuthProvider";
import { AppLayout } from "../components/AppHeader";
import Home from "./Home";
import { getMe, listPublicServices } from "../api/client";
import { ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY, USER_ID_KEY } from "../auth/session";

jest.mock("../api/client", () => ({
  getMe: jest.fn(),
  listPublicServices: jest.fn(async () => []),
  listMyBookings: jest.fn(async () => []),
  listMyInquiries: jest.fn(async () => []),
}));

function DirectoryProbe() {
  const [params] = useSearchParams();
  const location = params.get("location");
  return (
    <div>
      Directory page
      {location ? ` loc=${location}` : ""}
    </div>
  );
}

const catalogServices = [
  {
    id: 20,
    name: "Individual tax returns",
    description: "1040 prep",
    pricing_type: "fixed",
    indicative_price: "250.00",
  },
  {
    id: 22,
    name: "Freelance tax consult",
    description: "1099 help",
    pricing_type: "consultation_required",
    indicative_price: null,
  },
  {
    id: 21,
    name: "Small business bookkeeping",
    description: "Books",
    pricing_type: "hourly",
    indicative_price: "75.00",
  },
  {
    id: 23,
    name: "Multi-state tax filing",
    description: "Multi-state",
    pricing_type: "fixed",
    indicative_price: "400.00",
  },
  {
    id: 24,
    name: "Startup tax consult",
    description: "Startups",
    pricing_type: "consultation_required",
    indicative_price: null,
  },
  {
    id: 1,
    name: "Tax Filing",
    description: "General filing",
    pricing_type: "fixed",
    indicative_price: "200.00",
  },
];

function renderHome(initialPath = "/") {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <AuthProvider>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/accountants" element={<DirectoryProbe />} />
            <Route path="/login" element={<div>Login page</div>} />
            <Route path="/services/:serviceId" element={<div>Service detail</div>} />
            <Route path="/onboarding/accountant" element={<div>Onboarding</div>} />
            <Route path="/dashboard/client" element={<div>Client dash</div>} />
            <Route path="/dashboard/accountant" element={<div>Accountant dash</div>} />
          </Route>
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  localStorage.clear();
  getMe.mockReset();
  listPublicServices.mockReset();
  listPublicServices.mockResolvedValue([]);
});

test("logged-out Home matches search-first hero hierarchy", async () => {
  renderHome();

  expect(screen.getByText(/Tax help, without the guesswork/i)).toBeInTheDocument();
  expect(
    screen.getByRole("heading", {
      name: "Find the right tax professional for your situation.",
    })
  ).toBeInTheDocument();
  expect(screen.getByPlaceholderText("What do you need help with?")).toBeInTheDocument();
  expect(screen.getByPlaceholderText("Remote or location")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Search" })).toBeInTheDocument();
  expect(
    screen.getByRole("heading", { name: "Get help in three simple steps." })
  ).toBeInTheDocument();
  expect(
    screen.getByText(
      /TaxManFinder connects clients with independent tax professionals/i
    )
  ).toBeInTheDocument();
  expect(screen.queryByText(/Recommended for common tax needs/i)).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "For professionals" })).toHaveAttribute(
    "href",
    "/onboarding/accountant"
  );
});

test("Search without location routes to the professionals directory", async () => {
  renderHome();

  userEvent.type(
    screen.getByPlaceholderText("What do you need help with?"),
    "returns"
  );
  userEvent.click(screen.getByRole("button", { name: "Search" }));
  expect(await screen.findByText("Directory page")).toBeInTheDocument();
});

test("Search with a location passes it to the directory query string", async () => {
  renderHome();

  userEvent.type(screen.getByPlaceholderText("Remote or location"), "Austin, TX");
  userEvent.click(screen.getByRole("button", { name: "Search" }));
  expect(await screen.findByText(/Directory page loc=Austin, TX/)).toBeInTheDocument();
});

test("logged-in client keeps authenticated nav without a hero signup CTA", async () => {
  localStorage.setItem(ACCESS_TOKEN_KEY, "access-token");
  localStorage.setItem(REFRESH_TOKEN_KEY, "refresh-token");
  localStorage.setItem(USER_ID_KEY, "11");
  getMe.mockResolvedValue({
    id: 11,
    email: "client@test.com",
    first_name: "Ann",
    last_name: "Client",
    has_accountant_profile: false,
    accountant_profile_complete: false,
  });

  renderHome();

  expect(await screen.findByRole("link", { name: "Client Dashboard" })).toHaveAttribute(
    "href",
    "/dashboard/client"
  );
  expect(screen.queryByRole("link", { name: "Log in" })).not.toBeInTheDocument();
  expect(
    screen.queryByRole("link", { name: "Create an account" })
  ).not.toBeInTheDocument();
});

test("Home links popular pills and browse-by-need cards to real services", async () => {
  listPublicServices.mockResolvedValue(catalogServices);

  renderHome();

  expect(
    await screen.findByRole("heading", { name: "What can we help you with?" })
  ).toBeInTheDocument();
  expect(screen.getByText("Browse by need")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Freelance taxes" })).toHaveAttribute(
    "href",
    "/services/22"
  );
  expect(screen.getByRole("link", { name: "Small business" })).toHaveAttribute(
    "href",
    "/services/21"
  );
  expect(screen.getByRole("link", { name: /Tax consultation/i })).toHaveAttribute(
    "href",
    "/services/1"
  );
  const startupLinks = screen.getAllByRole("link", { name: /Startup tax support/i });
  expect(startupLinks.length).toBeGreaterThanOrEqual(1);
  startupLinks.forEach((link) => {
    expect(link).toHaveAttribute("href", "/services/24");
  });
  expect(screen.getByText(/Message before booking/i)).toBeInTheDocument();
  expect(screen.getByText(/Secure Stripe checkout/i)).toBeInTheDocument();
});

test("Home omits popular and browse sections when no public services exist", async () => {
  renderHome();

  await waitFor(() => {
    expect(listPublicServices).toHaveBeenCalled();
  });
  expect(
    screen.queryByRole("heading", { name: "What can we help you with?" })
  ).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Popular services")).not.toBeInTheDocument();
});

test("Home does not invent ratings, vetted claims, or recommended professionals", () => {
  renderHome();

  expect(screen.queryByText(/vetted/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/verified/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/guaranteed/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/recommended for/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/testimonial/i)).not.toBeInTheDocument();
});

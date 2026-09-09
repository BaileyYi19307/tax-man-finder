import { MemoryRouter, Route, Routes } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import AccountantProfilePresentation from "./AccountantProfilePresentation";

const baseProfile = {
  user_id: 12,
  email: "ada@test.com",
  first_name: "Ada",
  last_name: "Lovelace",
  bio: "I prepare individual returns.",
  credentials: "EA",
  years_experience: 4,
  firm_name: "Lovelace Tax",
  location: "Austin, TX",
  headline: "Remote tax specialist",
  languages: ["English"],
  offers_remote: true,
  offers_in_person: false,
  industries: ["Freelancers"],
  website: "https://lovelace.example",
  license_information: "IRS Enrolled Agent",
  services: [
    {
      id: 3,
      name: "Individual tax returns",
      description: "1040 prep",
      pricing_type: "hourly",
      indicative_price: "150.00",
      consultation_fee: "0",
      category: {
        id: 1,
        name: "Individual tax returns",
        slug: "individual-tax-returns",
      },
    },
  ],
  publication_status: "published",
  is_publish_ready: true,
  is_public: true,
  profile_complete: true,
};

function renderPresentation(profile = baseProfile, props = {}) {
  return render(
    <MemoryRouter>
      <Routes>
        <Route
          path="*"
          element={<AccountantProfilePresentation profile={profile} {...props} />}
        />
      </Routes>
    </MemoryRouter>
  );
}

test("renders customer-facing professional fields and service cards", () => {
  renderPresentation();

  expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
  expect(screen.getByText("Remote tax specialist")).toBeInTheDocument();
  expect(screen.getByText("EA")).toBeInTheDocument();
  expect(screen.getByText("Austin, TX")).toBeInTheDocument();
  expect(screen.getByText("Remote")).toBeInTheDocument();
  expect(screen.getByText("English")).toBeInTheDocument();
  expect(screen.getByText("4 years experience")).toBeInTheDocument();
  expect(screen.getByText("I prepare individual returns.")).toBeInTheDocument();
  expect(screen.getByText("Freelancers")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "https://lovelace.example" })).toBeInTheDocument();
  expect(screen.getByText("IRS Enrolled Agent")).toBeInTheDocument();
  expect(screen.getByText("Individual tax returns")).toBeInTheDocument();
  expect(screen.getByText("1040 prep")).toBeInTheDocument();
  expect(screen.getByText(/\$150\.00\/hr/)).toBeInTheDocument();
  expect(screen.queryByText("ada@test.com")).not.toBeInTheDocument();
  expect(screen.getByText("AL")).toBeInTheDocument();
});

test("shows initials avatar fallback", () => {
  renderPresentation({
    ...baseProfile,
    first_name: "Grace",
    last_name: "Hopper",
  });
  expect(screen.getByText("GH")).toBeInTheDocument();
});

test("omits empty optional sections and inactive-style empty services list", () => {
  renderPresentation({
    ...baseProfile,
    headline: "",
    languages: [],
    industries: [],
    website: "",
    license_information: "",
    offers_remote: false,
    offers_in_person: false,
    service_scope: "local",
    services: [],
  });
  expect(screen.queryByText("Languages")).not.toBeInTheDocument();
  expect(screen.queryByText("Industries / client types")).not.toBeInTheDocument();
  expect(screen.queryByText("Website")).not.toBeInTheDocument();
  expect(screen.queryByText("License information")).not.toBeInTheDocument();
  expect(screen.getByText("No active services listed.")).toBeInTheDocument();
});

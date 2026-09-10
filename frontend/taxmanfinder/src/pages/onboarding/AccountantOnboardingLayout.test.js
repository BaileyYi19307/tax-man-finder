import { MemoryRouter, Route, Routes } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AccountantOnboardingLayout from "./AccountantOnboardingLayout";

function renderAt(stepId, publishReadinessErrors = {}) {
  return render(
    <MemoryRouter initialEntries={["/onboarding/accountant/preview"]}>
      <Routes>
        <Route
          path="/onboarding/accountant/basic"
          element={<div>Basic step page</div>}
        />
        <Route
          path="/onboarding/accountant/professional"
          element={<div>Professional step page</div>}
        />
        <Route
          path="/onboarding/accountant/services"
          element={<div>Services step page</div>}
        />
        <Route
          path="/onboarding/accountant/preview"
          element={
            <AccountantOnboardingLayout
              currentStepId={stepId}
              title="Current"
              publishReadinessErrors={publishReadinessErrors}
            >
              <div>Step body</div>
            </AccountantOnboardingLayout>
          }
        />
      </Routes>
    </MemoryRouter>
  );
}

test("current section uses aria-current and completed sections use Edit labels with checkmarks", () => {
  renderAt("preview");

  expect(
    screen.getByText("Select any section to review or edit it.")
  ).toBeInTheDocument();
  const basic = screen.getByRole("link", { name: "Edit Basic profile" });
  expect(basic).toHaveAttribute("href", "/onboarding/accountant/basic");
  expect(basic).toHaveTextContent("✓");
  expect(
    screen.getByRole("link", { name: "Edit Professional details" })
  ).toHaveAttribute("href", "/onboarding/accountant/professional");
  expect(screen.getByRole("link", { name: "Edit Services" })).toHaveAttribute(
    "href",
    "/onboarding/accountant/services"
  );
  expect(screen.getByText("4. Preview")).toHaveAttribute("aria-current", "step");
  expect(screen.queryByRole("link", { name: /Edit Preview/i })).not.toBeInTheDocument();
  expect(screen.queryByText("Needs attention")).not.toBeInTheDocument();
});

test("completed section links navigate to the matching wizard step", async () => {
  renderAt("preview");
  userEvent.click(screen.getByRole("link", { name: "Edit Professional details" }));
  expect(await screen.findByText("Professional step page")).toBeInTheDocument();
});

test("readiness gaps show Needs attention without treating visit order as complete", () => {
  renderAt("preview", {
    location: ["Add a location to publish."],
    services: ["Add at least one active service to publish."],
  });

  expect(
    screen.getByRole("link", { name: "Edit Basic profile" })
  ).toHaveTextContent("Needs attention");
  expect(
    screen.getByRole("link", { name: "Edit Services" })
  ).toHaveTextContent("Needs attention");
  expect(
    screen.getByRole("link", { name: "Edit Professional details" })
  ).toHaveTextContent("✓");
  expect(
    screen.getByRole("link", { name: "Edit Professional details" })
  ).not.toHaveTextContent("Needs attention");
});

test("without readiness data, prior visits are not marked complete or needing attention", () => {
  render(
    <MemoryRouter>
      <AccountantOnboardingLayout currentStepId="professional" title="Professional">
        <div>Body</div>
      </AccountantOnboardingLayout>
    </MemoryRouter>
  );

  expect(
    screen.getByText("Select any section to review or edit it.")
  ).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Basic profile" })).toHaveAttribute(
    "href",
    "/onboarding/accountant/basic"
  );
  expect(screen.queryByText("✓")).not.toBeInTheDocument();
  expect(screen.queryByText("Needs attention")).not.toBeInTheDocument();
  expect(screen.getByText("2. Professional details")).toHaveAttribute(
    "aria-current",
    "step"
  );
});

test("first step does not show edit helper for prior sections", () => {
  render(
    <MemoryRouter>
      <AccountantOnboardingLayout currentStepId="basic" title="Basic">
        <div>Body</div>
      </AccountantOnboardingLayout>
    </MemoryRouter>
  );

  expect(
    screen.queryByText("Select any section to review or edit it.")
  ).not.toBeInTheDocument();
  expect(screen.queryByRole("link", { name: /Edit /i })).not.toBeInTheDocument();
  expect(screen.getByText("1. Basic profile")).toHaveAttribute("aria-current", "step");
  expect(screen.getByRole("link", { name: "Professional details" })).toBeInTheDocument();
});

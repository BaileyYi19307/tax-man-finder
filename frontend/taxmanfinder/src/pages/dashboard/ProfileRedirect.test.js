import { MemoryRouter, Navigate, Route, Routes } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import { ACCOUNTANT_ONBOARDING_ENTRY } from "../onboarding/onboardingSteps";

test("/dashboard/profile redirects to the accountant wizard entry", async () => {
  render(
    <MemoryRouter initialEntries={["/dashboard/profile"]}>
      <Routes>
        <Route
          path="/dashboard/profile"
          element={<Navigate to={ACCOUNTANT_ONBOARDING_ENTRY} replace />}
        />
        <Route
          path="/onboarding/accountant/basic"
          element={<div>Wizard basic step</div>}
        />
      </Routes>
    </MemoryRouter>
  );

  expect(await screen.findByText("Wizard basic step")).toBeInTheDocument();
});

import { continueSetupPath } from "./onboardingSteps";

test("continueSetupPath prefers Basic when basic fields are missing", () => {
  expect(
    continueSetupPath({
      bio: ["Bio is required to publish."],
      services: ["At least one active service is required to publish."],
    })
  ).toBe("/onboarding/accountant/basic");
});

test("continueSetupPath routes professional gaps to Professional Details", () => {
  expect(
    continueSetupPath({
      credentials: ["Credentials are required to publish."],
      availability: ["Select remote and/or in-person availability to publish."],
    })
  ).toBe("/onboarding/accountant/professional");
});

test("continueSetupPath routes services gaps to Services", () => {
  expect(
    continueSetupPath({
      services: [
        "At least one active service with a valid public category is required to publish.",
      ],
    })
  ).toBe("/onboarding/accountant/services");
});

test("continueSetupPath routes ready profiles to Preview", () => {
  expect(continueSetupPath({})).toBe("/onboarding/accountant/preview");
  expect(continueSetupPath(undefined)).toBe("/onboarding/accountant/preview");
});

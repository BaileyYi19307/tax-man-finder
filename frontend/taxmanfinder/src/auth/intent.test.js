import {
  persistAccountantSignupIntent,
  persistIntentFromAuthParams,
  resolvePostAuthPath,
  signupPath,
} from "./intent";

beforeEach(() => {
  localStorage.clear();
});

test("signup path for accountant intent preserves onboarding, not client dashboard", () => {
  expect(signupPath({ intent: "tax-professional" })).toBe(
    "/signup?next=%2Fonboarding%2Faccountant&intent=tax-professional"
  );
});

test("new accountant after register/login is routed to onboarding, not client dashboard", () => {
  persistAccountantSignupIntent();
  expect(
    resolvePostAuthPath({
      next: null,
      intent: null,
      hasAccountantProfile: false,
      profileComplete: false,
    })
  ).toBe("/onboarding/accountant");
});

test("email verify login without query params still resumes accountant onboarding", () => {
  persistAccountantSignupIntent();
  expect(
    resolvePostAuthPath({
      next: null,
      intent: null,
      hasAccountantProfile: false,
    })
  ).toBe("/onboarding/accountant");
});

test("completed accountant selecting the accountant path goes to the accountant dashboard", () => {
  persistAccountantSignupIntent();
  expect(
    resolvePostAuthPath({
      next: "/onboarding/accountant",
      intent: "tax-professional",
      hasAccountantProfile: true,
      profileComplete: true,
    })
  ).toBe("/dashboard/accountant");
});

test("incomplete existing accountant profile resumes onboarding", () => {
  persistAccountantSignupIntent();
  expect(
    resolvePostAuthPath({
      next: "/onboarding/accountant",
      intent: "tax-professional",
      hasAccountantProfile: true,
      profileComplete: false,
    })
  ).toBe("/onboarding/accountant");
});

test("message/consultation next is not stolen by leftover accountant intent", () => {
  persistAccountantSignupIntent();
  expect(
    resolvePostAuthPath({
      next: "/accountants/12",
      intent: null,
      hasAccountantProfile: false,
    })
  ).toBe("/accountants/12");
});

test("looking-for-help login still uses client dashboard by default", () => {
  persistAccountantSignupIntent();
  persistIntentFromAuthParams({ intent: "looking-for-help" });
  expect(
    resolvePostAuthPath({
      next: null,
      intent: "looking-for-help",
      hasAccountantProfile: false,
    })
  ).toBe("/dashboard/client");
});

test("verified login params do not wipe stored accountant intent", () => {
  persistAccountantSignupIntent();
  persistIntentFromAuthParams({ next: null, intent: null });
  expect(
    resolvePostAuthPath({
      next: null,
      intent: null,
      hasAccountantProfile: false,
    })
  ).toBe("/onboarding/accountant");
});

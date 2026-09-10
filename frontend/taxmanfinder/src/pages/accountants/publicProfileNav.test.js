import { publicAccountantProfilePath, resolvePublicProfileBackNav } from "./publicProfileNav";

test("publicAccountantProfilePath adds recognized from params only", () => {
  expect(publicAccountantProfilePath(22)).toBe("/accountants/22");
  expect(publicAccountantProfilePath(22, "dashboard")).toBe(
    "/accountants/22?from=dashboard"
  );
  expect(publicAccountantProfilePath("9", "profile-editor")).toBe(
    "/accountants/9?from=profile-editor"
  );
});

test("resolvePublicProfileBackNav maps known contexts and falls back safely", () => {
  expect(resolvePublicProfileBackNav("dashboard")).toEqual({
    label: "← Back to accountant dashboard",
    to: "/dashboard/accountant",
  });
  expect(resolvePublicProfileBackNav("profile-editor")).toEqual({
    label: "← Back to profile editor",
    to: "/onboarding/accountant/preview",
  });
  expect(resolvePublicProfileBackNav(null)).toEqual({
    label: "← Back to accountants",
    to: "/accountants",
  });
  expect(resolvePublicProfileBackNav(undefined)).toEqual({
    label: "← Back to accountants",
    to: "/accountants",
  });
  expect(resolvePublicProfileBackNav("unknown")).toEqual({
    label: "← Back to accountants",
    to: "/accountants",
  });
});

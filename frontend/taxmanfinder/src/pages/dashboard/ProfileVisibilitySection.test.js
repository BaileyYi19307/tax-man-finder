import { MemoryRouter } from "react-router-dom";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ProfileVisibilitySection from "./ProfileVisibilitySection";
import {
  getMyAccountantProfile,
  unpublishMyAccountantProfile,
} from "../../api/client";

jest.mock("../../api/client", () => ({
  getMyAccountantProfile: jest.fn(),
  publishMyAccountantProfile: jest.fn(),
  unpublishMyAccountantProfile: jest.fn(),
  apiFieldError: jest.requireActual("../../api/client").apiFieldError,
}));

function ownerProfile(overrides = {}) {
  return {
    user_id: 22,
    email: "pro@test.com",
    first_name: "Pat",
    last_name: "Pro",
    bio: "Helps with taxes",
    credentials: "CPA",
    years_experience: 5,
    firm_name: "Pro Tax",
    location: "Austin, TX",
    services: [{ id: 1, name: "Returns" }],
    publication_status: "draft",
    is_publish_ready: true,
    is_public: false,
    profile_complete: true,
    publish_readiness_errors: {},
    ...overrides,
  };
}

function renderSection() {
  return render(
    <MemoryRouter>
      <ProfileVisibilitySection />
    </MemoryRouter>
  );
}

beforeEach(() => {
  getMyAccountantProfile.mockReset();
  unpublishMyAccountantProfile.mockReset();
});

test("incomplete draft shows only Continue profile setup routed by readiness errors", async () => {
  getMyAccountantProfile.mockResolvedValue(
    ownerProfile({
      is_publish_ready: false,
      profile_complete: false,
      location: "",
      publish_readiness_errors: {
        location: ["Location is required to publish."],
        services: [
          "At least one active service with a valid public category is required to publish.",
        ],
      },
    })
  );

  renderSection();

  expect(await screen.findByText("Your profile is private.")).toBeInTheDocument();
  expect(screen.getByText("Location is required to publish.")).toBeInTheDocument();
  expect(
    screen.getByRole("link", { name: "Continue profile setup" })
  ).toHaveAttribute("href", "/onboarding/accountant/basic");
  expect(screen.queryByRole("link", { name: "View profile" })).not.toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "Edit profile" })).not.toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "Manage services" })).not.toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "Preview and publish" })).not.toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "Fix profile" })).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Unpublish profile" })
  ).not.toBeInTheDocument();
});

test("ready draft shows Preview and publish to the preview step", async () => {
  getMyAccountantProfile.mockResolvedValue(ownerProfile());

  renderSection();

  expect(
    await screen.findByText("Your profile is ready to publish.")
  ).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Preview and publish" })).toHaveAttribute(
    "href",
    "/onboarding/accountant/preview"
  );
  expect(
    screen.queryByRole("link", { name: "Continue profile setup" })
  ).not.toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "View profile" })).not.toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "Edit profile" })).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Publish profile" })
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Unpublish profile" })
  ).not.toBeInTheDocument();
});

test("published and public shows View, Edit to wizard, and unpublish", async () => {
  getMyAccountantProfile.mockResolvedValue(
    ownerProfile({
      publication_status: "published",
      is_public: true,
    })
  );

  renderSection();

  expect(await screen.findByText("Your profile is live.")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "View profile" })).toHaveAttribute(
    "href",
    "/accountants/22?from=dashboard"
  );
  expect(screen.getByRole("link", { name: "Edit profile" })).toHaveAttribute(
    "href",
    "/onboarding/accountant/basic"
  );
  expect(
    screen.queryByRole("link", { name: "Continue profile setup" })
  ).not.toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "Fix profile" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Unpublish profile" })).toBeEnabled();
});

test("published but hidden shows Fix profile routed by readiness errors and Unpublish", async () => {
  getMyAccountantProfile.mockResolvedValue(
    ownerProfile({
      publication_status: "published",
      is_publish_ready: false,
      is_public: false,
      profile_complete: false,
      publish_readiness_errors: {
        services: [
          "At least one active service with a valid public category is required to publish.",
        ],
      },
    })
  );

  renderSection();

  expect(
    await screen.findByText(
      "Your profile is currently hidden because information is missing."
    )
  ).toBeInTheDocument();
  expect(screen.getByText(/remains marked as published/i)).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Fix profile" })).toHaveAttribute(
    "href",
    "/onboarding/accountant/services"
  );
  expect(
    screen.queryByRole("link", { name: "Continue profile setup" })
  ).not.toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "View profile" })).not.toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "Edit profile" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Unpublish profile" })).toBeEnabled();
});

test("professional readiness errors route Continue setup to Professional Details", async () => {
  getMyAccountantProfile.mockResolvedValue(
    ownerProfile({
      is_publish_ready: false,
      profile_complete: false,
      publish_readiness_errors: {
        credentials: ["Credentials are required to publish."],
        languages: ["At least one language is required to publish."],
      },
    })
  );

  renderSection();

  expect(
    await screen.findByRole("link", { name: "Continue profile setup" })
  ).toHaveAttribute("href", "/onboarding/accountant/professional");
});

test("availability readiness errors route Continue setup to Professional Details", async () => {
  getMyAccountantProfile.mockResolvedValue(
    ownerProfile({
      is_publish_ready: false,
      profile_complete: false,
      publish_readiness_errors: {
        availability: ["Select remote and/or in-person availability to publish."],
      },
    })
  );

  renderSection();

  expect(
    await screen.findByRole("link", { name: "Continue profile setup" })
  ).toHaveAttribute("href", "/onboarding/accountant/professional");
});

test("unpublish requires confirmation that preserves profile, services, bookings, and messages", async () => {
  getMyAccountantProfile.mockResolvedValue(
    ownerProfile({
      publication_status: "published",
      is_public: true,
    })
  );
  unpublishMyAccountantProfile.mockResolvedValue(
    ownerProfile({
      publication_status: "draft",
      is_public: false,
    })
  );

  renderSection();
  userEvent.click(await screen.findByRole("button", { name: "Unpublish profile" }));

  expect(unpublishMyAccountantProfile).not.toHaveBeenCalled();
  expect(
    await screen.findByRole("group", { name: "Confirm unpublish" })
  ).toBeInTheDocument();
  expect(
    screen.getByText(/hides your listing from customer discovery/i)
  ).toBeInTheDocument();
  expect(
    screen.getByText(/profile, services, bookings, and messages are preserved/i)
  ).toBeInTheDocument();

  userEvent.click(screen.getByRole("button", { name: "Confirm unpublish" }));

  expect(
    await screen.findByText("Your profile is ready to publish.")
  ).toBeInTheDocument();
  expect(unpublishMyAccountantProfile).toHaveBeenCalledTimes(1);
});

test("cancelling unpublish confirmation does not call the API", async () => {
  getMyAccountantProfile.mockResolvedValue(
    ownerProfile({
      publication_status: "published",
      is_public: true,
    })
  );

  renderSection();
  userEvent.click(await screen.findByRole("button", { name: "Unpublish profile" }));
  expect(
    await screen.findByRole("group", { name: "Confirm unpublish" })
  ).toBeInTheDocument();

  userEvent.click(screen.getByRole("button", { name: "Cancel" }));

  expect(unpublishMyAccountantProfile).not.toHaveBeenCalled();
  expect(screen.getByText("Your profile is live.")).toBeInTheDocument();
  await waitFor(() => {
    expect(
      screen.queryByRole("group", { name: "Confirm unpublish" })
    ).not.toBeInTheDocument();
  });
  expect(
    screen.getByRole("button", { name: "Unpublish profile" })
  ).toBeInTheDocument();
});

test("unpublish failure shows retryable error", async () => {
  getMyAccountantProfile.mockResolvedValue(
    ownerProfile({
      publication_status: "published",
      is_public: true,
    })
  );
  unpublishMyAccountantProfile.mockRejectedValue(new Error("server exploded"));

  renderSection();
  userEvent.click(await screen.findByRole("button", { name: "Unpublish profile" }));
  userEvent.click(await screen.findByRole("button", { name: "Confirm unpublish" }));

  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Could not unpublish your profile. Check your connection and try again."
  );
  expect(screen.getByRole("group", { name: "Confirm unpublish" })).toBeInTheDocument();
});

test("confirm unpublish disables while request is pending and blocks duplicates", async () => {
  getMyAccountantProfile.mockResolvedValue(
    ownerProfile({
      publication_status: "published",
      is_public: true,
    })
  );
  let resolveUnpublish;
  unpublishMyAccountantProfile.mockImplementation(
    () =>
      new Promise((resolve) => {
        resolveUnpublish = resolve;
      })
  );

  renderSection();
  userEvent.click(await screen.findByRole("button", { name: "Unpublish profile" }));
  userEvent.click(await screen.findByRole("button", { name: "Confirm unpublish" }));
  expect(
    await screen.findByRole("button", { name: "Unpublishing…" })
  ).toBeDisabled();
  userEvent.click(screen.getByRole("button", { name: "Unpublishing…" }));

  await waitFor(() => {
    expect(unpublishMyAccountantProfile).toHaveBeenCalledTimes(1);
  });

  await act(async () => {
    resolveUnpublish(
      ownerProfile({
        publication_status: "draft",
        is_public: false,
      })
    );
  });
});

import { MemoryRouter } from "react-router-dom";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ProfileVisibilitySection from "./ProfileVisibilitySection";
import {
  getMyAccountantProfile,
  publishMyAccountantProfile,
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
  publishMyAccountantProfile.mockReset();
  unpublishMyAccountantProfile.mockReset();
});

test("draft and not ready shows only Continue profile setup", async () => {
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
    screen.getByText(
      "At least one active service with a valid public category is required to publish."
    )
  ).toBeInTheDocument();
  expect(
    screen.getByRole("link", { name: "Continue profile setup" })
  ).toHaveAttribute("href", "/onboarding/accountant/basic");
  expect(screen.queryByRole("link", { name: "View profile" })).not.toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "Edit profile" })).not.toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "Manage services" })).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Publish profile" })
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Unpublish profile" })
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Confirm unpublish" })
  ).not.toBeInTheDocument();
});

test("draft and ready shows Continue setup to Preview and publish button", async () => {
  getMyAccountantProfile.mockResolvedValue(ownerProfile());

  renderSection();

  expect(
    await screen.findByText("Your profile is ready to publish.")
  ).toBeInTheDocument();
  expect(
    screen.getByRole("link", { name: "Continue profile setup" })
  ).toHaveAttribute("href", "/onboarding/accountant/preview");
  expect(
    screen.getByRole("button", { name: "Publish profile" })
  ).toBeEnabled();
  expect(screen.queryByRole("link", { name: "View profile" })).not.toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "Edit profile" })).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Unpublish profile" })
  ).not.toBeInTheDocument();
});

test("published and ready shows View as primary, Edit to wizard, and unpublish text action", async () => {
  getMyAccountantProfile.mockResolvedValue(
    ownerProfile({
      publication_status: "published",
      is_public: true,
    })
  );

  renderSection();

  expect(await screen.findByText("Your profile is live.")).toBeInTheDocument();
  const viewLink = screen.getByRole("link", { name: "View profile" });
  expect(viewLink).toHaveAttribute("href", "/accountants/22");
  expect(viewLink).toHaveStyle({ background: "#2563eb", color: "#fff" });
  const editLink = screen.getByRole("link", { name: "Edit profile" });
  expect(editLink).toHaveAttribute("href", "/onboarding/accountant/basic");
  expect(editLink).toHaveStyle({ background: "#fff", color: "#111827" });
  expect(
    screen.queryByRole("link", { name: "Continue profile setup" })
  ).not.toBeInTheDocument();
  const unpublish = screen.getByRole("button", { name: "Unpublish profile" });
  expect(unpublish).toBeEnabled();
  expect(unpublish).toHaveStyle({
    background: "transparent",
    color: "#b91c1c",
  });
  expect(
    screen.queryByRole("button", { name: "Publish profile" })
  ).not.toBeInTheDocument();
});

test("published but not ready routes Continue setup to Services and allows unpublish", async () => {
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
  expect(
    screen.getByText(/remains marked as published/i)
  ).toBeInTheDocument();
  expect(
    screen.getByText(
      "At least one active service with a valid public category is required to publish."
    )
  ).toBeInTheDocument();
  expect(
    screen.getByRole("link", { name: "Continue profile setup" })
  ).toHaveAttribute("href", "/onboarding/accountant/services");
  expect(screen.queryByRole("link", { name: "View profile" })).not.toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "Edit profile" })).not.toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "Manage services" })).not.toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Unpublish profile" })
  ).toBeEnabled();
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

test("publish success updates status from the API response", async () => {
  getMyAccountantProfile.mockResolvedValue(ownerProfile());
  publishMyAccountantProfile.mockResolvedValue(
    ownerProfile({
      publication_status: "published",
      is_public: true,
      publish_readiness_errors: {},
    })
  );

  renderSection();
  userEvent.click(await screen.findByRole("button", { name: "Publish profile" }));

  expect(await screen.findByText("Your profile is live.")).toBeInTheDocument();
  expect(publishMyAccountantProfile).toHaveBeenCalledTimes(1);
  expect(
    screen.getByRole("button", { name: "Unpublish profile" })
  ).toBeInTheDocument();
});

test("publish failure shows actionable validation errors", async () => {
  getMyAccountantProfile.mockResolvedValue(ownerProfile());
  const err = Object.assign(new Error("Location is required to publish."), {
    fields: { location: "Location is required to publish." },
  });
  publishMyAccountantProfile.mockRejectedValue(err);

  renderSection();
  userEvent.click(await screen.findByRole("button", { name: "Publish profile" }));

  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Location is required to publish."
  );
  expect(
    screen.getByRole("button", { name: "Publish profile" })
  ).toBeEnabled();
});

test("publish network failure shows retryable error", async () => {
  getMyAccountantProfile.mockResolvedValue(ownerProfile());
  publishMyAccountantProfile.mockRejectedValue(new Error("network down"));

  renderSection();
  userEvent.click(await screen.findByRole("button", { name: "Publish profile" }));

  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Could not publish your profile. Check your connection and try again."
  );
});

test("unpublish requires confirmation that explains discovery removal", async () => {
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
    screen.getByText(/removes your profile from customer discovery/i)
  ).toBeInTheDocument();
  expect(
    screen.getByText(/services and existing bookings are preserved/i)
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

test("unpublish success updates status from the API response", async () => {
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
  userEvent.click(await screen.findByRole("button", { name: "Confirm unpublish" }));

  expect(
    await screen.findByText("Your profile is ready to publish.")
  ).toBeInTheDocument();
  expect(unpublishMyAccountantProfile).toHaveBeenCalledTimes(1);
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

test("publish button disables while request is pending", async () => {
  getMyAccountantProfile.mockResolvedValue(ownerProfile());
  let resolvePublish;
  publishMyAccountantProfile.mockImplementation(
    () =>
      new Promise((resolve) => {
        resolvePublish = resolve;
      })
  );

  renderSection();
  const button = await screen.findByRole("button", { name: "Publish profile" });
  userEvent.click(button);

  expect(await screen.findByRole("button", { name: "Publishing…" })).toBeDisabled();

  await act(async () => {
    resolvePublish(
      ownerProfile({
        publication_status: "published",
        is_public: true,
      })
    );
  });

  expect(await screen.findByText("Your profile is live.")).toBeInTheDocument();
});

test("duplicate publish clicks do not start a second request", async () => {
  getMyAccountantProfile.mockResolvedValue(ownerProfile());
  let resolvePublish;
  publishMyAccountantProfile.mockImplementation(
    () =>
      new Promise((resolve) => {
        resolvePublish = resolve;
      })
  );

  renderSection();
  const button = await screen.findByRole("button", { name: "Publish profile" });
  userEvent.click(button);
  userEvent.click(await screen.findByRole("button", { name: "Publishing…" }));
  userEvent.click(screen.getByRole("button", { name: "Publishing…" }));

  await waitFor(() => {
    expect(publishMyAccountantProfile).toHaveBeenCalledTimes(1);
  });

  await act(async () => {
    resolvePublish(
      ownerProfile({
        publication_status: "published",
        is_public: true,
      })
    );
  });
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

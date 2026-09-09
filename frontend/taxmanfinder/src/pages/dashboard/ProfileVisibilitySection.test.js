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

test("draft and not ready shows private status, errors, links, and no publish button", async () => {
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
  expect(screen.getByRole("link", { name: "Edit profile" })).toHaveAttribute(
    "href",
    "/dashboard/profile"
  );
  expect(screen.getByRole("link", { name: "Manage services" })).toHaveAttribute(
    "href",
    "/dashboard/services"
  );
  expect(
    screen.queryByRole("button", { name: "Publish profile" })
  ).not.toBeInTheDocument();
});

test("draft and ready shows publish button", async () => {
  getMyAccountantProfile.mockResolvedValue(ownerProfile());

  renderSection();

  expect(
    await screen.findByText("Your profile is ready to publish.")
  ).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Publish profile" })
  ).toBeEnabled();
  expect(
    screen.queryByRole("button", { name: "Unpublish profile" })
  ).not.toBeInTheDocument();
});

test("published and ready shows live status and unpublish", async () => {
  getMyAccountantProfile.mockResolvedValue(
    ownerProfile({
      publication_status: "published",
      is_public: true,
    })
  );

  renderSection();

  expect(await screen.findByText("Your profile is live.")).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Unpublish profile" })
  ).toBeEnabled();
  expect(
    screen.queryByRole("button", { name: "Publish profile" })
  ).not.toBeInTheDocument();
});

test("published but not ready explains hidden status and allows unpublish", async () => {
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
  expect(screen.getByRole("link", { name: "Edit profile" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Manage services" })).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Unpublish profile" })
  ).toBeEnabled();
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

  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Could not unpublish your profile. Check your connection and try again."
  );
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

test("unpublish button disables while request is pending and blocks duplicates", async () => {
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

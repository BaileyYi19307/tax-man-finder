import { ACCESS_TOKEN_KEY } from "../auth/session";
import {
  apiFieldError,
  getMyAccountantProfile,
  getProfileStatus,
  publishMyAccountantProfile,
  unpublishMyAccountantProfile,
} from "./client";

const API_BASE = process.env.REACT_APP_API_BASE || "http://127.0.0.1:8000";

function publishedPayload(overrides = {}) {
  return {
    user_id: 7,
    email: "acct@test.com",
    first_name: "Ada",
    last_name: "Accountant",
    bio: "Helps with taxes",
    credentials: "CPA",
    years_experience: 5,
    firm_name: "Ada Tax",
    location: "Austin, TX",
    services: [],
    publication_status: "published",
    is_publish_ready: true,
    is_public: true,
    profile_complete: true,
    publish_readiness_errors: {},
    ...overrides,
  };
}

describe("accountant publication API client", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem(ACCESS_TOKEN_KEY, "test-token");
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.resetAllMocks();
    localStorage.clear();
  });

  it("publishes the authenticated accountant profile", async () => {
    const payload = publishedPayload();
    global.fetch.mockResolvedValue(
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    const result = await publishMyAccountantProfile();

    expect(global.fetch).toHaveBeenCalledWith(
      `${API_BASE}/accountants/me/publish/`,
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({}),
        headers: expect.objectContaining({
          Authorization: "Bearer test-token",
          "Content-Type": "application/json",
        }),
      })
    );
    expect(result).toEqual(payload);
    expect(result.publication_status).toBe("published");
    expect(result.is_publish_ready).toBe(true);
    expect(result.is_public).toBe(true);
    expect(result.profile_complete).toBe(true);
    expect(result.publish_readiness_errors).toEqual({});
  });

  it("unpublishes the authenticated accountant profile", async () => {
    const payload = publishedPayload({
      publication_status: "draft",
      is_public: false,
    });
    global.fetch.mockResolvedValue(
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    const result = await unpublishMyAccountantProfile();

    expect(global.fetch).toHaveBeenCalledWith(
      `${API_BASE}/accountants/me/unpublish/`,
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({}),
        headers: expect.objectContaining({
          Authorization: "Bearer test-token",
        }),
      })
    );
    expect(result.publication_status).toBe("draft");
    expect(result.is_public).toBe(false);
    expect(result.is_publish_ready).toBe(true);
    expect(result.profile_complete).toBe(true);
    expect(result.publish_readiness_errors).toEqual({});
  });

  it("parses publish_readiness_errors on the owner profile payload", async () => {
    const payload = publishedPayload({
      publication_status: "draft",
      is_publish_ready: false,
      is_public: false,
      profile_complete: false,
      location: "",
      publish_readiness_errors: {
        location: ["Location is required to publish."],
        services: [
          "At least one active service with a valid public category is required to publish.",
        ],
      },
    });
    global.fetch.mockResolvedValue(
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    const result = await getMyAccountantProfile();

    expect(result.publish_readiness_errors.location).toEqual([
      "Location is required to publish.",
    ]);
    expect(result.publish_readiness_errors.services[0]).toMatch(
      /valid public category/
    );
    expect(result.is_publish_ready).toBe(false);
  });

  it("parses publish_readiness_errors on owner profile status", async () => {
    const statusPayload = {
      profile_info_complete: true,
      services_exist: false,
      profile_complete: false,
      publication_status: "draft",
      is_publish_ready: false,
      is_public: false,
      publish_readiness_errors: {
        services: [
          "At least one active service with a valid public category is required to publish.",
        ],
      },
    };
    global.fetch.mockResolvedValue(
      new Response(JSON.stringify(statusPayload), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    const result = await getProfileStatus(7);

    expect(result.publish_readiness_errors).toEqual(
      statusPayload.publish_readiness_errors
    );
    expect(result.is_publish_ready).toBe(false);
  });

  it("surfaces field-level publish validation errors", async () => {
    global.fetch.mockResolvedValue(
      new Response(
        JSON.stringify({
          bio: ["Bio is required to publish."],
          services: [
            "At least one active service with a valid public category is required to publish.",
          ],
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      )
    );

    let err;
    try {
      await publishMyAccountantProfile();
    } catch (caught) {
      err = caught;
    }

    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe("Bio is required to publish.");
    expect(err.fields).toEqual({
      bio: "Bio is required to publish.",
      services:
        "At least one active service with a valid public category is required to publish.",
    });
    expect(apiFieldError(err, "bio")).toBe("Bio is required to publish.");
    expect(apiFieldError(err, "services")).toMatch(/valid public category/);
  });

  it("throws on authentication failures", async () => {
    global.fetch.mockResolvedValue(
      new Response(
        JSON.stringify({
          detail: "Authentication credentials were not provided.",
        }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }
      )
    );

    await expect(publishMyAccountantProfile()).rejects.toThrow(
      "Authentication credentials were not provided."
    );
  });

  it("throws on server failures when unpublishing", async () => {
    global.fetch.mockResolvedValue(
      new Response(JSON.stringify({ detail: "Internal server error." }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      })
    );

    await expect(unpublishMyAccountantProfile()).rejects.toThrow(
      "Internal server error."
    );
  });
});

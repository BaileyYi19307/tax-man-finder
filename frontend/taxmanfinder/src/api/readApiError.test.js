import { readApiError } from "./client";

describe("readApiError", () => {
  it("parses a DRF string detail", async () => {
    const res = new Response(
      JSON.stringify({ detail: "Unable to start checkout with the payment provider. Please try again shortly." }),
      { status: 502 }
    );
    const err = await readApiError(res, "fallback");
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe(
      "Unable to start checkout with the payment provider. Please try again shortly."
    );
  });

  it("parses a DRF list detail", async () => {
    const res = new Response(
      JSON.stringify({ detail: ["First problem.", "Second problem."] }),
      { status: 400 }
    );
    const err = await readApiError(res);
    expect(err.message).toBe("First problem. Second problem.");
  });

  it("parses a field error when detail is absent", async () => {
    const res = new Response(
      JSON.stringify({ non_field_errors: ["Invalid credentials."] }),
      { status: 400 }
    );
    const err = await readApiError(res);
    expect(err.message).toBe("Invalid credentials.");
  });

  it("falls back to status when the body is empty", async () => {
    const res = new Response("", { status: 503 });
    const err = await readApiError(res, "Could not start Stripe Checkout");
    expect(err.message).toBe("Could not start Stripe Checkout (503)");
  });

  it("uses raw text when the body is not JSON", async () => {
    const res = new Response("Gateway timeout", { status: 504 });
    const err = await readApiError(res);
    expect(err.message).toBe("Gateway timeout");
  });
});

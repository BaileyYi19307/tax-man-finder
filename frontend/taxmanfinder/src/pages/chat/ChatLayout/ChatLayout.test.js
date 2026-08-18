import { MemoryRouter } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import ChatLayout from "./ChatLayout";
import { apiFetch } from "../../../api/client";
import { ACCESS_TOKEN_KEY } from "../../../auth/session";

jest.mock("../../../api/client", () => ({
  apiFetch: jest.fn(),
}));

function renderInbox() {
  return render(
    <MemoryRouter>
      <ChatLayout />
    </MemoryRouter>
  );
}

beforeEach(() => {
  localStorage.clear();
  apiFetch.mockReset();
});

test("empty inbox is not treated as an error", async () => {
  localStorage.setItem(ACCESS_TOKEN_KEY, "token");
  apiFetch.mockResolvedValue({
    ok: true,
    json: async () => [],
    text: async () => "",
  });
  renderInbox();

  expect(await screen.findByText("No conversations yet")).toBeInTheDocument();
  expect(screen.queryByText("Could not load conversations.")).not.toBeInTheDocument();
});

test("failed inbox fetch does not look empty", async () => {
  localStorage.setItem(ACCESS_TOKEN_KEY, "token");
  apiFetch.mockResolvedValue({
    ok: false,
    json: async () => [],
    text: async () => "nope",
  });
  renderInbox();

  expect(await screen.findByText("Could not load conversations.")).toBeInTheDocument();
  expect(screen.queryByText("No conversations yet")).not.toBeInTheDocument();
});

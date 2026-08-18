import { MemoryRouter, Route, Routes } from "react-router-dom";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ConversationView from "./ConversationView";
import { useChatSocket } from "../../../hooks/hooks/useChatSocket";
import { apiFetch, listInquiryBookings } from "../../../api/client";

jest.mock("../../../hooks/hooks/useChatSocket", () => ({
  useChatSocket: jest.fn(),
}));

jest.mock("../../../api/client", () => ({
  apiFetch: jest.fn(),
  listInquiryBookings: jest.fn(),
  acceptBooking: jest.fn(),
  declineBooking: jest.fn(),
  cancelBooking: jest.fn(),
}));

function renderConversation() {
  return render(
    <MemoryRouter initialEntries={["/chat/9"]}>
      <Routes>
        <Route path="/chat/:inquiryId" element={<ConversationView />} />
      </Routes>
    </MemoryRouter>
  );
}

async function waitForHistory() {
  await waitFor(() => {
    expect(listInquiryBookings).toHaveBeenCalled();
  });
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("access_token", "token");
  localStorage.setItem("user_id", "5");
  window.HTMLElement.prototype.scrollIntoView = jest.fn();
  apiFetch.mockReset();
  listInquiryBookings.mockReset();
  useChatSocket.mockReset();
  apiFetch.mockImplementation(async (path) => {
    if (String(path).includes("mark-read")) {
      return { ok: true, json: async () => ({ last_read_at: null }) };
    }
    return {
      ok: true,
      json: async () => ({ messages: [], inquiry: { status: "open" } }),
    };
  });
  listInquiryBookings.mockResolvedValue([]);
});

test("failed send does not show the message as delivered", async () => {
  const sendMessage = jest.fn(() => false);
  useChatSocket.mockReturnValue({ sendMessage });
  renderConversation();
  await waitForHistory();

  userEvent.type(screen.getByPlaceholderText("Type a message…"), "Hello there");
  userEvent.click(screen.getByRole("button", { name: "Send" }));

  expect(sendMessage).toHaveBeenCalledWith("Hello there");
  expect(
    await screen.findByText("Message was not sent. Chat is not connected.")
  ).toBeInTheDocument();
  expect(screen.queryByText("Hello there")).not.toBeInTheDocument();
  expect(screen.getByPlaceholderText("Type a message…")).toHaveValue("Hello there");
});

test("successful send shows the outgoing message", async () => {
  const sendMessage = jest.fn(() => true);
  useChatSocket.mockReturnValue({ sendMessage });
  renderConversation();
  await waitForHistory();

  userEvent.type(screen.getByPlaceholderText("Type a message…"), "Hello there");
  userEvent.click(screen.getByRole("button", { name: "Send" }));

  expect(sendMessage).toHaveBeenCalledWith("Hello there");
  expect(await screen.findByText("Hello there")).toBeInTheDocument();
  expect(
    screen.queryByText("Message was not sent. Chat is not connected.")
  ).not.toBeInTheDocument();
});

import { MemoryRouter, Route, Routes } from "react-router-dom";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ConversationView from "./ConversationView";
import { useChatSocket } from "../../../hooks/hooks/useChatSocket";
import {
  apiFetch,
  listInquiryAttachments,
  listInquiryBookings,
  sendInquiryMessage,
} from "../../../api/client";

jest.mock("../../../hooks/hooks/useChatSocket", () => ({
  useChatSocket: jest.fn(),
}));

jest.mock("../../../api/client", () => ({
  apiFetch: jest.fn(),
  listInquiryBookings: jest.fn(),
  listInquiryAttachments: jest.fn(),
  sendInquiryMessage: jest.fn(),
  sendInquiryMessageWithFiles: jest.fn(),
  downloadInquiryAttachment: jest.fn(),
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
  listInquiryAttachments.mockReset();
  sendInquiryMessage.mockReset();
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
  listInquiryAttachments.mockResolvedValue([]);
});

test("failed send shows an error when websocket and HTTP both fail", async () => {
  const sendMessage = jest.fn(() => false);
  useChatSocket.mockReturnValue({ sendMessage });
  sendInquiryMessage.mockRejectedValue(new Error("network"));
  renderConversation();
  await waitForHistory();

  userEvent.type(screen.getByPlaceholderText("Type a message…"), "Hello there");
  userEvent.click(screen.getByRole("button", { name: "Send" }));

  expect(sendMessage).toHaveBeenCalledWith("Hello there");
  expect(sendInquiryMessage).toHaveBeenCalledWith("9", "Hello there");
  expect(
    await screen.findByText("Message was not sent. Please try again.")
  ).toBeInTheDocument();
  expect(screen.queryByText("Hello there")).not.toBeInTheDocument();
  expect(screen.getByPlaceholderText("Type a message…")).toHaveValue("Hello there");
});

test("falls back to HTTP when websocket is not connected", async () => {
  const sendMessage = jest.fn(() => false);
  useChatSocket.mockReturnValue({ sendMessage });
  sendInquiryMessage.mockResolvedValue({ message_id: 42 });
  renderConversation();
  await waitForHistory();

  userEvent.type(screen.getByPlaceholderText("Type a message…"), "Hello there");
  userEvent.click(screen.getByRole("button", { name: "Send" }));

  await waitFor(() => {
    expect(sendInquiryMessage).toHaveBeenCalledWith("9", "Hello there");
  });
  expect(await screen.findByText("Hello there")).toBeInTheDocument();
  expect(
    screen.queryByText("Message was not sent. Please try again.")
  ).not.toBeInTheDocument();
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

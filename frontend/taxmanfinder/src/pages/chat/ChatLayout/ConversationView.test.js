import { MemoryRouter, Route, Routes } from "react-router-dom";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ConversationView from "./ConversationView";
import { useChatSocket } from "../../../hooks/hooks/useChatSocket";
import {
  apiFetch,
  getPublicAccountantProfile,
  listInquiryAttachments,
  listInquiryBookings,
  requestConsultation,
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
  requestConsultation: jest.fn(),
  getPublicAccountantProfile: jest.fn(),
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
  requestConsultation.mockReset();
  getPublicAccountantProfile.mockReset();
  useChatSocket.mockReset();
  apiFetch.mockImplementation(async (path) => {
    if (String(path).includes("mark-read")) {
      return { ok: true, json: async () => ({ last_read_at: null }) };
    }
    return {
      ok: true,
      json: async () => ({
        messages: [],
        inquiry: { status: "open", client: 5, accountant: 22 },
      }),
    };
  });
  listInquiryBookings.mockResolvedValue([]);
  listInquiryAttachments.mockResolvedValue([]);
  getPublicAccountantProfile.mockResolvedValue({
    user_id: 22,
    services: [
      {
        id: 7,
        name: "Tax filing",
        consultation_fee: "50.00",
        cancellation_policy: "Cancel 24h ahead.",
      },
      {
        id: 8,
        name: "Intro call",
        consultation_fee: "0.00",
        cancellation_policy: "",
      },
    ],
  });
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

test("client can open request consultation from the conversation", async () => {
  useChatSocket.mockReturnValue({ sendMessage: jest.fn(() => true) });
  renderConversation();
  await waitForHistory();

  expect(
    await screen.findByRole("button", { name: "Request consultation" })
  ).toBeInTheDocument();
  userEvent.click(screen.getByRole("button", { name: "Request consultation" }));
  expect(await screen.findByRole("heading", { name: "Request consultation" })).toBeInTheDocument();
  expect(screen.getByLabelText("Service")).toBeInTheDocument();
  expect(screen.getByLabelText("Date and time")).toBeInTheDocument();
  expect(await screen.findByText(/Tax filing/)).toBeInTheDocument();
});

test("chat consultation requires a service and shows fee before submit", async () => {
  useChatSocket.mockReturnValue({ sendMessage: jest.fn(() => true) });
  requestConsultation.mockResolvedValue({
    inquiry_id: 9,
    booking: { id: 1 },
  });
  renderConversation();
  await waitForHistory();

  userEvent.click(
    await screen.findByRole("button", { name: "Request consultation" })
  );
  await screen.findByRole("heading", { name: "Request consultation" });
  await screen.findByRole("option", { name: /Tax filing/ });

  const modalSubmit = screen
    .getAllByRole("button", { name: "Request consultation" })
    .find((btn) => btn.className.includes("btn-primary"));
  expect(modalSubmit).toBeDisabled();

  userEvent.selectOptions(screen.getByLabelText("Service"), "7");
  expect(await screen.findByText(/Consultation fee:/)).toBeInTheDocument();
  expect(screen.getByText("$50.00")).toBeInTheDocument();
  expect(screen.getByText(/Cancel 24h ahead/)).toBeInTheDocument();

  // Still disabled until date + note are filled.
  expect(modalSubmit).toBeDisabled();

  fireEvent.change(screen.getByLabelText("Date and time"), {
    target: { value: "2030-06-01T10:00" },
  });
  fireEvent.change(screen.getByLabelText("Brief note"), {
    target: { value: "Need help with filings" },
  });
  await waitFor(() => {
    expect(modalSubmit).not.toBeDisabled();
  });

  userEvent.click(modalSubmit);
  await waitFor(() => {
    expect(requestConsultation).toHaveBeenCalledWith(
      expect.objectContaining({
        inquiry: 9,
        service: 7,
        content: "Need help with filings",
      })
    );
  });
});

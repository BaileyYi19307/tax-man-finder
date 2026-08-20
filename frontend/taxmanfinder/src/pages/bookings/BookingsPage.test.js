import { MemoryRouter } from "react-router-dom";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import BookingsPage from "./BookingsPage";
import { listMyBookings, cancelBooking } from "../../api/client";

jest.mock("../../api/client", () => ({
  listMyBookings: jest.fn(),
  acceptBooking: jest.fn(),
  declineBooking: jest.fn(),
  cancelBooking: jest.fn(),
}));

const booking = {
  id: 3,
  inquiry: 9,
  inquiry_id: 9,
  client: 5,
  client_email: "client@test.com",
  accountant: 22,
  accountant_email: "pro@test.com",
  starts_at: "2026-08-20T15:00:00.000Z",
  ends_at: "2026-08-20T15:30:00.000Z",
  status: "pending",
  status_label: "Pending",
  created_at: "2026-08-19T15:00:00.000Z",
  updated_at: "2026-08-19T15:00:00.000Z",
};

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("access_token", "token");
  localStorage.setItem("user_id", "5");
  listMyBookings.mockReset();
  cancelBooking.mockReset();
});

test("disables cancel while the request is in flight", async () => {
  let resolveCancel;
  const cancelled = {
    ...booking,
    status: "cancelled",
    status_label: "Cancelled",
  };
  listMyBookings
    .mockResolvedValueOnce([booking])
    .mockResolvedValueOnce([cancelled]);
  cancelBooking.mockImplementation(
    () =>
      new Promise((resolve) => {
        resolveCancel = resolve;
      })
  );

  render(
    <MemoryRouter>
      <BookingsPage />
    </MemoryRouter>
  );

  expect(await screen.findByText("Pending")).toBeInTheDocument();
  userEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(cancelBooking).toHaveBeenCalledWith(3);
  await waitFor(() => {
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
  });

  resolveCancel(cancelled);
  await waitFor(() => {
    expect(screen.queryByRole("button", { name: "Cancel" })).not.toBeInTheDocument();
  });
  expect(screen.getByText("Cancelled")).toBeInTheDocument();
});

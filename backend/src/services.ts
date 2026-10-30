import type {
  BookingRow,
  CreateBookingInput,
  BookingListItem,
} from "./repository/types";
import * as repository from "./repository";

const bookingTimes = [
  "09:00",
  "10:00",
  "11:00",
  "12:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
];

export async function getBookings(): Promise<BookingListItem[]> {
  return await repository.getBookings();
}

export async function createBooking(
  booking: CreateBookingInput,
): Promise<BookingRow> {
  return await repository.createBooking(booking);
}

export async function getAvailableSlots(date: string): Promise<string[]> {
  const bookedTimes = await repository.getBookedTimes(date);

  return bookingTimes.filter(
    (time) => !bookedTimes.some((bookedTime) => bookedTime.startsWith(time)),
  );
}

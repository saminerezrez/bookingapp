import type {
  Booking,
  BookingListItem,
  CreateBookingInput,
  Slot,
} from "./repository/types";
import * as repository from "./repository";
import {
  SLOT_TIMES,
  isInBookingWindow,
  isSlotInPast,
  isSlotTime,
  isValidDate,
  isWeekday,
} from "./domain/slots";
import { ApiError } from "./errors";

function assertBookableDate(date: string, now: Date) {
  if (!isValidDate(date) || !isInBookingWindow(date, now)) {
    throw new ApiError(
      400,
      "INVALID_DATE",
      "Date must be a valid date from today up to 30 days ahead",
    );
  }
}

export async function getBookings(): Promise<BookingListItem[]> {
  return await repository.getBookings();
}

export async function createBooking(
  booking: CreateBookingInput,
  now = new Date(),
): Promise<Booking> {
  assertBookableDate(booking.date, now);

  if (
    !isWeekday(booking.date) ||
    !isSlotTime(booking.startTime) ||
    isSlotInPast(booking.date, booking.startTime, now)
  ) {
    throw new ApiError(400, "INVALID_SLOT", "This time slot cannot be booked");
  }

  return await repository.createBooking({
    ...booking,
    name: booking.name.trim(),
  });
}

export async function getAvailableSlots(
  date: string,
  now = new Date(),
): Promise<Slot[]> {
  assertBookableDate(date, now);

  if (!isWeekday(date)) {
    return [];
  }

  const bookedTimes = await repository.getBookedTimes(date);

  return SLOT_TIMES.map((startTime) => ({
    startTime,
    available:
      !bookedTimes.includes(startTime) && !isSlotInPast(date, startTime, now),
  }));
}

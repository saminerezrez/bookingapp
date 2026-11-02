import { SQL, sql } from "bun";
import { ApiError } from "../errors";
import type { Booking, BookingRow, CreateBookingInput } from "./types";

const UNIQUE_VIOLATION = "23505";

export async function getBookings(): Promise<BookingRow[]> {
  const rows = await sql`
    SELECT *
    FROM bookings
    ORDER BY date, start_time
  `;

  return rows as BookingRow[];
}

export async function createBooking(
  booking: CreateBookingInput,
): Promise<Booking> {
  try {
    const rows = await sql`
      INSERT INTO bookings (name, date, start_time)
      VALUES (${booking.name}, ${booking.date}, ${booking.startTime})
      RETURNING
        id,
        name,
        to_char(date, 'YYYY-MM-DD') AS date,
        to_char(start_time, 'HH24:MI') AS "startTime"
    `;

    return rows[0] as Booking;
  } catch (error) {
    if (error instanceof SQL.PostgresError && error.errno === UNIQUE_VIOLATION) {
      throw new ApiError(409, "SLOT_TAKEN", "Slot is already booked");
    }

    throw error;
  }
}

export async function getBookedTimes(date: string): Promise<string[]> {
  const rows = (await sql`
    SELECT to_char(start_time, 'HH24:MI') AS "startTime"
    FROM bookings
    WHERE date = ${date}
  `) as { startTime: string }[];

  return rows.map((row) => row.startTime);
}

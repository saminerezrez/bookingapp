import { sql } from "bun";
import type { BookingRow, CreateBookingInput } from "./types";

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
): Promise<BookingRow> {
  const rows = await sql`
    INSERT INTO bookings (name, date, start_time)
    VALUES (${booking.name}, ${booking.date}, ${booking.start_time})
    RETURNING *
  `;

  return rows[0] as BookingRow;
}

export async function getBookedTimes(date: string): Promise<string[]> {
  const rows = (await sql`
    SELECT start_time
    FROM bookings
    WHERE date = ${date}
    ORDER BY start_time
  `) as { start_time: string }[];

  return rows.map((row) => row.start_time);
}

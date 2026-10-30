import { sql } from "bun";
import type { BookingRow } from "./types";

export async function getBookings(): Promise<BookingRow[]> {
  const rows = await sql`
        SELECT *
        FROM bookings
        ORDER BY date, start_time
    `;

  return rows as BookingRow[];
}

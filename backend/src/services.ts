import type { BookingRow } from "./repository/types";
import * as repository from "./repository";

export async function getBookings(): Promise<BookingRow[]> {
  return await repository.getBookings();
}

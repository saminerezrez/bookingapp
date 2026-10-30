export type BookingRow = {
  id: string;
  name: string;
  date: string;
  start_time: string;
  created_at: Date;
};

export type CreateBookingInput = {
  name: string;
  date: string;
  start_time: string;
};

export type BookingListItem = {
  id: string;
  date: string;
  start_time: string;
  created_at: Date;
};

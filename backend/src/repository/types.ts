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
  startTime: string;
};

export type Booking = CreateBookingInput & {
  id: string;
};

export type Slot = {
  startTime: string;
  available: boolean;
};

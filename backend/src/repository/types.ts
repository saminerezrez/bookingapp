export type CreateBookingInput = {
  name: string;
  date: string;
  startTime: string;
};

export type Booking = CreateBookingInput & {
  id: string;
};

export type BookingListItem = Omit<Booking, "name">;

export type Slot = {
  startTime: string;
  available: boolean;
};

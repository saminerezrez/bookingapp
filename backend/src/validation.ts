export function isValidBookingName(name: string) {
  return name.trim().length >= 1 && name.trim().length <= 100;
}

export function isValidBookingDate(date: string) {
  return date.trim().length > 0;
}

export function isValidBookingTime(startTime: string) {
  return startTime.trim().length > 0;
}

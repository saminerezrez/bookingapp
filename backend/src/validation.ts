export function isValidBookingName(name: string) {
  return name.trim().length >= 1 && name.trim().length <= 100;
}

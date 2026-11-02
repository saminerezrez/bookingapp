import { describe, expect, test } from "bun:test";
import { isValidBookingName } from "./validation";

describe("isValidBookingName", () => {
  test("returns true for a valid name", () => {
    expect(isValidBookingName("Sofie")).toBe(true);
  });

  test("returns false for an empty name", () => {
    expect(isValidBookingName("")).toBe(false);
  });

  test("returns false for a name longer than 100 characters", () => {
    expect(isValidBookingName("a".repeat(101))).toBe(false);
  });
});

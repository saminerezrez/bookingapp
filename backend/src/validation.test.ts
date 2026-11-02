import { describe, expect, test } from "bun:test";
import {
  isValidBookingName,
  isValidBookingDate,
  isValidBookingTime,
} from "./validation";

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

describe("isValidBookingDate", () => {
  test("returns true for a date", () => {
    expect(isValidBookingDate("2026-11-03")).toBe(true);
  });

  test("returns false for an empty date", () => {
    expect(isValidBookingDate("")).toBe(false);
  });
});

describe("isValidBookingTime", () => {
  test("returns true for a time", () => {
    expect(isValidBookingTime("10:00")).toBe(true);
  });

  test("returns false for an empty time", () => {
    expect(isValidBookingTime("")).toBe(false);
  });
});

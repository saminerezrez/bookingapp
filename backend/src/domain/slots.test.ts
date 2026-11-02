import { describe, expect, test } from "bun:test";
import {
  isInBookingWindow,
  isSlotInPast,
  isSlotTime,
  isValidDate,
  isWeekday,
} from "./slots";

// 2026-11-09 is a Monday. 10:30 UTC is 11:30 in Stockholm (UTC+1 in November).
const now = new Date("2026-11-09T10:30:00Z");

describe("isValidDate", () => {
  test("accepts a real date", () => {
    expect(isValidDate("2026-11-09")).toBe(true);
  });

  test("rejects bad formats and impossible dates", () => {
    expect(isValidDate("banana")).toBe(false);
    expect(isValidDate("2026-11-9")).toBe(false);
    expect(isValidDate("2026-02-31")).toBe(false);
  });
});

describe("isWeekday", () => {
  test("accepts Monday and Friday", () => {
    expect(isWeekday("2026-11-09")).toBe(true);
    expect(isWeekday("2026-11-13")).toBe(true);
  });

  test("rejects Saturday and Sunday", () => {
    expect(isWeekday("2026-11-14")).toBe(false);
    expect(isWeekday("2026-11-15")).toBe(false);
  });
});

describe("isSlotTime", () => {
  test("accepts on-the-hour times within opening hours", () => {
    expect(isSlotTime("09:00")).toBe(true);
    expect(isSlotTime("16:00")).toBe(true);
  });

  test("rejects times outside opening hours", () => {
    expect(isSlotTime("08:00")).toBe(false);
    expect(isSlotTime("17:00")).toBe(false);
  });

  test("rejects times that are not on the hour", () => {
    expect(isSlotTime("09:30")).toBe(false);
    expect(isSlotTime("09:00:30")).toBe(false);
  });
});

describe("isInBookingWindow", () => {
  test("accepts today and 30 days ahead", () => {
    expect(isInBookingWindow("2026-11-09", now)).toBe(true);
    expect(isInBookingWindow("2026-12-09", now)).toBe(true);
  });

  test("rejects yesterday and 31 days ahead", () => {
    expect(isInBookingWindow("2026-11-08", now)).toBe(false);
    expect(isInBookingWindow("2026-12-10", now)).toBe(false);
  });

  test("uses the Stockholm date, not the UTC date", () => {
    // 23:30 UTC on the 9th is already 00:30 on the 10th in Stockholm.
    const lateEvening = new Date("2026-11-09T23:30:00Z");

    expect(isInBookingWindow("2026-11-09", lateEvening)).toBe(false);
    expect(isInBookingWindow("2026-11-10", lateEvening)).toBe(true);
  });
});

describe("isSlotInPast", () => {
  test("slots earlier today are in the past", () => {
    expect(isSlotInPast("2026-11-09", "11:00", now)).toBe(true);
  });

  test("slots later today and on later days are not", () => {
    expect(isSlotInPast("2026-11-09", "12:00", now)).toBe(false);
    expect(isSlotInPast("2026-11-10", "09:00", now)).toBe(false);
  });
});

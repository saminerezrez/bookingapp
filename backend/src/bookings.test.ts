import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { sql } from "bun";
import { buildApp } from "./app";

const app = buildApp();

function daysFromToday(days: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);

  return date.toISOString().slice(0, 10);
}

// The next Monday is always a bookable weekday inside the 30-day window.
function nextMonday() {
  return daysFromToday((8 - new Date().getUTCDay()) % 7 || 7);
}

function nextSaturday() {
  return daysFromToday((6 - new Date().getUTCDay() + 7) % 7 || 7);
}

function postBooking(payload: object) {
  return app.inject({ method: "POST", url: "/bookings", payload });
}

beforeAll(() => {
  const migrate = Bun.spawnSync(["bunx", "dbmate", "--no-dump-schema", "up"], {
    env: process.env,
  });

  if (migrate.exitCode !== 0) {
    throw new Error(`dbmate up failed: ${migrate.stderr.toString()}`);
  }
});

beforeEach(async () => {
  await sql`TRUNCATE bookings`;
});

afterAll(async () => {
  await app.close();
});

describe("POST /bookings", () => {
  test("creates a booking", async () => {
    const date = nextMonday();

    const response = await postBooking({ name: " Sofie ", date, startTime: "10:00" });

    expect(response.statusCode).toBe(201);
    expect(response.json().booking).toMatchObject({
      name: "Sofie",
      date,
      startTime: "10:00",
    });
  });

  test("returns 409 SLOT_TAKEN when the slot is booked", async () => {
    const booking = { name: "Sofie", date: nextMonday(), startTime: "10:00" };

    await postBooking(booking);
    const response = await postBooking(booking);

    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe("SLOT_TAKEN");
  });

  test("10 concurrent requests for one slot give exactly one 201", async () => {
    const booking = { name: "Sofie", date: nextMonday(), startTime: "11:00" };

    const responses = await Promise.all(
      Array.from({ length: 10 }, () => postBooking(booking)),
    );
    const codes = responses.map((response) => response.statusCode).sort();

    expect(codes).toEqual([201, ...Array(9).fill(409)]);
  });

  test.each([
    ["a weekend", nextSaturday(), "10:00", "INVALID_SLOT"],
    ["outside opening hours", nextMonday(), "17:00", "INVALID_SLOT"],
    ["not on the hour", nextMonday(), "09:30", "INVALID_SLOT"],
    ["with seconds", nextMonday(), "09:00:30", "INVALID_SLOT"],
    ["in the past", daysFromToday(-1), "10:00", "INVALID_DATE"],
    ["beyond the window", daysFromToday(32), "10:00", "INVALID_DATE"],
    ["a bad date", "banana", "10:00", "INVALID_DATE"],
  ])("rejects %s", async (_, date, startTime, code) => {
    const response = await postBooking({ name: "Sofie", date, startTime });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe(code);
  });
});

describe("GET /bookings", () => {
  test("returns booked slots without names", async () => {
    const date = nextMonday();
    const created = await postBooking({ name: "Sofie", date, startTime: "10:00" });

    const response = await app.inject({ method: "GET", url: "/bookings" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      bookings: [{ id: created.json().booking.id, date, startTime: "10:00" }],
    });
    expect(response.body).not.toContain("Sofie");
  });
});

describe("GET /available-slots", () => {
  test("marks a booked slot as unavailable", async () => {
    const date = nextMonday();
    await postBooking({ name: "Sofie", date, startTime: "10:00" });

    const response = await app.inject({
      method: "GET",
      url: `/available-slots?date=${date}`,
    });
    const { slots } = response.json();

    expect(response.statusCode).toBe(200);
    expect(slots).toHaveLength(8);
    expect(slots[0]).toEqual({ startTime: "09:00", available: true });
    expect(slots[1]).toEqual({ startTime: "10:00", available: false });
  });

  test("returns no slots on a weekend", async () => {
    const date = nextSaturday();

    const response = await app.inject({
      method: "GET",
      url: `/available-slots?date=${date}`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ date, slots: [] });
  });

  test.each(["banana", daysFromToday(-1), daysFromToday(32)])(
    "rejects %s",
    async (date) => {
      const response = await app.inject({
        method: "GET",
        url: `/available-slots?date=${date}`,
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe("INVALID_DATE");
    },
  );
});

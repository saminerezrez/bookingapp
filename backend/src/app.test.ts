import { describe, expect, test } from "bun:test";
import { buildApp } from "./app";

describe("GET /version", () => {
  test("returns app version", async () => {
    const app = buildApp();

    const response = await app.inject({
      method: "GET",
      url: "/version",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      version: "dev",
    });

    await app.close();
  });
});

describe("Booking API", () => {
  test("returns 400 for invalid booking data", async () => {
    const app = buildApp();

    const response = await app.inject({
      method: "POST",
      url: "/bookings",
      payload: {
        name: "",
        date: "2026-11-03",
        start_time: "11:00",
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: {
        message: "Invalid booking data",
        code: "INVALID_BOOKING",
      },
    });

    await app.close();
  });

  test("returns 400 when date is missing for available slots", async () => {
    const app = buildApp();

    const response = await app.inject({
      method: "GET",
      url: "/available-slots",
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: {
        message: "Date is required",
        code: "INVALID_DATE",
      },
    });

    await app.close();
  });
});

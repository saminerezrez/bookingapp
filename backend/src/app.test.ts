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

describe("error format", () => {
  test("unknown routes use the shared format", async () => {
    const app = buildApp();

    const response = await app.inject({
      method: "GET",
      url: "/does-not-exist",
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      error: {
        message: "Route not found",
        code: "NOT_FOUND",
      },
    });

    await app.close();
  });

  test("invalid JSON uses the shared format", async () => {
    const app = buildApp();
    app.post("/echo", async () => ({}));

    const response = await app.inject({
      method: "POST",
      url: "/echo",
      headers: { "content-type": "application/json" },
      payload: "{bad",
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe("FST_ERR_CTP_INVALID_JSON_BODY");

    await app.close();
  });

  test("unexpected errors hide their details from the client", async () => {
    const app = buildApp();
    app.get("/boom", async () => {
      throw new Error("secret SQL details");
    });

    const response = await app.inject({
      method: "GET",
      url: "/boom",
    });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({
      error: {
        message: "Internal server error",
        code: "INTERNAL_ERROR",
      },
    });

    await app.close();
  });
});

describe("GET /metrics", () => {
  test("responds with Prometheus text", async () => {
    const app = buildApp();

    const response = await app.inject({
      method: "GET",
      url: "/metrics",
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).toContain("bookingapp_up 1");

    await app.close();
  });
});

describe("request validation", () => {
  const invalidBodies = [
    ["no body", undefined],
    ["empty name", { name: "", date: "2026-11-09", startTime: "10:00" }],
    ["whitespace name", { name: "   ", date: "2026-11-09", startTime: "10:00" }],
    ["long name", { name: "a".repeat(101), date: "2026-11-09", startTime: "10:00" }],
    ["missing startTime", { name: "Sofie", date: "2026-11-09" }],
  ] as const;

  test.each(invalidBodies)("POST /bookings rejects %s", async (_, payload) => {
    const app = buildApp();

    const response = await app.inject({
      method: "POST",
      url: "/bookings",
      ...(payload ? { payload } : {}),
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe("FST_ERR_VALIDATION");

    await app.close();
  });

  test("GET /available-slots requires a date", async () => {
    const app = buildApp();

    const response = await app.inject({
      method: "GET",
      url: "/available-slots",
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe("FST_ERR_VALIDATION");

    await app.close();
  });
});

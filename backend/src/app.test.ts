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

import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { app } from "../app.js";
import { pool } from "../db/pool.js";

describe("GET /api/v1/health (Integration)", () => {
  afterAll(async () => {
    await pool.end();
  });

  it("should return 200 OK and database connected status", async () => {
    const response = await request(app).get("/api/v1/health");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("status", "ok");
    expect(response.body).toHaveProperty("database", "connected");
    expect(response.body).toHaveProperty("timestamp");
    expect(new Date(response.body.timestamp).toISOString()).toBe(response.body.timestamp);
  });

  it("should return 404 for unknown routes", async () => {
    const response = await request(app).get("/api/v1/unknown-endpoint");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      error: {
        code: "NOT_FOUND",
        message: "The requested API endpoint was not found.",
        details: null,
      },
    });
  });
});

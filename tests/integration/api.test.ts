import { describe, it, expect } from "vitest";

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:5000";

describe("Integration: Health Check", () => {
  it("GET /api/health returns 200 with status ok", async () => {
    const res = await fetch(`${BASE_URL}/api/health`);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(body.timestamp).toBeDefined();
    expect(typeof body.uptime).toBe("number");
    expect(body.database).toBe("connected");
  });

  it("GET /api/health includes X-Request-Id header", async () => {
    const res = await fetch(`${BASE_URL}/api/health`);
    const requestId = res.headers.get("x-request-id");
    expect(requestId).toBeDefined();
    expect(requestId!.length).toBeGreaterThan(0);
  });
});

describe("Integration: Security Headers", () => {
  it("responses include Helmet security headers", async () => {
    const res = await fetch(`${BASE_URL}/api/health`);
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("x-frame-options")).toBe("SAMEORIGIN");
    expect(res.headers.get("x-dns-prefetch-control")).toBe("off");
  });
});

describe("Integration: CSRF Protection", () => {
  it("POST without JSON content-type returns 415", async () => {
    const res = await fetch(`${BASE_URL}/api/projects`, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: "test",
    });
    expect(res.status).toBe(415);

    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("UNSUPPORTED_MEDIA_TYPE");
  });

  it("POST with JSON content-type passes CSRF check", async () => {
    const res = await fetch(`${BASE_URL}/api/projects`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "test" }),
    });
    expect(res.status).not.toBe(415);
  });
});

describe("Integration: Authentication Guard", () => {
  it("protected endpoint without auth returns 401", async () => {
    const res = await fetch(`${BASE_URL}/api/projects`, {
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status).toBe(401);
  });
});

describe("Integration: Error Response Format", () => {
  it("error responses use { success: false, error: { code, message } }", async () => {
    const res = await fetch(`${BASE_URL}/api/projects`, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: "test",
    });

    const body = await res.json();
    expect(body).toHaveProperty("success", false);
    expect(body).toHaveProperty("error");
    expect(body.error).toHaveProperty("code");
    expect(body.error).toHaveProperty("message");
    expect(typeof body.error.code).toBe("string");
    expect(typeof body.error.message).toBe("string");
  });
});

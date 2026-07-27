/** @vitest-environment node */

import { describe, expect, it, vi, beforeEach } from "vitest";
import { GET } from "@/app/api/health/route";

const connectToDatabaseMock = vi.hoisted(() => vi.fn());
const getApiErrorMessageMock = vi.hoisted(() => vi.fn(() => "db error"));
const getOrCreateRequestIdMock = vi.hoisted(() => vi.fn(() => "req-test-id"));
const logApiErrorMock = vi.hoisted(() => vi.fn());

vi.mock("@/app/_lib/mongoose", () => ({
  connectToDatabase: connectToDatabaseMock,
}));

vi.mock("@/app/_lib/api-error", () => ({
  getApiErrorMessage: getApiErrorMessageMock,
  getOrCreateRequestId: getOrCreateRequestIdMock,
  logApiError: logApiErrorMock,
}));

describe("GET /api/health", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns healthy response on successful connection", async () => {
    connectToDatabaseMock.mockResolvedValue(undefined);

    const response = await GET(new Request("http://localhost/api/health"));
    const body = (await response.json()) as {
      ok: boolean;
      requestId: string;
      message: string;
      timestamp: string;
    };

    expect(response.status).toBe(200);
    expect(response.headers.get("x-request-id")).toBe("req-test-id");
    expect(body.ok).toBe(true);
    expect(body.requestId).toBe("req-test-id");
    expect(body.message).toMatch(/healthy/i);
    expect(Date.parse(body.timestamp)).not.toBeNaN();
  });

  it("returns failure response when connection throws", async () => {
    connectToDatabaseMock.mockRejectedValue(new Error("down"));

    const response = await GET(new Request("http://localhost/api/health"));
    const body = (await response.json()) as {
      ok: boolean;
      requestId: string;
      message: string;
      error: string;
    };

    expect(response.status).toBe(500);
    expect(response.headers.get("x-request-id")).toBe("req-test-id");
    expect(body.ok).toBe(false);
    expect(body.requestId).toBe("req-test-id");
    expect(body.message).toMatch(/failed/i);
    expect(body.error).toBe("db error");
    expect(logApiErrorMock).toHaveBeenCalledTimes(1);
  });
});

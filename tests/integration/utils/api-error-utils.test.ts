/** @vitest-environment node */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  getApiErrorMessage,
  getOrCreateRequestId,
  logApiError,
} from "@/app/_lib/api-error";

describe("api error utilities", () => {
  const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    errorSpy.mockClear();
  });

  it("returns existing request id from headers", () => {
    const request = new Request("http://localhost", {
      headers: { "x-request-id": "req-1" },
    });

    expect(getOrCreateRequestId(request)).toBe("req-1");
  });

  it("creates request id when missing", () => {
    const request = new Request("http://localhost");
    const id = getOrCreateRequestId(request);

    expect(id).toBeTruthy();
    expect(typeof id).toBe("string");
  });

  it("extracts error message when Error is provided", () => {
    expect(getApiErrorMessage(new Error("boom"), "fallback")).toBe("boom");
  });

  it("returns fallback for non Error inputs", () => {
    expect(getApiErrorMessage("oops", "fallback")).toBe("fallback");
  });

  it("logs structured error payload", () => {
    logApiError({
      route: "/api/demo",
      method: "GET",
      error: new Error("structured"),
      requestId: "req-123",
      context: { a: 1 },
    });

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith(
      "[api-error]",
      expect.objectContaining({
        requestId: "req-123",
        route: "/api/demo",
        method: "GET",
        message: "structured",
        context: { a: 1 },
      }),
    );
  });
});

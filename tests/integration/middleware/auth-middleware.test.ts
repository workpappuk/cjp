/** @vitest-environment node */

import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";

const getTokenMock = vi.hoisted(() => vi.fn());

vi.mock("next-auth/jwt", () => ({
  getToken: getTokenMock,
}));

describe("proxy auth and redirects", () => {
  it("allows public testing routes", async () => {
    const request = new NextRequest("http://localhost/testing/public/welcome");
    const response = await proxy(request);

    expect(response.status).toBe(200);
  });

  it("redirects unauthenticated protected requests", async () => {
    getTokenMock.mockResolvedValueOnce(null);

    const request = new NextRequest("http://localhost/testing/protected");
    const response = await proxy(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("callbackUrl=%2Ftesting%2Fprotected");
  });

  it("blocks non-admin access to admin protected route", async () => {
    getTokenMock.mockResolvedValueOnce({ sub: "user-1", role: "user" });

    const request = new NextRequest("http://localhost/testing/protected/admin");
    const response = await proxy(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/testing/protected");
  });

  it("sets auth headers and cookies for authenticated requests", async () => {
    getTokenMock.mockResolvedValueOnce({ sub: "admin-1", role: "admin", isAdmin: true });

    const request = new NextRequest("http://localhost/testing/protected/admin");
    const response = await proxy(request);

    expect(response.status).toBe(200);
    expect(response.headers.get("x-test-auth")).toBe("authenticated");
    expect(response.cookies.get("tf-test-sub")?.value).toBe("admin-1");
  });
});

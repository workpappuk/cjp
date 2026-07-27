/** @vitest-environment node */

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { GET, PUT } from "@/app/api/user-profile/route";
import { UserProfileModel } from "@/app/_lib/models/UserProfile";
import { createMockRequest } from "@/tests/utils/test-helpers";
import {
  cleanupDatabase,
  createTestDatabase,
  resetDatabase,
  seedDatabase,
} from "@/tests/setup/setupDb";

const getServerSessionMock = vi.hoisted(() => vi.fn());
const rateLimitMock = vi.hoisted(() => vi.fn());

vi.mock("next-auth", () => ({
  getServerSession: getServerSessionMock,
}));

vi.mock("@/app/_lib/rate-limit", () => ({
  checkRateLimit: rateLimitMock,
}));

describe("user-profile route", () => {
  beforeAll(async () => {
    await createTestDatabase();
  });

  beforeEach(async () => {
    await resetDatabase();
    await seedDatabase();

    getServerSessionMock.mockResolvedValue({
      user: {
        email: "user@test.threadforge.dev",
        name: "Standard User",
        image: "https://example.com/avatar.png",
      },
      provider: "google",
    });

    rateLimitMock.mockResolvedValue({
      allowed: true,
      remaining: 100,
      retryAfterSeconds: 1,
    });
  });

  afterAll(async () => {
    await cleanupDatabase();
  });

  it("GET returns 401 without session", async () => {
    getServerSessionMock.mockResolvedValueOnce(null);

    const response = await GET(createMockRequest("http://localhost/api/user-profile"));
    expect(response.status).toBe(401);
  });

  it("GET returns normalized profile payload for authenticated user", async () => {
    getServerSessionMock.mockResolvedValueOnce({
      user: {
        email: "NewUser@Test.ThreadForge.dev",
        name: "New User",
        image: "https://example.com/new.png",
      },
      provider: "google",
    });

    const response = await GET(createMockRequest("http://localhost/api/user-profile"));
    expect(response.status).toBe(200);

    const payload = (await response.json()) as {
      email: string;
      name: string;
      provider: string;
      joinedCommunities: string[];
      requestId: string;
    };

    expect(payload.email).toBe("newuser@test.threadforge.dev");
    expect(payload.name).toBe("New User");
    expect(payload.provider).toBe("google");
    expect(Array.isArray(payload.joinedCommunities)).toBe(true);
    expect(payload.requestId).toBeTruthy();
  });

  it("PUT returns 429 when rate-limited", async () => {
    rateLimitMock.mockResolvedValueOnce({
      allowed: false,
      remaining: 0,
      retryAfterSeconds: 33,
    });

    const response = await PUT(
      createMockRequest("http://localhost/api/user-profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Any" }),
      }),
    );

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("33");
  });

  it("PUT validates image URL", async () => {
    const response = await PUT(
      createMockRequest("http://localhost/api/user-profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Standard User",
          image: "not-a-url",
          bio: "Hello",
        }),
      }),
    );

    expect(response.status).toBe(400);
    const payload = (await response.json()) as { error: string };
    expect(payload.error).toMatch(/valid http\(s\) URL/i);
  });

  it("PUT validates bio max length", async () => {
    const response = await PUT(
      createMockRequest("http://localhost/api/user-profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bio: "x".repeat(501),
        }),
      }),
    );

    expect(response.status).toBe(400);
    const payload = (await response.json()) as { error: string };
    expect(payload.error).toMatch(/500 characters or fewer/i);
  });

  it("PUT updates joined communities using community names", async () => {
    const response = await PUT(
      createMockRequest("http://localhost/api/user-profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Updated User",
          image: "https://example.com/updated.png",
          bio: "Updated bio",
          joinedCommunities: ["general"],
        }),
      }),
    );

    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      name: string;
      bio: string;
      joinedCommunities: string[];
    };

    expect(payload.name).toBe("Updated User");
    expect(payload.bio).toBe("Updated bio");
    expect(payload.joinedCommunities).toContain("general");

    const persisted = await UserProfileModel.findOne({ email: "user@test.threadforge.dev" }).lean();
    expect(persisted).toBeTruthy();
    expect(Array.isArray(persisted?.joinedCommunities)).toBe(true);
    expect((persisted?.joinedCommunities ?? []).length).toBeGreaterThan(0);
  });
});

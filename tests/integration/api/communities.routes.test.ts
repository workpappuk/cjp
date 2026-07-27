/** @vitest-environment node */

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as getCommunities, POST as createCommunity } from "@/app/api/communities/route";
import { CommunityModel } from "@/app/_lib/models/Community";
import { UserProfileModel } from "@/app/_lib/models/UserProfile";
import { createMockRequest } from "@/tests/utils/test-helpers";
import {
  cleanupDatabase,
  createTestDatabase,
  resetDatabase,
  seedDatabase,
} from "@/tests/setup/setupDb";

const actorMock = vi.hoisted(() => vi.fn());
const rateLimitMock = vi.hoisted(() => vi.fn());

vi.mock("@/app/_lib/admin", () => ({
  getSessionActor: actorMock,
}));

vi.mock("@/app/_lib/rate-limit", () => ({
  checkRateLimit: rateLimitMock,
}));

describe("communities route", () => {
  beforeAll(async () => {
    await createTestDatabase();
  });

  beforeEach(async () => {
    await resetDatabase();
    await seedDatabase();
    actorMock.mockResolvedValue({
      email: "user@test.threadforge.dev",
      isAdmin: false,
      profileId: null,
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

  it("GET returns only approved communities for non-admin", async () => {
    const user = await UserProfileModel.findOne({ email: "user@test.threadforge.dev" }).lean();

    await CommunityModel.create({
      name: "pending-one",
      createdBy: user?._id,
      lastUpdatedBy: user?._id,
      moderationStatus: "pending",
    });

    const response = await getCommunities(
      createMockRequest("http://localhost/api/communities"),
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as Array<{ name: string; moderationStatus: string }>;

    expect(body.some((item) => item.name === "general")).toBe(true);
    expect(body.some((item) => item.name === "pending-one")).toBe(false);
  });

  it("GET search filters communities by name", async () => {
    const user = await UserProfileModel.findOne({ email: "user@test.threadforge.dev" }).lean();

    await CommunityModel.create({
      name: "gaming",
      createdBy: user?._id,
      lastUpdatedBy: user?._id,
      moderationStatus: "approved",
      approvedAt: new Date(),
    });

    const response = await getCommunities(
      createMockRequest("http://localhost/api/communities?search=gam"),
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as Array<{ name: string }>;

    expect(body.some((item) => item.name === "gaming")).toBe(true);
    expect(body.some((item) => item.name === "general")).toBe(false);
  });

  it("POST validates minimum name length", async () => {
    const response = await createCommunity(
      createMockRequest("http://localhost/api/communities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "ab" }),
      }),
    );

    expect(response.status).toBe(400);
  });

  it("POST returns conflict when community already exists", async () => {
    const response = await createCommunity(
      createMockRequest("http://localhost/api/communities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "general" }),
      }),
    );

    expect(response.status).toBe(409);
  });

  it("POST creates pending community for non-admin actor", async () => {
    const response = await createCommunity(
      createMockRequest("http://localhost/api/communities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "newcommunity" }),
      }),
    );

    expect(response.status).toBe(201);

    const payload = (await response.json()) as { id: string; moderationStatus: string };
    expect(payload.moderationStatus).toBe("pending");

    const persisted = await CommunityModel.findById(payload.id).lean();
    expect(persisted?.name).toBe("newcommunity");
  });

  it("POST creates approved community for admin actor", async () => {
    actorMock.mockResolvedValueOnce({
      email: "admin@test.threadforge.dev",
      isAdmin: true,
      profileId: null,
    });

    const response = await createCommunity(
      createMockRequest("http://localhost/api/communities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "admincreated" }),
      }),
    );

    expect(response.status).toBe(201);

    const payload = (await response.json()) as { moderationStatus: string };
    expect(payload.moderationStatus).toBe("approved");
  });

  it("POST returns 429 when rate limit denies request", async () => {
    rateLimitMock.mockResolvedValueOnce({
      allowed: false,
      remaining: 0,
      retryAfterSeconds: 42,
    });

    const response = await createCommunity(
      createMockRequest("http://localhost/api/communities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "ratelimited" }),
      }),
    );

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("42");
  });
});

/** @vitest-environment node */

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { GET, PATCH } from "@/app/api/communities/[community]/route";
import { CommunityModel } from "@/app/_lib/models/Community";
import { createMockRequest } from "@/tests/utils/test-helpers";
import {
  cleanupDatabase,
  createTestDatabase,
  resetDatabase,
  seedDatabase,
} from "@/tests/setup/setupDb";

const actorMock = vi.hoisted(() => vi.fn());

vi.mock("@/app/_lib/admin", () => ({
  getSessionActor: actorMock,
}));

describe("community detail route", () => {
  beforeAll(async () => {
    await createTestDatabase();
  });

  beforeEach(async () => {
    await resetDatabase();
    await seedDatabase();
  });

  afterAll(async () => {
    await cleanupDatabase();
  });

  it("GET returns community detail payload", async () => {
    actorMock.mockResolvedValueOnce({
      email: "user@test.threadforge.dev",
      isAdmin: false,
      profileId: null,
    });

    const response = await GET(
      createMockRequest("http://localhost/api/communities/general"),
      { params: Promise.resolve({ community: "general" }) },
    );

    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      name: string;
      tags?: string[];
      bannerImageUrl?: string;
      titleImageUrl?: string;
      createdBy?: string;
    };

    expect(payload.name).toBe("general");
    expect(Array.isArray(payload.tags)).toBe(true);
    expect(typeof payload.bannerImageUrl).toBe("string");
    expect(typeof payload.titleImageUrl).toBe("string");
    expect(typeof payload.createdBy).toBe("string");
  });

  it("PATCH returns 403 for non-owner", async () => {
    actorMock.mockResolvedValueOnce({
      email: "admin@test.threadforge.dev",
      isAdmin: true,
      profileId: null,
    });

    const response = await PATCH(
      createMockRequest("http://localhost/api/communities/general", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bannerImageUrl: "/uploads/community/2026/07/new-banner.jpg",
        }),
      }),
      { params: Promise.resolve({ community: "general" }) },
    );

    expect(response.status).toBe(403);
  });

  it("PATCH updates banner/title images for owner and sanitizes invalid scoped URLs", async () => {
    actorMock.mockResolvedValueOnce({
      email: "user@test.threadforge.dev",
      isAdmin: false,
      profileId: null,
    });

    const response = await PATCH(
      createMockRequest("http://localhost/api/communities/general", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bannerImageUrl: "/uploads/community/2026/07/valid-banner.jpg",
          titleImageUrl: "/uploads/post/2026/07/not-allowed.jpg",
        }),
      }),
      { params: Promise.resolve({ community: "general" }) },
    );

    expect(response.status).toBe(200);

    const payload = (await response.json()) as {
      bannerImageUrl: string;
      titleImageUrl: string;
    };

    expect(payload.bannerImageUrl).toBe("/uploads/community/2026/07/valid-banner.jpg");
    expect(payload.titleImageUrl).toBe("");

    const persisted = await CommunityModel.findOne({ name: "general" }).lean();
    expect(persisted?.bannerImageUrl).toBe("/uploads/community/2026/07/valid-banner.jpg");
    expect(persisted?.titleImageUrl).toBe("");
  });
});

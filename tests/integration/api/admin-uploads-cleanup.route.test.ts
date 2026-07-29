/** @vitest-environment node */

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as cleanupUploads } from "@/app/api/admin/uploads/cleanup/route";
import { CommunityModel } from "@/app/_lib/models/Community";
import { CommentModel } from "@/app/_lib/models/Comment";
import { PostModel } from "@/app/_lib/models/Post";
import { createMockRequest } from "@/tests/utils/test-helpers";
import {
  cleanupDatabase,
  createTestDatabase,
  resetDatabase,
  seedDatabase,
} from "@/tests/setup/setupDb";

const actorMock = vi.hoisted(() => vi.fn());
const listStoredUploadUrlsMock = vi.hoisted(() => vi.fn());
const deleteStoredUploadUrlMock = vi.hoisted(() => vi.fn());

vi.mock("@/app/_lib/admin", () => ({
  getSessionActor: actorMock,
}));

vi.mock("@/app/_lib/media-storage", async () => {
  const actual = await vi.importActual<typeof import("@/app/_lib/media-storage")>("@/app/_lib/media-storage");

  return {
    ...actual,
    listStoredUploadUrls: listStoredUploadUrlsMock,
    deleteStoredUploadUrl: deleteStoredUploadUrlMock,
  };
});

describe("admin uploads cleanup route", () => {
  beforeAll(async () => {
    await createTestDatabase();
  });

  beforeEach(async () => {
    await resetDatabase();
    await seedDatabase();

    vi.clearAllMocks();

    actorMock.mockResolvedValue({
      email: "admin@test.threadforge.dev",
      isAdmin: true,
      profileId: null,
    });

    deleteStoredUploadUrlMock.mockResolvedValue(true);
  });

  afterAll(async () => {
    await cleanupDatabase();
  });

  it("returns 403 for non-admin actor", async () => {
    actorMock.mockResolvedValueOnce({
      email: "user@test.threadforge.dev",
      isAdmin: false,
      profileId: null,
    });

    const response = await cleanupUploads(
      createMockRequest("http://localhost/api/admin/uploads/cleanup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope: "all", dryRun: true }),
      }),
    );

    expect(response.status).toBe(403);
  });

  it("dry-run reports orphaned files but does not delete referenced files", async () => {
    const post = await PostModel.findOne({ title: "Seed Post" });
    const community = await CommunityModel.findOne({ name: "general" });

    expect(post?._id).toBeTruthy();
    expect(community?._id).toBeTruthy();

    await PostModel.updateOne(
      { _id: post?._id },
      { $set: { imageUrls: ["/uploads/post/2026/07/post-ref.jpg"] } },
    );

    await CommunityModel.updateOne(
      { _id: community?._id },
      {
        $set: {
          bannerImageUrl: "/uploads/community/2026/07/community-banner-ref.jpg",
          titleImageUrl: "/uploads/community/2026/07/community-title-ref.jpg",
        },
      },
    );

    await CommentModel.create({
      targetType: "Post",
      targetId: post?._id,
      text: "has image",
      imageUrls: ["/uploads/comment/2026/07/comment-ref.jpg"],
    });

    listStoredUploadUrlsMock.mockImplementation(async (scope: string) => {
      if (scope === "post") {
        return [
          "/uploads/post/2026/07/post-ref.jpg",
          "/uploads/post/2026/07/post-orphan.jpg",
        ];
      }

      if (scope === "community") {
        return [
          "/uploads/community/2026/07/community-banner-ref.jpg",
          "/uploads/community/2026/07/community-title-ref.jpg",
          "/uploads/community/2026/07/community-orphan.jpg",
        ];
      }

      return [
        "/uploads/comment/2026/07/comment-ref.jpg",
        "/uploads/comment/2026/07/comment-orphan.jpg",
      ];
    });

    const response = await cleanupUploads(
      createMockRequest("http://localhost/api/admin/uploads/cleanup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope: "all", dryRun: true }),
      }),
    );

    expect(response.status).toBe(200);

    const payload = (await response.json()) as {
      dryRun: boolean;
      deletedTotal: number;
      results: Array<{
        scope: string;
        orphanedCount: number;
        deletedCount: number;
      }>;
    };

    expect(payload.dryRun).toBe(true);
    expect(payload.deletedTotal).toBe(0);
    expect(deleteStoredUploadUrlMock).not.toHaveBeenCalled();

    const byScope = new Map(payload.results.map((item) => [item.scope, item]));

    expect(byScope.get("post")?.orphanedCount).toBe(1);
    expect(byScope.get("community")?.orphanedCount).toBe(1);
    expect(byScope.get("comment")?.orphanedCount).toBe(1);
    expect(byScope.get("post")?.deletedCount).toBe(0);
    expect(byScope.get("community")?.deletedCount).toBe(0);
    expect(byScope.get("comment")?.deletedCount).toBe(0);
  });

  it("delete mode respects maxDelete budget", async () => {
    listStoredUploadUrlsMock.mockImplementation(async (scope: string) => {
      if (scope === "post") {
        return ["/uploads/post/2026/07/post-orphan-1.jpg"];
      }

      if (scope === "community") {
        return ["/uploads/community/2026/07/community-orphan-1.jpg"];
      }

      return ["/uploads/comment/2026/07/comment-orphan-1.jpg"];
    });

    const response = await cleanupUploads(
      createMockRequest("http://localhost/api/admin/uploads/cleanup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope: "all", dryRun: false, maxDelete: 2 }),
      }),
    );

    expect(response.status).toBe(200);

    const payload = (await response.json()) as {
      dryRun: boolean;
      deletedTotal: number;
      results: Array<{
        scope: string;
        deletedCount: number;
      }>;
    };

    expect(payload.dryRun).toBe(false);
    expect(payload.deletedTotal).toBe(2);
    expect(deleteStoredUploadUrlMock).toHaveBeenCalledTimes(2);

    const totalDeletedFromScopes = payload.results.reduce((sum, item) => sum + item.deletedCount, 0);
    expect(totalDeletedFromScopes).toBe(2);
  });

  it("returns 400 for invalid scope", async () => {
    const response = await cleanupUploads(
      createMockRequest("http://localhost/api/admin/uploads/cleanup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope: "invalid-scope", dryRun: true }),
      }),
    );

    expect(response.status).toBe(400);
  });
});

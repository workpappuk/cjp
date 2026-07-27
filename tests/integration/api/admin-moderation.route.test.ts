/** @vitest-environment node */

import { Types } from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { GET, PATCH } from "@/app/api/admin/moderation/route";
import { CommunityModel } from "@/app/_lib/models/Community";
import { PostModel } from "@/app/_lib/models/Post";
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

describe("admin moderation route", () => {
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

  it("GET returns 403 for non-admin", async () => {
    actorMock.mockResolvedValueOnce({ isAdmin: false, profileId: null, email: "user@test.threadforge.dev" });

    const response = await GET(createMockRequest("http://localhost/api/admin/moderation"));
    expect(response.status).toBe(403);
  });

  it("GET returns pending summary for admin", async () => {
    actorMock.mockResolvedValueOnce({
      isAdmin: true,
      profileId: new Types.ObjectId(),
      email: "admin@test.threadforge.dev",
    });

    const response = await GET(createMockRequest("http://localhost/api/admin/moderation"));
    expect(response.status).toBe(200);

    const payload = (await response.json()) as {
      summary: { pending: { total: number } };
    };

    expect(payload.summary.pending.total).toBeTypeOf("number");
  });

  it("GET validates targetType", async () => {
    actorMock.mockResolvedValueOnce({
      isAdmin: true,
      profileId: new Types.ObjectId(),
      email: "admin@test.threadforge.dev",
    });

    const response = await GET(
      createMockRequest("http://localhost/api/admin/moderation?targetType=BadType"),
    );

    expect(response.status).toBe(400);
  });

  it("GET validates cursor format", async () => {
    actorMock.mockResolvedValueOnce({
      isAdmin: true,
      profileId: new Types.ObjectId(),
      email: "admin@test.threadforge.dev",
    });

    const response = await GET(
      createMockRequest("http://localhost/api/admin/moderation?targetType=Post&cursor=bad-cursor"),
    );

    expect(response.status).toBe(400);
  });

  it("GET validates moderationStatus and recordStatus filters", async () => {
    actorMock.mockResolvedValue({
      isAdmin: true,
      profileId: new Types.ObjectId(),
      email: "admin@test.threadforge.dev",
    });

    const badModerationStatus = await GET(
      createMockRequest(
        "http://localhost/api/admin/moderation?targetType=Post&moderationStatus=queued",
      ),
    );
    expect(badModerationStatus.status).toBe(400);

    const badRecordStatus = await GET(
      createMockRequest(
        "http://localhost/api/admin/moderation?targetType=Post&recordStatus=hidden",
      ),
    );
    expect(badRecordStatus.status).toBe(400);
  });

  it("GET lists posts for moderation", async () => {
    actorMock.mockResolvedValueOnce({
      isAdmin: true,
      profileId: new Types.ObjectId(),
      email: "admin@test.threadforge.dev",
    });

    const response = await GET(
      createMockRequest("http://localhost/api/admin/moderation?targetType=Post&moderationStatus=all&limit=10"),
    );

    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      targetType: string;
      items: Array<{ id: string; title: string; communities: string[] }>;
      pageSize: number;
    };

    expect(payload.targetType).toBe("Post");
    expect(payload.pageSize).toBe(10);
    expect(Array.isArray(payload.items)).toBe(true);
    expect(payload.items.length).toBeGreaterThan(0);
    expect(payload.items[0]?.title).toBeTruthy();
  });

  it("GET supports pagination cursor for posts", async () => {
    const community = await CommunityModel.findOne({ name: "general" }).lean();
    const author = new Types.ObjectId();

    await PostModel.create([
      {
        title: "Paged post 1",
        content: "Newest",
        communities: community?._id ? [community._id] : [],
        createdBy: author,
        lastUpdatedBy: author,
        moderationStatus: "pending",
      },
      {
        title: "Paged post 2",
        content: "Older",
        communities: community?._id ? [community._id] : [],
        createdBy: author,
        lastUpdatedBy: author,
        moderationStatus: "pending",
      },
    ]);

    actorMock.mockResolvedValue({
      isAdmin: true,
      profileId: new Types.ObjectId(),
      email: "admin@test.threadforge.dev",
    });

    const firstPageResponse = await GET(
      createMockRequest("http://localhost/api/admin/moderation?targetType=Post&limit=1"),
    );
    expect(firstPageResponse.status).toBe(200);

    const firstPage = (await firstPageResponse.json()) as {
      items: Array<{ id: string }>;
      hasMore: boolean;
      nextCursor: string | null;
    };

    expect(firstPage.items).toHaveLength(1);
    expect(firstPage.hasMore).toBe(true);
    expect(firstPage.nextCursor).toBeTruthy();

    const secondPageResponse = await GET(
      createMockRequest(
        `http://localhost/api/admin/moderation?targetType=Post&limit=1&cursor=${encodeURIComponent(
          String(firstPage.nextCursor),
        )}`,
      ),
    );
    expect(secondPageResponse.status).toBe(200);

    const secondPage = (await secondPageResponse.json()) as {
      items: Array<{ id: string }>;
    };

    expect(secondPage.items).toHaveLength(1);
    expect(secondPage.items[0]?.id).not.toBe(firstPage.items[0]?.id);
  });

  it("PATCH returns 403 when actor is not admin", async () => {
    actorMock.mockResolvedValueOnce({
      isAdmin: false,
      profileId: null,
      email: "user@test.threadforge.dev",
    });

    const response = await PATCH(
      createMockRequest("http://localhost/api/admin/moderation", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetType: "Post", targetId: new Types.ObjectId().toString(), action: "approve" }),
      }),
    );

    expect(response.status).toBe(403);
  });

  it("PATCH validates input payload", async () => {
    actorMock.mockResolvedValue({
      isAdmin: true,
      profileId: new Types.ObjectId(),
      email: "admin@test.threadforge.dev",
    });

    const missingActionResponse = await PATCH(
      createMockRequest("http://localhost/api/admin/moderation", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetType: "Post", targetId: new Types.ObjectId().toString() }),
      }),
    );
    expect(missingActionResponse.status).toBe(400);

    const invalidIdResponse = await PATCH(
      createMockRequest("http://localhost/api/admin/moderation", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetType: "Post", targetId: "bad", action: "approve" }),
      }),
    );
    expect(invalidIdResponse.status).toBe(400);

    const invalidActionResponse = await PATCH(
      createMockRequest("http://localhost/api/admin/moderation", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetType: "Post",
          targetId: new Types.ObjectId().toString(),
          action: "ban",
        }),
      }),
    );
    expect(invalidActionResponse.status).toBe(400);
  });

  it("PATCH returns 404 for unknown target", async () => {
    actorMock.mockResolvedValueOnce({
      isAdmin: true,
      profileId: new Types.ObjectId(),
      email: "admin@test.threadforge.dev",
    });

    const response = await PATCH(
      createMockRequest("http://localhost/api/admin/moderation", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetType: "Community",
          targetId: new Types.ObjectId().toString(),
          action: "approve",
        }),
      }),
    );

    expect(response.status).toBe(404);
  });

  it("PATCH rejects pending post and clears approvedAt", async () => {
    const community = await CommunityModel.findOne({ name: "general" }).lean();
    const creator = new Types.ObjectId();
    const post = await PostModel.create({
      title: "Review me",
      content: "Pending moderation",
      communities: community?._id ? [community._id] : [],
      createdBy: creator,
      lastUpdatedBy: creator,
      moderationStatus: "pending",
      approvedAt: new Date(),
      recordStatus: "active",
    });

    const adminProfileId = new Types.ObjectId();
    actorMock.mockResolvedValueOnce({
      isAdmin: true,
      profileId: adminProfileId,
      email: "admin@test.threadforge.dev",
    });

    const response = await PATCH(
      createMockRequest("http://localhost/api/admin/moderation", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetType: "Post",
          targetId: String(post._id),
          action: "reject",
        }),
      }),
    );

    expect(response.status).toBe(200);

    const payload = (await response.json()) as {
      moderationStatus: string;
      approvedAt: string | null;
    };

    expect(payload.moderationStatus).toBe("rejected");
    expect(payload.approvedAt).toBeNull();

    const persisted = await PostModel.findById(post._id).lean();
    expect(persisted?.moderationStatus).toBe("rejected");
    expect(persisted?.approvedAt).toBeNull();
  });

  it("PATCH supports recordStatus-only update", async () => {
    const community = await CommunityModel.findOne({ name: "general" }).lean();
    const creator = new Types.ObjectId();
    const post = await PostModel.create({
      title: "Status-only post",
      content: "No moderation action",
      communities: community?._id ? [community._id] : [],
      createdBy: creator,
      lastUpdatedBy: creator,
      moderationStatus: "pending",
      recordStatus: "active",
    });

    const adminProfileId = new Types.ObjectId();
    actorMock.mockResolvedValueOnce({
      isAdmin: true,
      profileId: adminProfileId,
      email: "admin@test.threadforge.dev",
    });

    const response = await PATCH(
      createMockRequest("http://localhost/api/admin/moderation", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetType: "Post",
          targetId: String(post._id),
          recordStatus: "archived",
        }),
      }),
    );

    expect(response.status).toBe(200);

    const payload = (await response.json()) as {
      moderationStatus: string;
      recordStatus: string;
    };

    expect(payload.moderationStatus).toBe("pending");
    expect(payload.recordStatus).toBe("archived");

    const persisted = await PostModel.findById(post._id).lean();
    expect(persisted?.moderationStatus).toBe("pending");
    expect(persisted?.recordStatus).toBe("archived");
  });

  it("PATCH approves pending post and updates persisted moderation state", async () => {
    const user = await CommunityModel.findOne({ name: "general" }).lean();
    const creator = new Types.ObjectId();
    const post = await PostModel.create({
      title: "Pending post",
      content: "Needs moderation",
      communities: user?._id ? [user._id] : [],
      createdBy: creator,
      lastUpdatedBy: creator,
      moderationStatus: "pending",
      recordStatus: "active",
    });

    const adminProfileId = new Types.ObjectId();
    actorMock.mockResolvedValueOnce({
      isAdmin: true,
      profileId: adminProfileId,
      email: "admin@test.threadforge.dev",
    });

    const response = await PATCH(
      createMockRequest("http://localhost/api/admin/moderation", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetType: "Post",
          targetId: String(post._id),
          action: "approve",
          recordStatus: "flagged",
        }),
      }),
    );

    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      id: string;
      moderationStatus: string;
      recordStatus: string;
    };

    expect(payload.id).toBe(String(post._id));
    expect(payload.moderationStatus).toBe("approved");
    expect(payload.recordStatus).toBe("flagged");

    const persisted = await PostModel.findById(post._id).lean();
    expect(persisted?.moderationStatus).toBe("approved");
    expect(persisted?.recordStatus).toBe("flagged");
  });
});

/** @vitest-environment node */

import { Types } from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/admin/audit/route";
import { PostModel } from "@/app/_lib/models/Post";
import { UserProfileModel } from "@/app/_lib/models/UserProfile";
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

describe("admin audit route", () => {
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

  it("returns 403 for non-admin actor", async () => {
    actorMock.mockResolvedValueOnce({
      email: "user@test.threadforge.dev",
      profileId: null,
      isAdmin: false,
    });

    const response = await GET(createMockRequest("http://localhost/api/admin/audit"));
    expect(response.status).toBe(403);
  });

  it("validates required modelName", async () => {
    actorMock.mockResolvedValueOnce({
      email: "admin@test.threadforge.dev",
      profileId: new Types.ObjectId(),
      isAdmin: true,
    });

    const response = await GET(createMockRequest("http://localhost/api/admin/audit"));
    expect(response.status).toBe(400);

    const payload = (await response.json()) as { error: string; allowedModelNames: string[] };
    expect(payload.error).toMatch(/modelName is required/i);
    expect(payload.allowedModelNames).toContain("Post");
  });

  it("validates modelName, documentId, operation, and cursor", async () => {
    actorMock.mockResolvedValue({
      email: "admin@test.threadforge.dev",
      profileId: new Types.ObjectId(),
      isAdmin: true,
    });

    const invalidModel = await GET(
      createMockRequest("http://localhost/api/admin/audit?modelName=BadModel"),
    );
    expect(invalidModel.status).toBe(400);

    const invalidDocument = await GET(
      createMockRequest("http://localhost/api/admin/audit?modelName=Post&documentId=bad"),
    );
    expect(invalidDocument.status).toBe(400);

    const invalidOperation = await GET(
      createMockRequest("http://localhost/api/admin/audit?modelName=Post&operation=delete"),
    );
    expect(invalidOperation.status).toBe(400);

    const invalidCursor = await GET(
      createMockRequest("http://localhost/api/admin/audit?modelName=Post&cursor=broken"),
    );
    expect(invalidCursor.status).toBe(400);
  });

  it("lists audit items with operation/document filters and profile enrichment", async () => {
    actorMock.mockResolvedValueOnce({
      email: "admin@test.threadforge.dev",
      profileId: new Types.ObjectId(),
      isAdmin: true,
    });

    const owner = await UserProfileModel.findOne({ email: "user@test.threadforge.dev" }).lean();
    const actor = await UserProfileModel.findOne({ email: "admin@test.threadforge.dev" }).lean();
    const post = await PostModel.create({
      title: "Audited Post",
      content: "Body",
      createdBy: owner?._id,
      lastUpdatedBy: owner?._id,
      moderationStatus: "approved",
    });

    const auditDbName = process.env.MONGODB_AUDIT_DB ?? "threadforge_test_audit";
    const collection = PostModel.db.useDb(auditDbName, { useCache: true }).collection("posts_audit");

    const now = new Date();
    await collection.insertMany([
      {
        documentId: String(post._id),
        modelName: "Post",
        collectionName: "posts",
        operation: "update",
        actorId: actor?._id ? String(actor._id) : null,
        actorEmail: "admin@test.threadforge.dev",
        changedAt: new Date(now.getTime() - 1000),
        delta: [{ path: "title", from: "A", to: "B" }],
      },
      {
        documentId: String(post._id),
        modelName: "Post",
        collectionName: "posts",
        operation: "create",
        actorId: owner?._id ? String(owner._id) : null,
        actorEmail: "user@test.threadforge.dev",
        changedAt: new Date(now.getTime() - 2000),
        delta: [{ path: "title", from: null, to: "A" }],
      },
    ]);

    const response = await GET(
      createMockRequest(
        `http://localhost/api/admin/audit?modelName=Post&documentId=${String(post._id)}&operation=update&limit=5`,
      ),
    );

    expect(response.status).toBe(200);

    const payload = (await response.json()) as {
      modelName: string;
      operation: string;
      collectionName: string;
      documentId: string | null;
      pageSize: number;
      items: Array<{ actorName: string | null; operation: string; documentId: string; delta: Array<{ path: string }> }>;
    };

    expect(payload.modelName).toBe("Post");
    expect(payload.operation).toBe("update");
    expect(payload.collectionName).toBe("posts_audit");
    expect(payload.documentId).toBe(String(post._id));
    expect(payload.pageSize).toBe(5);
    expect(payload.items).toHaveLength(1);
    expect(payload.items[0]?.operation).toBe("update");
    expect(payload.items[0]?.documentId).toBe(String(post._id));
    expect(payload.items[0]?.actorName).toBeTruthy();
    expect(payload.items[0]?.delta[0]?.path).toBe("title");
  });

  it("supports pagination and returns nextCursor when more records exist", async () => {
    actorMock.mockResolvedValueOnce({
      email: "admin@test.threadforge.dev",
      profileId: new Types.ObjectId(),
      isAdmin: true,
    });

    const postId = new Types.ObjectId().toString();
    const auditDbName = process.env.MONGODB_AUDIT_DB ?? "threadforge_test_audit";
    const collection = PostModel.db.useDb(auditDbName, { useCache: true }).collection("posts_audit");

    const base = Date.now();
    await collection.insertMany([
      {
        documentId: postId,
        modelName: "Post",
        collectionName: "posts",
        operation: "update",
        changedAt: new Date(base - 1000),
        delta: [],
      },
      {
        documentId: postId,
        modelName: "Post",
        collectionName: "posts",
        operation: "update",
        changedAt: new Date(base - 2000),
        delta: [],
      },
    ]);

    const response = await GET(
      createMockRequest(`http://localhost/api/admin/audit?modelName=Post&limit=1`),
    );

    expect(response.status).toBe(200);

    const payload = (await response.json()) as {
      hasMore: boolean;
      nextCursor: string | null;
      items: Array<{ id: string }>;
    };

    expect(payload.items).toHaveLength(1);
    expect(payload.hasMore).toBe(true);
    expect(payload.nextCursor).toBeTruthy();
  });
});

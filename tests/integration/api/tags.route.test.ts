/** @vitest-environment node */

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Types } from "mongoose";
import { GET, POST, PATCH, DELETE } from "@/app/api/tags/route";
import { PostModel } from "@/app/_lib/models/Post";
import { UserProfileModel } from "@/app/_lib/models/UserProfile";
import { TagModel } from "@/app/_lib/models/Tag";
import { createMockRequest } from "@/tests/utils/test-helpers";
import {
  cleanupDatabase,
  createTestDatabase,
  resetDatabase,
  seedDatabase,
} from "@/tests/setup/setupDb";
import { TEST_USERS } from "@/tests/fixtures";

const getServerSessionMock = vi.hoisted(() => vi.fn());
const rateLimitMock = vi.hoisted(() => vi.fn());

vi.mock("next-auth", () => ({
  getServerSession: getServerSessionMock,
}));

vi.mock("@/app/_lib/rate-limit", () => ({
  checkRateLimit: rateLimitMock,
}));

describe("tags route extended coverage", () => {
  beforeAll(async () => {
    await createTestDatabase();
  });

  beforeEach(async () => {
    await resetDatabase();
    await seedDatabase();

    getServerSessionMock.mockResolvedValue({
      user: { email: TEST_USERS.user.email },
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

  it("GET validates paired targetType and targetId", async () => {
    const response = await GET(
      createMockRequest("http://localhost/api/tags?targetType=Post"),
    );

    expect(response.status).toBe(400);
    const payload = (await response.json()) as { error: string };
    expect(payload.error).toMatch(/provided together/i);
  });

  it("GET validates targetType values", async () => {
    const response = await GET(
      createMockRequest(
        `http://localhost/api/tags?targetType=Bad&targetId=${new Types.ObjectId().toString()}`,
      ),
    );

    expect(response.status).toBe(400);
  });

  it("GET search returns filtered tags", async () => {
    const owner = await UserProfileModel.findOne({ email: TEST_USERS.user.email }).lean();
    const post = await PostModel.create({
      title: "Tag Search Target",
      content: "Body",
      createdBy: owner?._id,
      lastUpdatedBy: owner?._id,
      moderationStatus: "approved",
    });

    await POST(
      createMockRequest("http://localhost/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "react",
          targetType: "Post",
          targetId: String(post._id),
        }),
      }),
    );

    const response = await GET(
      createMockRequest("http://localhost/api/tags?search=rea"),
    );

    expect(response.status).toBe(200);
    const payload = (await response.json()) as Array<{ name: string }>;
    expect(payload.some((tag) => tag.name.toLowerCase() === "react")).toBe(true);
  });

  it("POST returns 401 when session user is missing", async () => {
    getServerSessionMock.mockResolvedValueOnce(null);

    const response = await POST(
      createMockRequest("http://localhost/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "unauthorized",
          targetType: "Post",
          targetId: new Types.ObjectId().toString(),
        }),
      }),
    );

    expect(response.status).toBe(401);
  });

  it("POST validates tag word format", async () => {
    const owner = await UserProfileModel.findOne({ email: TEST_USERS.user.email }).lean();
    const post = await PostModel.create({
      title: "Invalid Tag Target",
      content: "Body",
      createdBy: owner?._id,
      lastUpdatedBy: owner?._id,
      moderationStatus: "approved",
    });

    const response = await POST(
      createMockRequest("http://localhost/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "two words",
          targetType: "Post",
          targetId: String(post._id),
        }),
      }),
    );

    expect(response.status).toBe(400);
    const payload = (await response.json()) as { error: string };
    expect(payload.error).toMatch(/single word/i);
  });

  it("POST blocks non-owners from managing target tags", async () => {
    const admin = await UserProfileModel.findOne({ email: TEST_USERS.admin.email }).lean();
    const foreignPost = await PostModel.create({
      title: "Foreign Post",
      content: "Body",
      createdBy: admin?._id,
      lastUpdatedBy: admin?._id,
      moderationStatus: "approved",
    });

    const response = await POST(
      createMockRequest("http://localhost/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "blocked",
          targetType: "Post",
          targetId: String(foreignPost._id),
        }),
      }),
    );

    expect(response.status).toBe(403);
  });

  it("PATCH validates required names", async () => {
    const response = await PATCH(
      createMockRequest("http://localhost/api/tags", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetType: "Post",
          targetId: new Types.ObjectId().toString(),
          oldName: "",
          newName: "",
        }),
      }),
    );

    expect(response.status).toBe(400);
  });

  it("PATCH returns 404 when old tag is missing", async () => {
    const owner = await UserProfileModel.findOne({ email: TEST_USERS.user.email }).lean();
    const post = await PostModel.create({
      title: "Patch Target",
      content: "Body",
      createdBy: owner?._id,
      lastUpdatedBy: owner?._id,
      moderationStatus: "approved",
    });

    const response = await PATCH(
      createMockRequest("http://localhost/api/tags", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetType: "Post",
          targetId: String(post._id),
          oldName: "missingtag",
          newName: "newtag",
        }),
      }),
    );

    expect(response.status).toBe(404);
  });

  it("DELETE returns 404 when tag is not attached to target", async () => {
    const owner = await UserProfileModel.findOne({ email: TEST_USERS.user.email }).lean();

    await TagModel.create({
      name: "lonely",
      normalizedName: "lonely",
      createdBy: owner?._id,
      lastUpdatedBy: owner?._id,
      isActive: true,
    });

    const post = await PostModel.create({
      title: "Delete Target",
      content: "Body",
      createdBy: owner?._id,
      lastUpdatedBy: owner?._id,
      moderationStatus: "approved",
      tags: [],
    });

    const response = await DELETE(
      createMockRequest("http://localhost/api/tags", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetType: "Post",
          targetId: String(post._id),
          name: "lonely",
        }),
      }),
    );

    expect(response.status).toBe(404);
    const payload = (await response.json()) as { error: string };
    expect(payload.error).toMatch(/not attached/i);
  });

  it("PATCH returns 429 when update rate limit is exceeded", async () => {
    rateLimitMock.mockResolvedValueOnce({
      allowed: false,
      remaining: 0,
      retryAfterSeconds: 12,
    });

    const response = await PATCH(
      createMockRequest("http://localhost/api/tags", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetType: "Post",
          targetId: new Types.ObjectId().toString(),
          oldName: "a",
          newName: "b",
        }),
      }),
    );

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("12");
  });
});

/** @vitest-environment node */

import { Types } from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/posts/[postId]/route";
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

describe("post detail route", () => {
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
  });

  afterAll(async () => {
    await cleanupDatabase();
  });

  it("returns 400 for invalid post id", async () => {
    const invalid = "bad-id";

    const response = await GET(
      createMockRequest(`http://localhost/api/posts/${invalid}`),
      { params: Promise.resolve({ postId: invalid }) },
    );

    expect(response.status).toBe(400);
  });

  it("returns 404 when post does not exist", async () => {
    const missingId = new Types.ObjectId().toString();

    const response = await GET(
      createMockRequest(`http://localhost/api/posts/${missingId}`),
      { params: Promise.resolve({ postId: missingId }) },
    );

    expect(response.status).toBe(404);
  });

  it("returns 404 for non-admin requesting pending post", async () => {
    const user = await UserProfileModel.findOne({ email: "user@test.threadforge.dev" }).lean();

    const pendingPost = await PostModel.create({
      title: "Pending only",
      content: "Hidden content",
      createdBy: user?._id,
      lastUpdatedBy: user?._id,
      moderationStatus: "pending",
    });

    const response = await GET(
      createMockRequest(`http://localhost/api/posts/${String(pendingPost._id)}`),
      { params: Promise.resolve({ postId: String(pendingPost._id) }) },
    );

    expect(response.status).toBe(404);
  });

  it("returns pending post for admin actor", async () => {
    const user = await UserProfileModel.findOne({ email: "user@test.threadforge.dev" }).lean();

    const pendingPost = await PostModel.create({
      title: "Admin visible",
      content: "Pending content",
      createdBy: user?._id,
      lastUpdatedBy: user?._id,
      moderationStatus: "pending",
    });

    actorMock.mockResolvedValueOnce({
      email: "admin@test.threadforge.dev",
      isAdmin: true,
      profileId: null,
    });

    const response = await GET(
      createMockRequest(`http://localhost/api/posts/${String(pendingPost._id)}`),
      { params: Promise.resolve({ postId: String(pendingPost._id) }) },
    );

    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      id: string;
      title: string;
      moderationStatus: string;
      requestId: string;
    };

    expect(payload.id).toBe(String(pendingPost._id));
    expect(payload.title).toBe("Admin visible");
    expect(payload.moderationStatus).toBe("pending");
    expect(payload.requestId).toBeTruthy();
  });

  it("returns approved seed post for standard user", async () => {
    const seedPost = await PostModel.findOne({ title: "Seed Post" }).lean();
    expect(seedPost?._id).toBeTruthy();

    const postId = String(seedPost?._id);
    const response = await GET(
      createMockRequest(`http://localhost/api/posts/${postId}`),
      { params: Promise.resolve({ postId }) },
    );

    expect(response.status).toBe(200);

    const payload = (await response.json()) as {
      id: string;
      title: string;
      content: string;
      moderationStatus: string;
      communities: string[];
      tags: string[];
    };

    expect(payload.id).toBe(postId);
    expect(payload.title).toBe("Seed Post");
    expect(payload.content).toContain("Seed post");
    expect(payload.moderationStatus).toBe("approved");
    expect(Array.isArray(payload.communities)).toBe(true);
    expect(Array.isArray(payload.tags)).toBe(true);
  });
});

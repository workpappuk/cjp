/** @vitest-environment node */

import { beforeAll, beforeEach, afterAll, describe, expect, it, vi } from "vitest";
import { Types } from "mongoose";
import { GET as getPosts, POST as createPost } from "@/app/api/posts/route";
import {
  GET as getComments,
  POST as createComment,
} from "@/app/api/posts/[postId]/comments/route";
import { PostModel } from "@/app/_lib/models/Post";
import { UserProfileModel } from "@/app/_lib/models/UserProfile";
import { CommentModel } from "@/app/_lib/models/Comment";
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

describe("posts and comments routes", () => {
  beforeAll(async () => {
    await createTestDatabase();
  });

  beforeEach(async () => {
    await resetDatabase();
    await seedDatabase();
    rateLimitMock.mockResolvedValue({
      allowed: true,
      remaining: 100,
      retryAfterSeconds: 1,
    });
    actorMock.mockResolvedValue({
      email: "user@test.threadforge.dev",
      isAdmin: false,
      profileId: null,
    });
  });

  afterAll(async () => {
    await cleanupDatabase();
  });

  it("GET returns only approved posts for non-admin actor", async () => {
    const user = await UserProfileModel.findOne({ email: "user@test.threadforge.dev" }).lean();
    await PostModel.create({
      title: "Pending",
      content: "Pending body",
      createdBy: user?._id,
      lastUpdatedBy: user?._id,
      moderationStatus: "pending",
    });

    const response = await getPosts(createMockRequest("http://localhost/api/posts"));
    expect(response.status).toBe(200);

    const body = (await response.json()) as Array<{ moderationStatus?: string }>;
    expect(body.every((item) => item.moderationStatus !== "pending")).toBe(true);
  });

  it("POST creates a pending post for non-admin actor", async () => {
    const request = createMockRequest("http://localhost/api/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "New Post",
        content: "Body",
        communities: ["general"],
      }),
    });

    const response = await createPost(request);
    expect(response.status).toBe(201);

    const payload = (await response.json()) as { id: string; moderationStatus: string };
    expect(payload.moderationStatus).toBe("pending");

    const persisted = await PostModel.findById(payload.id).lean();
    expect(persisted?.title).toBe("New Post");
  });

  it("POST validates title/content", async () => {
    const response = await createPost(
      createMockRequest("http://localhost/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "", content: "" }),
      }),
    );

    expect(response.status).toBe(400);
  });

  it("POST returns 401 when actor is unauthenticated", async () => {
    actorMock.mockResolvedValueOnce(null);

    const response = await createPost(
      createMockRequest("http://localhost/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Guest Post",
          content: "Blocked",
          communities: ["general"],
        }),
      }),
    );

    expect(response.status).toBe(401);
  });

  it("POST and GET comments persist and read data", async () => {
    actorMock.mockResolvedValueOnce({
      email: "admin@test.threadforge.dev",
      isAdmin: true,
      profileId: null,
    });

    const seedPost = await PostModel.findOne({ title: "Seed Post" }).lean();
    expect(seedPost?._id).toBeTruthy();

    const postId = String(seedPost?._id);
    const createResponse = await createComment(
      createMockRequest(`http://localhost/api/posts/${postId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "First comment" }),
      }),
      { params: Promise.resolve({ postId }) },
    );

    expect(createResponse.status).toBe(201);
    const created = (await createResponse.json()) as { id: string };

    const persisted = await CommentModel.findById(created.id).lean();
    expect(persisted?.text).toBe("First comment");

    const getResponse = await getComments(
      createMockRequest(`http://localhost/api/posts/${postId}/comments`),
      { params: Promise.resolve({ postId }) },
    );

    expect(getResponse.status).toBe(200);
    const comments = (await getResponse.json()) as Array<{ id: string }>;
    expect(comments.some((comment) => comment.id === created.id)).toBe(true);
  });

  it("POST and GET comments support imageUrls", async () => {
    actorMock.mockResolvedValueOnce({
      email: "admin@test.threadforge.dev",
      isAdmin: true,
      profileId: null,
    });

    const seedPost = await PostModel.findOne({ title: "Seed Post" }).lean();
    expect(seedPost?._id).toBeTruthy();

    const postId = String(seedPost?._id);
    const createResponse = await createComment(
      createMockRequest(`http://localhost/api/posts/${postId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: "",
          imageUrls: [
            "/uploads/comment/2026/07/comment-one.jpg",
            "/uploads/comment/2026/07/comment-two.jpg",
            "/uploads/post/2026/07/not-allowed.jpg",
          ],
        }),
      }),
      { params: Promise.resolve({ postId }) },
    );

    expect(createResponse.status).toBe(201);
    const created = (await createResponse.json()) as { id: string; imageUrls?: string[] };
    expect(Array.isArray(created.imageUrls)).toBe(true);
    expect(created.imageUrls).toEqual([
      "/uploads/comment/2026/07/comment-one.jpg",
      "/uploads/comment/2026/07/comment-two.jpg",
    ]);

    const persisted = await CommentModel.findById(created.id).lean();
    expect(persisted?.imageUrls).toEqual([
      "/uploads/comment/2026/07/comment-one.jpg",
      "/uploads/comment/2026/07/comment-two.jpg",
    ]);

    const getResponse = await getComments(
      createMockRequest(`http://localhost/api/posts/${postId}/comments`),
      { params: Promise.resolve({ postId }) },
    );

    expect(getResponse.status).toBe(200);
    const comments = (await getResponse.json()) as Array<{
      id: string;
      imageUrls?: string[];
    }>;

    const found = comments.find((comment) => comment.id === created.id);
    expect(found?.imageUrls).toEqual([
      "/uploads/comment/2026/07/comment-one.jpg",
      "/uploads/comment/2026/07/comment-two.jpg",
    ]);
  });

  it("POST comment rejects when both text and imageUrls are empty", async () => {
    const seedPost = await PostModel.findOne({ title: "Seed Post" }).lean();
    expect(seedPost?._id).toBeTruthy();

    const postId = String(seedPost?._id);
    const createResponse = await createComment(
      createMockRequest(`http://localhost/api/posts/${postId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: "   ",
          imageUrls: ["/uploads/post/2026/07/not-allowed.jpg"],
        }),
      }),
      { params: Promise.resolve({ postId }) },
    );

    expect(createResponse.status).toBe(400);
  });

  it("comment route rejects invalid post id", async () => {
    const invalidId = new Types.ObjectId().toString().slice(0, 10);
    const response = await getComments(
      createMockRequest(`http://localhost/api/posts/${invalidId}/comments`),
      { params: Promise.resolve({ postId: invalidId }) },
    );

    expect(response.status).toBe(400);
  });

  it("POST comment returns 401 when actor is unauthenticated", async () => {
    actorMock.mockResolvedValueOnce(null);

    const seedPost = await PostModel.findOne({ title: "Seed Post" }).lean();
    expect(seedPost?._id).toBeTruthy();

    const postId = String(seedPost?._id);
    const response = await createComment(
      createMockRequest(`http://localhost/api/posts/${postId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "Guest comment" }),
      }),
      { params: Promise.resolve({ postId }) },
    );

    expect(response.status).toBe(401);
  });
});

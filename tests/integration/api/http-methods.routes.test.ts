/** @vitest-environment node */

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as getTags, POST as postTag, PATCH as patchTag, DELETE as deleteTag } from "@/app/api/tags/route";
import { PUT as putUserProfile } from "@/app/api/user-profile/route";
import { PostModel } from "@/app/_lib/models/Post";
import { UserProfileModel } from "@/app/_lib/models/UserProfile";
import {
  cleanupDatabase,
  createTestDatabase,
  resetDatabase,
  seedDatabase,
} from "@/tests/setup/setupDb";
import { createMockRequest } from "@/tests/utils/test-helpers";
import { TEST_USERS } from "@/tests/fixtures";

const getServerSessionMock = vi.hoisted(() => vi.fn());
const rateLimitMock = vi.hoisted(() => vi.fn());

vi.mock("next-auth", () => ({
  getServerSession: getServerSessionMock,
}));

vi.mock("@/app/_lib/rate-limit", () => ({
  checkRateLimit: rateLimitMock,
}));

describe("HTTP method coverage across routes", () => {
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
  });

  afterAll(async () => {
    await cleanupDatabase();
  });

  it("covers GET with tags list", async () => {
    const response = await getTags(createMockRequest("http://localhost/api/tags"));
    expect(response.status).toBe(200);
  });

  it("covers PUT unauthorized user-profile update", async () => {
    getServerSessionMock.mockResolvedValue(null);

    const response = await putUserProfile(
      createMockRequest("http://localhost/api/user-profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Updated" }),
      }),
    );

    expect(response.status).toBe(401);
  });

  it("covers POST, PATCH and DELETE tag lifecycle", async () => {
    getServerSessionMock.mockResolvedValue({
      user: { email: TEST_USERS.user.email },
      provider: "google",
    });

    const owner = await UserProfileModel.findOne({ email: TEST_USERS.user.email }).lean();
    const ownedPost = await PostModel.create({
      title: "Owned",
      content: "Owned post",
      createdBy: owner?._id,
      lastUpdatedBy: owner?._id,
      moderationStatus: "approved",
    });

    const postTagResponse = await postTag(
      createMockRequest("http://localhost/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "frontend",
          targetType: "Post",
          targetId: String(ownedPost._id),
        }),
      }),
    );

    expect(postTagResponse.status).toBe(201);

    const patchResponse = await patchTag(
      createMockRequest("http://localhost/api/tags", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          oldName: "frontend",
          newName: "react",
          targetType: "Post",
          targetId: String(ownedPost._id),
        }),
      }),
    );

    expect(patchResponse.status).toBe(200);

    const deleteResponse = await deleteTag(
      createMockRequest("http://localhost/api/tags", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "react",
          targetType: "Post",
          targetId: String(ownedPost._id),
        }),
      }),
    );

    expect(deleteResponse.status).toBe(200);
  });
});

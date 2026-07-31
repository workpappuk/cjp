/** @vitest-environment node */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { CommunityModel } from "@/app/_lib/models/Community";
import { CommentModel } from "@/app/_lib/models/Comment";
import { PostModel } from "@/app/_lib/models/Post";
import {
  cleanupDatabase,
  createTestDatabase,
  resetDatabase,
  seedImageRichPostsAndComments,
  seedModerationMixes,
  seedOrphanCleanupScenario,
} from "@/tests/setup/setupDb";

describe("seed scenario helpers", () => {
  beforeAll(async () => {
    await createTestDatabase();
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await cleanupDatabase();
  });

  it("seeds image-rich posts and comments", async () => {
    const seeded = await seedImageRichPostsAndComments({
      postCount: 2,
      commentsPerPost: 2,
    });

    expect(seeded.postIds).toHaveLength(2);
    expect(seeded.commentIds).toHaveLength(4);
    expect(seeded.postImageUrls.length).toBeGreaterThan(0);
    expect(seeded.commentImageUrls.length).toBeGreaterThan(0);

    const posts = await PostModel.find({ _id: { $in: seeded.postIds } }).lean();
    expect(posts.length).toBe(2);
    expect(posts.every((post) => Array.isArray(post.imageUrls) && post.imageUrls.length >= 2)).toBe(true);

    const comments = await CommentModel.find({ _id: { $in: seeded.commentIds } }).lean();
    expect(comments.length).toBe(4);
    expect(comments.every((comment) => Array.isArray(comment.imageUrls) && comment.imageUrls.length >= 1)).toBe(true);
  });

  it("seeds pending/approved/rejected moderation mixes", async () => {
    const mixes = await seedModerationMixes();

    expect(Object.values(mixes.communityIdsByStatus)).toHaveLength(3);
    expect(Object.values(mixes.postIdsByStatus)).toHaveLength(3);
    expect(Object.values(mixes.commentIdsByStatus)).toHaveLength(3);

    const communities = await CommunityModel.find({ _id: { $in: Object.values(mixes.communityIdsByStatus) } }).lean();
    const posts = await PostModel.find({ _id: { $in: Object.values(mixes.postIdsByStatus) } }).lean();
    const comments = await CommentModel.find({ _id: { $in: Object.values(mixes.commentIdsByStatus) } }).lean();

    expect(communities.map((item) => item.moderationStatus).sort()).toEqual([
      "approved",
      "pending",
      "rejected",
    ]);
    expect(posts.map((item) => item.moderationStatus).sort()).toEqual([
      "approved",
      "pending",
      "rejected",
    ]);
    expect(comments.map((item) => item.moderationStatus).sort()).toEqual([
      "approved",
      "pending",
      "rejected",
    ]);
  });

  it("seeds orphan cleanup scenario references and orphan candidates", async () => {
    const seeded = await seedOrphanCleanupScenario();

    expect(seeded.referencedByScope.post).toHaveLength(1);
    expect(seeded.referencedByScope.community).toHaveLength(2);
    expect(seeded.referencedByScope.comment).toHaveLength(1);

    expect(seeded.orphanCandidatesByScope.post).toHaveLength(1);
    expect(seeded.orphanCandidatesByScope.community).toHaveLength(2);
    expect(seeded.orphanCandidatesByScope.comment).toHaveLength(1);

    const referencedPost = await PostModel.findOne({
      imageUrls: seeded.referencedByScope.post[0],
      recordStatus: "active",
    }).lean();
    expect(referencedPost?._id).toBeTruthy();

    const orphanPost = await PostModel.findOne({
      imageUrls: seeded.orphanCandidatesByScope.post[0],
      recordStatus: "deleted",
    }).lean();
    expect(orphanPost?._id).toBeTruthy();

    const referencedComment = await CommentModel.findOne({
      imageUrls: seeded.referencedByScope.comment[0],
      recordStatus: "active",
    }).lean();
    expect(referencedComment?._id).toBeTruthy();

    const orphanComment = await CommentModel.findOne({
      imageUrls: seeded.orphanCandidatesByScope.comment[0],
      recordStatus: "deleted",
    }).lean();
    expect(orphanComment?._id).toBeTruthy();
  });
});

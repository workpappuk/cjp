import mongoose from "mongoose";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { connectToDatabase } from "@/app/_lib/mongoose";
import { CommunityModel } from "@/app/_lib/models/Community";
import { CommentModel } from "@/app/_lib/models/Comment";
import { PostModel } from "@/app/_lib/models/Post";
import { TagModel } from "@/app/_lib/models/Tag";
import { UserProfileModel } from "@/app/_lib/models/UserProfile";
import { TEST_USERS } from "@/tests/fixtures";

let replSet: MongoMemoryReplSet | null = null;

let didLoadTestEnvFile = false;

function loadTestEnvFile() {
  if (didLoadTestEnvFile) {
    return;
  }

  didLoadTestEnvFile = true;

  const envPath = path.join(process.cwd(), ".env.test");
  if (!existsSync(envPath)) {
    return;
  }

  const content = readFileSync(envPath, "utf8");
  const lines = content.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const equalsIndex = trimmed.indexOf("=");
    if (equalsIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, equalsIndex).trim();
    const rawValue = trimmed.slice(equalsIndex + 1).trim();
    const value =
      (rawValue.startsWith('"') && rawValue.endsWith('"')) ||
      (rawValue.startsWith("'") && rawValue.endsWith("'"))
        ? rawValue.slice(1, -1)
        : rawValue;

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function getTestEnvConfig() {
  const dbName = (process.env.TEST_MONGODB_DB ?? process.env.MONGODB_DB ?? "threadforge_test").trim();
  const auditDbName = (
    process.env.TEST_MONGODB_AUDIT_DB ??
    process.env.MONGODB_AUDIT_DB ??
    `${dbName}_audit`
  ).trim();
  const externalUri = (process.env.TEST_MONGODB_URI ?? "").trim();

  return {
    dbName,
    auditDbName,
    externalUri,
  };
}

export type SeedResult = {
  adminId: string;
  userId: string;
  postId: string;
  communityId: string;
  tagId: string;
};

export type ImageRichSeedResult = {
  postIds: string[];
  commentIds: string[];
  postImageUrls: string[];
  commentImageUrls: string[];
};

export type ModerationMixSeedResult = {
  communityIdsByStatus: Record<"pending" | "approved" | "rejected", string>;
  postIdsByStatus: Record<"pending" | "approved" | "rejected", string>;
  commentIdsByStatus: Record<"pending" | "approved" | "rejected", string>;
};

export type OrphanCleanupSeedResult = {
  referencedByScope: Record<"post" | "community" | "comment", string[]>;
  orphanCandidatesByScope: Record<"post" | "community" | "comment", string[]>;
};

async function ensureBaselineSeed(): Promise<SeedResult> {
  let admin = await UserProfileModel.findOne({ email: TEST_USERS.admin.email });
  if (!admin) {
    admin = await UserProfileModel.create({
      email: TEST_USERS.admin.email,
      name: TEST_USERS.admin.name,
      isAdmin: true,
      provider: "google",
    });
  }

  let user = await UserProfileModel.findOne({ email: TEST_USERS.user.email });
  if (!user) {
    user = await UserProfileModel.create({
      email: TEST_USERS.user.email,
      name: TEST_USERS.user.name,
      isAdmin: false,
      provider: "google",
    });
  }

  let community = await CommunityModel.findOne({ name: "general" });
  if (!community) {
    community = await CommunityModel.create({
      name: "general",
      createdBy: user._id,
      lastUpdatedBy: user._id,
      moderationStatus: "approved",
      approvedAt: new Date(),
      approvedBy: admin._id,
    });
  }

  let tag = await TagModel.findOne({ normalizedName: "welcome" });
  if (!tag) {
    tag = await TagModel.create({
      name: "welcome",
      normalizedName: "welcome",
      createdBy: user._id,
      lastUpdatedBy: user._id,
    });
  }

  let post = await PostModel.findOne({ title: "Seed Post" });
  if (!post) {
    post = await PostModel.create({
      title: "Seed Post",
      content: "Seed post content",
      createdBy: user._id,
      lastUpdatedBy: user._id,
      communities: [community._id],
      tags: [tag._id],
      moderationStatus: "approved",
      approvedAt: new Date(),
      approvedBy: admin._id,
    });
  }

  return {
    adminId: String(admin._id),
    userId: String(user._id),
    postId: String(post._id),
    communityId: String(community._id),
    tagId: String(tag._id),
  };
}

function makeScopedImageUrl(scope: "post" | "community" | "comment", slug: string, index: number) {
  return `/uploads/${scope}/2026/07/${slug}-${index}.jpg`;
}

const REALISTIC_POST_SEEDS = [
  {
    title: "Weekend Hiking Trails Around Pune",
    content:
      "Sharing a few routes we covered last weekend, including timings, difficulty, and what to pack.",
    slug: "weekend-hiking-trails-pune",
  },
  {
    title: "Minimal Desk Setup for Focused Work",
    content:
      "A simple ergonomic setup with budget-friendly gear that helped reduce fatigue during long coding sessions.",
    slug: "minimal-desk-setup-focus-work",
  },
  {
    title: "Batch Cooking Plan for Busy Weekdays",
    content:
      "Meal prep flow for 5 days: shopping list, prep timeline, and storage tips to keep food fresh.",
    slug: "batch-cooking-plan-weekdays",
  },
];

const REALISTIC_COMMENT_SEEDS = [
  "Great breakdown. The packing checklist saved me a lot of time.",
  "Tried this today and it worked exactly as described.",
  "Could you share your version with a bit more detail on costs?",
  "This is practical and easy to follow. Thanks for posting.",
  "I used a similar approach and can confirm these tips hold up.",
];

const MODERATION_COMMUNITY_BASE_NAMES = [
  "city-food-guides",
  "design-critiques",
  "weekend-hikers",
];

const MODERATION_POST_SEEDS = [
  {
    title: "Community Meetup Notes",
    content: "Captured key takeaways and action items from the meetup.",
  },
  {
    title: "Budget Travel Checklist",
    content: "A checklist for planning affordable domestic trips.",
  },
  {
    title: "Remote Work Boundaries",
    content: "What helped me balance deep work and availability.",
  },
];

export async function createTestDatabase() {
  loadTestEnvFile();

  const config = getTestEnvConfig();

  if (config.externalUri) {
    process.env.MONGODB_URI = config.externalUri;
  } else {
    if (!replSet) {
      replSet = await MongoMemoryReplSet.create({
        replSet: { count: 1 },
      });
    }

    process.env.MONGODB_URI = replSet.getUri();
  }

  process.env.MONGODB_DB = config.dbName;
  process.env.MONGODB_AUDIT_DB = config.auditDbName;

  await connectToDatabase();
}

export async function resetDatabase() {
  await connectToDatabase();

  const primaryDb = mongoose.connection.db;
  if (primaryDb) {
    const collections = await primaryDb.collections();
    await Promise.all(collections.map((collection) => collection.deleteMany({})));
  }
}

export async function seedDatabase(): Promise<SeedResult> {
  const admin = await UserProfileModel.create({
    email: TEST_USERS.admin.email,
    name: TEST_USERS.admin.name,
    isAdmin: true,
    provider: "google",
  });

  const user = await UserProfileModel.create({
    email: TEST_USERS.user.email,
    name: TEST_USERS.user.name,
    isAdmin: false,
    provider: "google",
  });

  const community = await CommunityModel.create({
    name: "general",
    createdBy: user._id,
    lastUpdatedBy: user._id,
    moderationStatus: "approved",
    approvedAt: new Date(),
    approvedBy: admin._id,
  });

  const tag = await TagModel.create({
    name: "welcome",
    normalizedName: "welcome",
    createdBy: user._id,
    lastUpdatedBy: user._id,
  });

  const post = await PostModel.create({
    title: "Seed Post",
    content: "Seed post content",
    createdBy: user._id,
    lastUpdatedBy: user._id,
    communities: [community._id],
    tags: [tag._id],
    moderationStatus: "approved",
    approvedAt: new Date(),
    approvedBy: admin._id,
  });

  return {
    adminId: String(admin._id),
    userId: String(user._id),
    postId: String(post._id),
    communityId: String(community._id),
    tagId: String(tag._id),
  };
}

export async function seedImageRichPostsAndComments(options?: {
  postCount?: number;
  commentsPerPost?: number;
}): Promise<ImageRichSeedResult> {
  const baseline = await ensureBaselineSeed();
  const userId = new mongoose.Types.ObjectId(baseline.userId);
  const communityId = new mongoose.Types.ObjectId(baseline.communityId);

  const postCount = Math.max(options?.postCount ?? 2, 1);
  const commentsPerPost = Math.max(options?.commentsPerPost ?? 2, 1);

  const postImageUrls: string[] = [];
  const createdPostIds: string[] = [];

  for (let postIndex = 0; postIndex < postCount; postIndex += 1) {
    const seed = REALISTIC_POST_SEEDS[postIndex % REALISTIC_POST_SEEDS.length];
    const imageUrls = [
      makeScopedImageUrl("post", `${seed.slug}-cover`, 1),
      makeScopedImageUrl("post", `${seed.slug}-detail`, 2),
    ];
    postImageUrls.push(...imageUrls);

    const post = await PostModel.create({
      title: seed.title,
      content: seed.content,
      imageUrls,
      communities: [communityId],
      createdBy: userId,
      lastUpdatedBy: userId,
      moderationStatus: "approved",
      approvedAt: new Date(),
      approvedBy: userId,
    });

    createdPostIds.push(String(post._id));
  }

  const commentImageUrls: string[] = [];
  const createdCommentIds: string[] = [];

  for (const [postIndex, postId] of createdPostIds.entries()) {
    for (let commentIndex = 0; commentIndex < commentsPerPost; commentIndex += 1) {
      const commentSeed =
        REALISTIC_COMMENT_SEEDS[(postIndex * commentsPerPost + commentIndex) % REALISTIC_COMMENT_SEEDS.length];
      const imageUrls = [
        makeScopedImageUrl(
          "comment",
          `comment-photo-${postIndex + 1}-${commentIndex + 1}`,
          1,
        ),
      ];
      commentImageUrls.push(...imageUrls);

      const comment = await CommentModel.create({
        targetType: "Post",
        targetId: postId,
        text: commentSeed,
        imageUrls,
        createdBy: userId,
        lastUpdatedBy: userId,
        moderationStatus: "approved",
        approvedAt: new Date(),
        approvedBy: userId,
      });

      createdCommentIds.push(String(comment._id));
    }
  }

  return {
    postIds: createdPostIds,
    commentIds: createdCommentIds,
    postImageUrls,
    commentImageUrls,
  };
}

export async function seedModerationMixes(): Promise<ModerationMixSeedResult> {
  const baseline = await ensureBaselineSeed();
  const userId = new mongoose.Types.ObjectId(baseline.userId);
  const adminId = new mongoose.Types.ObjectId(baseline.adminId);
  const baseCommunityId = new mongoose.Types.ObjectId(baseline.communityId);
  const basePostId = new mongoose.Types.ObjectId(baseline.postId);

  const suffix = Date.now();

  const pendingCommunity = await CommunityModel.create({
    name: `${MODERATION_COMMUNITY_BASE_NAMES[0]}-pending-${suffix}`,
    createdBy: userId,
    lastUpdatedBy: userId,
    moderationStatus: "pending",
  });

  const approvedCommunity = await CommunityModel.create({
    name: `${MODERATION_COMMUNITY_BASE_NAMES[1]}-approved-${suffix}`,
    createdBy: userId,
    lastUpdatedBy: userId,
    moderationStatus: "approved",
    approvedAt: new Date(),
    approvedBy: adminId,
  });

  const rejectedCommunity = await CommunityModel.create({
    name: `${MODERATION_COMMUNITY_BASE_NAMES[2]}-rejected-${suffix}`,
    createdBy: userId,
    lastUpdatedBy: userId,
    moderationStatus: "rejected",
  });

  const pendingPost = await PostModel.create({
    title: `${MODERATION_POST_SEEDS[0].title} (Pending)`,
    content: MODERATION_POST_SEEDS[0].content,
    communities: [baseCommunityId],
    createdBy: userId,
    lastUpdatedBy: userId,
    moderationStatus: "pending",
  });

  const approvedPost = await PostModel.create({
    title: `${MODERATION_POST_SEEDS[1].title} (Approved)`,
    content: MODERATION_POST_SEEDS[1].content,
    communities: [baseCommunityId],
    createdBy: userId,
    lastUpdatedBy: userId,
    moderationStatus: "approved",
    approvedAt: new Date(),
    approvedBy: adminId,
  });

  const rejectedPost = await PostModel.create({
    title: `${MODERATION_POST_SEEDS[2].title} (Rejected)`,
    content: MODERATION_POST_SEEDS[2].content,
    communities: [baseCommunityId],
    createdBy: userId,
    lastUpdatedBy: userId,
    moderationStatus: "rejected",
  });

  const pendingComment = await CommentModel.create({
    targetType: "Post",
    targetId: basePostId,
    text: "Can you add a source for these numbers?",
    createdBy: userId,
    lastUpdatedBy: userId,
    moderationStatus: "pending",
  });

  const approvedComment = await CommentModel.create({
    targetType: "Post",
    targetId: basePostId,
    text: "Helpful summary. The checklist section is especially useful.",
    createdBy: userId,
    lastUpdatedBy: userId,
    moderationStatus: "approved",
    approvedAt: new Date(),
    approvedBy: adminId,
  });

  const rejectedComment = await CommentModel.create({
    targetType: "Post",
    targetId: basePostId,
    text: "This includes inaccurate claims and needs revision.",
    createdBy: userId,
    lastUpdatedBy: userId,
    moderationStatus: "rejected",
  });

  return {
    communityIdsByStatus: {
      pending: String(pendingCommunity._id),
      approved: String(approvedCommunity._id),
      rejected: String(rejectedCommunity._id),
    },
    postIdsByStatus: {
      pending: String(pendingPost._id),
      approved: String(approvedPost._id),
      rejected: String(rejectedPost._id),
    },
    commentIdsByStatus: {
      pending: String(pendingComment._id),
      approved: String(approvedComment._id),
      rejected: String(rejectedComment._id),
    },
  };
}

export async function seedOrphanCleanupScenario(): Promise<OrphanCleanupSeedResult> {
  const baseline = await ensureBaselineSeed();
  const userId = new mongoose.Types.ObjectId(baseline.userId);
  const baseCommunityId = new mongoose.Types.ObjectId(baseline.communityId);
  const basePostId = new mongoose.Types.ObjectId(baseline.postId);

  const referencedByScope = {
    post: [makeScopedImageUrl("post", "featured-community-recap", 1)],
    community: [
      makeScopedImageUrl("community", "general-hero-banner", 1),
      makeScopedImageUrl("community", "general-title-icon", 1),
    ],
    comment: [makeScopedImageUrl("comment", "trip-route-attachment", 1)],
  };

  await PostModel.updateOne(
    { _id: basePostId },
    { $set: { imageUrls: referencedByScope.post } },
  );

  await CommunityModel.updateOne(
    { _id: baseCommunityId },
    {
      $set: {
        bannerImageUrl: referencedByScope.community[0],
        titleImageUrl: referencedByScope.community[1],
      },
    },
  );

  await CommentModel.create({
    targetType: "Post",
    targetId: basePostId,
    text: "Sharing the route screenshot for reference.",
    imageUrls: referencedByScope.comment,
    createdBy: userId,
    lastUpdatedBy: userId,
    moderationStatus: "approved",
    approvedAt: new Date(),
    approvedBy: userId,
    recordStatus: "active",
  });

  const orphanCandidatesByScope = {
    post: [makeScopedImageUrl("post", "archived-post-attachment", 1)],
    community: [
      makeScopedImageUrl("community", "deprecated-community-banner", 1),
      makeScopedImageUrl("community", "deprecated-community-icon", 1),
    ],
    comment: [makeScopedImageUrl("comment", "deleted-comment-attachment", 1)],
  };

  const orphanSuffix = Date.now();

  await PostModel.create({
    title: `cleanup-orphan-post-${orphanSuffix}`,
    content: "Older archived post kept only for cleanup validation.",
    imageUrls: orphanCandidatesByScope.post,
    communities: [baseCommunityId],
    createdBy: userId,
    lastUpdatedBy: userId,
    moderationStatus: "approved",
    approvedAt: new Date(),
    approvedBy: userId,
    recordStatus: "deleted",
  });

  await CommunityModel.create({
    name: `cleanup-orphan-community-${orphanSuffix}`,
    bannerImageUrl: orphanCandidatesByScope.community[0],
    titleImageUrl: orphanCandidatesByScope.community[1],
    createdBy: userId,
    lastUpdatedBy: userId,
    moderationStatus: "approved",
    approvedAt: new Date(),
    approvedBy: userId,
    recordStatus: "deleted",
  });

  await CommentModel.create({
    targetType: "Post",
    targetId: basePostId,
    text: "Old comment attachment retained for orphan cleanup checks.",
    imageUrls: orphanCandidatesByScope.comment,
    createdBy: userId,
    lastUpdatedBy: userId,
    moderationStatus: "approved",
    approvedAt: new Date(),
    approvedBy: userId,
    recordStatus: "deleted",
  });

  return {
    referencedByScope,
    orphanCandidatesByScope,
  };
}

export async function cleanupDatabase() {
  await mongoose.disconnect();
  if (replSet) {
    await replSet.stop();
    replSet = null;
  }
}

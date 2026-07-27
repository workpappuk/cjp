import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { connectToDatabase } from "@/app/_lib/mongoose";
import { CommunityModel } from "@/app/_lib/models/Community";
import { PostModel } from "@/app/_lib/models/Post";
import { TagModel } from "@/app/_lib/models/Tag";
import { UserProfileModel } from "@/app/_lib/models/UserProfile";
import { TEST_USERS } from "@/tests/fixtures";

let replSet: MongoMemoryReplSet | null = null;

export type SeedResult = {
  adminId: string;
  userId: string;
  postId: string;
  communityId: string;
  tagId: string;
};

export async function createTestDatabase() {
  if (!replSet) {
    replSet = await MongoMemoryReplSet.create({
      replSet: { count: 1 },
    });
  }

  process.env.MONGODB_URI = replSet.getUri();
  process.env.MONGODB_DB = "threadforge_test";
  process.env.MONGODB_AUDIT_DB = "threadforge_test_audit";

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

export async function cleanupDatabase() {
  await mongoose.disconnect();
  if (replSet) {
    await replSet.stop();
    replSet = null;
  }
}

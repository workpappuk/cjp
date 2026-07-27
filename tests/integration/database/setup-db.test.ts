/** @vitest-environment node */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PostModel } from "@/app/_lib/models/Post";
import {
  cleanupDatabase,
  createTestDatabase,
  resetDatabase,
  seedDatabase,
} from "@/tests/setup/setupDb";

describe("database setup helpers", () => {
  beforeAll(async () => {
    await createTestDatabase();
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await cleanupDatabase();
  });

  it("seeds deterministic records", async () => {
    const seed = await seedDatabase();
    expect(seed.postId).toBeTruthy();

    const post = await PostModel.findById(seed.postId).lean();
    expect(post?.title).toBe("Seed Post");
  });

  it("resetDatabase clears persisted state", async () => {
    await seedDatabase();
    await resetDatabase();

    const count = await PostModel.countDocuments();
    expect(count).toBe(0);
  });
});

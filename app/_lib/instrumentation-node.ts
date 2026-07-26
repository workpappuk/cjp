import { connectToDatabase } from "@/app/_lib/mongoose";
import { TagModel } from "@/app/_lib/models/Tag";
import { readFile } from "node:fs/promises";
import path from "node:path";

let hasConnectedOnStartup = false;
let hasSeededTagsOnStartup = false;

const TAG_SEED_FILE_PATH = path.join(process.cwd(), "app/_lib/metadata/tags.txt");
const TAG_SEED_BATCH_SIZE = 1000;

function normalizeTagName(name: string) {
  return name.trim().toLowerCase();
}

function isValidTagName(name: string) {
  return Boolean(name) && name.length <= 64 && !/\s/.test(name);
}

async function seedTagsOnStartup() {
  if (hasSeededTagsOnStartup) {
    return;
  }

  const fileContent = await readFile(TAG_SEED_FILE_PATH, "utf-8");
  const dedupedTags = new Set<string>();

  for (const line of fileContent.split(/\r?\n/)) {
    const normalizedName = normalizeTagName(line);
    if (isValidTagName(normalizedName)) {
      dedupedTags.add(normalizedName);
    }
  }

  const names = [...dedupedTags];

  for (let index = 0; index < names.length; index += TAG_SEED_BATCH_SIZE) {
    const batch = names.slice(index, index + TAG_SEED_BATCH_SIZE);
    await TagModel.bulkWrite(
      batch.map((name) => ({
        updateOne: {
          filter: { normalizedName: name },
          update: {
            $setOnInsert: {
              name,
              normalizedName: name,
              isActive: true,
              createdBy: null,
              lastUpdatedBy: null,
            },
          },
          upsert: true,
        },
      })),
      { ordered: false },
    );
  }

  hasSeededTagsOnStartup = true;
  console.log(`[startup] Tag seed complete (${names.length} tags)`);
}

export async function registerMongoOnStartup() {
  if (hasConnectedOnStartup) {
    return;
  }

  try {
    await connectToDatabase();
    hasConnectedOnStartup = true;
    console.log("[startup] MongoDB connected");

    try {
      await seedTagsOnStartup();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.warn(`[startup] Tag seed failed: ${message}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.warn(`[startup] MongoDB unavailable: ${message}`);
  }
}

await registerMongoOnStartup();

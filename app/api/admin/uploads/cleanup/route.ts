import { NextResponse } from "next/server";
import { connectToDatabase } from "@/app/_lib/mongoose";
import { getSessionActor } from "@/app/_lib/admin";
import { PostModel } from "@/app/_lib/models/Post";
import { CommunityModel } from "@/app/_lib/models/Community";
import { CommentModel } from "@/app/_lib/models/Comment";
import {
  deleteStoredUploadUrl,
  isSupportedUploadScope,
  listStoredUploadUrls,
} from "@/app/_lib/media-storage";
import { sanitizeScopedUploadUrl, sanitizeScopedUploadUrls } from "@/app/_lib/upload-url";
import type { UploadScope } from "@/app/_types/uploads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_MAX_DELETE = 500;
const MAX_DELETE_LIMIT = 5_000;

function normalizeMaxDelete(raw: unknown) {
  const parsed = Number.parseInt(String(raw ?? ""), 10);
  if (Number.isNaN(parsed)) {
    return DEFAULT_MAX_DELETE;
  }

  return Math.min(Math.max(parsed, 1), MAX_DELETE_LIMIT);
}

async function collectActiveReferencesByScope(scope: UploadScope) {
  if (scope === "post") {
    const posts = await PostModel.find({ recordStatus: "active" }, { imageUrls: 1 }).lean();
    return new Set(
      posts.flatMap((post) => sanitizeScopedUploadUrls(post.imageUrls, "post")),
    );
  }

  if (scope === "community") {
    const communities = await CommunityModel.find(
      { recordStatus: "active" },
      { bannerImageUrl: 1, titleImageUrl: 1 },
    ).lean();

    const refs = communities.flatMap((community) => {
      const banner = sanitizeScopedUploadUrl(community.bannerImageUrl, "community");
      const title = sanitizeScopedUploadUrl(community.titleImageUrl, "community");
      return [banner, title].filter(Boolean);
    });

    return new Set(refs);
  }

  if (scope === "comment") {
    const comments = await CommentModel.find(
      { recordStatus: "active" },
      { imageUrls: 1 },
    ).lean();

    const refs = comments.flatMap((comment) => {
      if (!Array.isArray(comment.imageUrls)) {
        return [] as string[];
      }

      const rawImageUrls = comment.imageUrls as unknown[];

      return sanitizeScopedUploadUrls(rawImageUrls, "comment");
    });

    return new Set(refs);
  }

  return new Set<string>();
}

export async function POST(request: Request) {
  await connectToDatabase();
  const actor = await getSessionActor();
  if (!actor?.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const payload = (await request.json().catch(() => ({}))) as {
    scope?: UploadScope | "all";
    dryRun?: boolean;
    maxDelete?: number;
  };

  const scopeRaw = String(payload.scope ?? "post").trim().toLowerCase();
  const requestedScopes: UploadScope[] =
    scopeRaw === "all"
      ? ["post", "community", "comment"]
      : isSupportedUploadScope(scopeRaw)
        ? [scopeRaw]
        : [];

  if (requestedScopes.length === 0) {
    return NextResponse.json({ error: "Invalid scope." }, { status: 400 });
  }

  const dryRun = payload.dryRun !== false;
  const maxDelete = normalizeMaxDelete(payload.maxDelete);

  const perScope: Array<{
    scope: UploadScope;
    totalStored: number;
    totalReferenced: number;
    orphanedCount: number;
    deletedCount: number;
    sampleOrphans: string[];
  }> = [];

  let deletedTotal = 0;

  for (const scope of requestedScopes) {
    const [storedUrls, referencedUrlsSet] = await Promise.all([
      listStoredUploadUrls(scope),
      collectActiveReferencesByScope(scope),
    ]);

    const orphaned = storedUrls.filter((url) => !referencedUrlsSet.has(url));
    let deletedCount = 0;

    if (!dryRun && deletedTotal < maxDelete) {
      const availableBudget = maxDelete - deletedTotal;
      const toDelete = orphaned.slice(0, availableBudget);

      for (const orphanUrl of toDelete) {
        const deleted = await deleteStoredUploadUrl(orphanUrl);
        if (deleted) {
          deletedCount += 1;
          deletedTotal += 1;
        }
      }
    }

    perScope.push({
      scope,
      totalStored: storedUrls.length,
      totalReferenced: referencedUrlsSet.size,
      orphanedCount: orphaned.length,
      deletedCount,
      sampleOrphans: orphaned.slice(0, 20),
    });
  }

  return NextResponse.json({
    dryRun,
    maxDelete,
    scope: scopeRaw,
    deletedTotal,
    results: perScope,
  });
}

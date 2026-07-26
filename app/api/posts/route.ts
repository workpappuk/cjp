import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectToDatabase } from "@/app/_lib/mongoose";
import { PostModel } from "@/app/_lib/models/Post";
import { UserProfileModel } from "@/app/_lib/models/UserProfile";
import { CommunityModel } from "@/app/_lib/models/Community";
import { TagModel } from "@/app/_lib/models/Tag";
import { getSessionActor } from "@/app/_lib/admin";
import { checkRateLimit } from "@/app/_lib/rate-limit";
import {
  getApiErrorMessage,
  getOrCreateRequestId,
  logApiError,
} from "@/app/_lib/api-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getCanonicalActorProfileId(email: string) {
  if (!email) {
    return null;
  }

  const profiles = await UserProfileModel.find({ email }, { _id: 1 })
    .sort({ updatedAt: -1, createdAt: -1, _id: -1 })
    .lean();

  const keeper = profiles[0]?._id ?? null;

  if (profiles.length > 1) {
    const staleIds = profiles.slice(1).map((profile) => profile._id);
    await UserProfileModel.deleteMany({ _id: { $in: staleIds } });
  }

  return keeper;
}

async function resolveCommunityIds(input: string[]) {
  const normalized = [...new Set(input.map((item) => item.trim()).filter(Boolean))];
  if (normalized.length === 0) {
    return [] as Types.ObjectId[];
  }

  const idCandidates = normalized.filter((item) => Types.ObjectId.isValid(item));
  const nameCandidates = normalized
    .filter((item) => !Types.ObjectId.isValid(item))
    .map((item) => item.toLowerCase());

  const [byId, byName] = await Promise.all([
    idCandidates.length > 0
      ? CommunityModel.find({ _id: { $in: idCandidates } }, { _id: 1 }).lean()
      : Promise.resolve([]),
    nameCandidates.length > 0
      ? CommunityModel.find({ name: { $in: nameCandidates } }, { _id: 1 }).lean()
      : Promise.resolve([]),
  ]);

  const uniqueIds = new Set<string>();
  for (const community of [...byId, ...byName]) {
    uniqueIds.add(String(community._id));
  }

  return [...uniqueIds].map((id) => new Types.ObjectId(id));
}

type JoinedCommunityValue =
  | string
  | Types.ObjectId
  | { _id?: Types.ObjectId | string; name?: string }
  | null
  | undefined;

type JoinedTagValue =
  | string
  | Types.ObjectId
  | { _id?: Types.ObjectId | string; name?: string }
  | null
  | undefined;

function extractObjectIdStrings(values: Array<string | Types.ObjectId | null | undefined>) {
  const ids = new Set<string>();

  for (const value of values) {
    if (!value) continue;
    const id = String(value);
    if (Types.ObjectId.isValid(id)) {
      ids.add(id);
    }
  }

  return [...ids];
}

function resolveRefNames(
  values: Array<string | Types.ObjectId | { name?: string } | null | undefined> | undefined,
  nameById: Map<string, string>,
) {
  if (!Array.isArray(values)) {
    return [] as string[];
  }

  return values
    .map((value) => {
      if (!value) {
        return "";
      }

      if (typeof value === "object" && "name" in value) {
        return (value.name ?? "").trim().toLowerCase();
      }

      const raw = String(value);
      if (Types.ObjectId.isValid(raw)) {
        return (nameById.get(raw) ?? "").trim().toLowerCase();
      }

      return raw.trim().toLowerCase();
    })
    .filter(Boolean);
}

export async function GET(request: Request) {
  const requestId = getOrCreateRequestId(request);

  try {
    await connectToDatabase();
    const actor = await getSessionActor();
    const canViewUnapproved = Boolean(actor?.isAdmin);

    const { searchParams } = new URL(request.url);
    const communityFilters = searchParams
      .getAll("community")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);

    const communityIds = await resolveCommunityIds(communityFilters);

    const query =
      communityFilters.length > 0
        ? communityIds.length > 0
          ? {
              communities: { $in: communityIds },
              ...(canViewUnapproved ? {} : { moderationStatus: "approved" }),
            }
          : { _id: { $in: [] } }
        : canViewUnapproved
          ? {}
          : { moderationStatus: "approved" };

    const posts = await PostModel.find(query)
      .sort({ createdAt: -1 })
      .limit(500)
      .lean();

    const communityRefIds = extractObjectIdStrings(
      posts.flatMap((post) =>
        Array.isArray(post.communities)
          ? (post.communities as Array<string | Types.ObjectId>)
          : [],
      ),
    );

    const tagRefIds = extractObjectIdStrings(
      posts.flatMap((post) =>
        Array.isArray(post.tags) ? (post.tags as Array<string | Types.ObjectId>) : [],
      ),
    );

    const [communities, tags] = await Promise.all([
      communityRefIds.length > 0
        ? CommunityModel.find({ _id: { $in: communityRefIds } }, { _id: 1, name: 1 }).lean()
        : Promise.resolve([]),
      tagRefIds.length > 0
        ? TagModel.find({ _id: { $in: tagRefIds } }, { _id: 1, name: 1 }).lean()
        : Promise.resolve([]),
    ]);

    const communityNameById = new Map<string, string>(
      communities.map((community) => [String(community._id), community.name]),
    );
    const tagNameById = new Map<string, string>(
      tags.map((tag) => [String(tag._id), tag.name]),
    );

    return NextResponse.json(
      posts.map((post) => ({
        id: String(post._id),
        title: post.title,
        content: post.content,
        communities: resolveRefNames(
          post.communities as JoinedCommunityValue[] | undefined,
          communityNameById,
        ),
        tags: resolveRefNames(post.tags as JoinedTagValue[] | undefined, tagNameById),
        createdBy: post.createdBy ? String(post.createdBy) : "",
        lastUpdatedBy: post.lastUpdatedBy ? String(post.lastUpdatedBy) : "",
        moderationStatus: post.moderationStatus ?? "approved",
        createdAt: post.createdAt,
        updatedAt: post.updatedAt,
      })),
      {
        headers: {
          "x-request-id": requestId,
        },
      },
    );
  } catch (error) {
    logApiError({
      route: "/api/posts",
      method: "GET",
      error,
      requestId,
    });
    const message = getApiErrorMessage(error, "Failed to fetch posts");
    return NextResponse.json(
      { error: message, requestId },
      {
        status: 500,
        headers: {
          "x-request-id": requestId,
        },
      },
    );
  }
}

export async function POST(request: Request) {
  const requestId = getOrCreateRequestId(request);

  const rateLimit = await checkRateLimit({
    scope: "posts:create",
    request,
    limit: 30,
    windowMs: 60_000,
  });

  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        error: "Too many requests. Please try again later.",
        requestId,
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(rateLimit.retryAfterSeconds),
          "x-request-id": requestId,
        },
      },
    );
  }

  try {
    await connectToDatabase();
    const actor = await getSessionActor();
    const actorEmail = actor?.email ?? "";
    const actorProfileId = await getCanonicalActorProfileId(actorEmail);

    const payload = (await request.json()) as {
      title?: string;
      content?: string;
      communities?: string[];
    };

    const title = payload?.title?.trim() ?? "";
    const content = payload?.content?.trim() ?? "";
    const communities = Array.isArray(payload?.communities)
      ? payload.communities
          .map((item) => item.trim().toLowerCase())
          .filter(Boolean)
      : [];
    const communityIds = await resolveCommunityIds(communities);

    if (!title || !content) {
      return NextResponse.json(
        { error: "Title and content are required.", requestId },
        {
          status: 400,
          headers: {
            "x-request-id": requestId,
          },
        },
      );
    }

    const moderationStatus = actor?.isAdmin ? "approved" : "pending";
    const approvedAt = moderationStatus === "approved" ? new Date() : null;

    const created = await PostModel.create({
      title,
      content,
      communities: communityIds,
      createdBy: actorProfileId,
      lastUpdatedBy: actorProfileId,
      moderationStatus,
      approvedAt,
      approvedBy: moderationStatus === "approved" ? actorProfileId : null,
    });

    const createdDoc = await PostModel.findById(created._id).lean();

    const createdCommunityIds = extractObjectIdStrings(
      Array.isArray(createdDoc?.communities)
        ? (createdDoc.communities as Array<string | Types.ObjectId>)
        : [],
    );
    const createdTagIds = extractObjectIdStrings(
      Array.isArray(createdDoc?.tags) ? (createdDoc.tags as Array<string | Types.ObjectId>) : [],
    );

    const [createdCommunities, createdTags] = await Promise.all([
      createdCommunityIds.length > 0
        ? CommunityModel.find({ _id: { $in: createdCommunityIds } }, { _id: 1, name: 1 }).lean()
        : Promise.resolve([]),
      createdTagIds.length > 0
        ? TagModel.find({ _id: { $in: createdTagIds } }, { _id: 1, name: 1 }).lean()
        : Promise.resolve([]),
    ]);

    const createdCommunityNameById = new Map<string, string>(
      createdCommunities.map((community) => [String(community._id), community.name]),
    );
    const createdTagNameById = new Map<string, string>(
      createdTags.map((tag) => [String(tag._id), tag.name]),
    );

    return NextResponse.json(
      {
        requestId,
        id: String(createdDoc?._id ?? created._id),
        title: createdDoc?.title ?? created.title,
        content: createdDoc?.content ?? created.content,
        communities: resolveRefNames(
          (createdDoc?.communities as JoinedCommunityValue[] | undefined) ?? [],
          createdCommunityNameById,
        ),
        tags: resolveRefNames(
          (createdDoc?.tags as JoinedTagValue[] | undefined) ?? [],
          createdTagNameById,
        ),
        createdBy: createdDoc?.createdBy ? String(createdDoc.createdBy) : "",
        lastUpdatedBy: createdDoc?.lastUpdatedBy ? String(createdDoc.lastUpdatedBy) : "",
        moderationStatus: createdDoc?.moderationStatus ?? moderationStatus,
        approvedAt: createdDoc?.approvedAt ?? approvedAt,
        createdAt: createdDoc?.createdAt ?? created.createdAt,
        updatedAt: createdDoc?.updatedAt ?? created.updatedAt,
      },
      {
        status: 201,
        headers: {
          "x-request-id": requestId,
        },
      },
    );
  } catch (error) {
    logApiError({
      route: "/api/posts",
      method: "POST",
      error,
      requestId,
    });
    const message = getApiErrorMessage(error, "Failed to create post");
    return NextResponse.json(
      { error: message, requestId },
      {
        status: 500,
        headers: {
          "x-request-id": requestId,
        },
      },
    );
  }
}

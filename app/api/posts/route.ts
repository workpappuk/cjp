import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Types } from "mongoose";
import { authOptions } from "@/app/_lib/auth";
import { connectToDatabase } from "@/app/_lib/mongoose";
import { PostModel } from "@/app/_lib/models/Post";
import { UserProfileModel } from "@/app/_lib/models/UserProfile";
import { CommunityModel } from "@/app/_lib/models/Community";
import { checkRateLimit } from "@/app/_lib/rate-limit";
import {
  getApiErrorMessage,
  getOrCreateRequestId,
  logApiError,
} from "@/app/_lib/api-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

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

function toCommunityNames(values: JoinedCommunityValue[] | undefined) {
  if (!Array.isArray(values)) {
    return [] as string[];
  }

  return values
    .map((item) => {
      if (!item) return "";
      if (typeof item === "string") {
        if (Types.ObjectId.isValid(item)) {
          return "";
        }
        return item.trim().toLowerCase();
      }
      if (item instanceof Types.ObjectId) {
        return "";
      }
      return (item.name ?? "").trim().toLowerCase();
    })
    .filter(Boolean);
}

export async function GET(request: Request) {
  const requestId = getOrCreateRequestId(request);

  try {
    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const communityFilters = searchParams
      .getAll("community")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);

    const communityIds = await resolveCommunityIds(communityFilters);

    const query =
      communityFilters.length > 0
        ? communityIds.length > 0
          ? { communities: { $in: communityIds } }
          : { _id: { $in: [] } }
        : {};

    const posts = await PostModel.find(query)
      .populate("communities", "name")
      .sort({ createdAt: -1 })
      .limit(500)
      .lean();

    return NextResponse.json(
      posts.map((post) => ({
        id: String(post._id),
        title: post.title,
        content: post.content,
        communities: toCommunityNames(post.communities as JoinedCommunityValue[]),
        createdBy: post.createdBy ? String(post.createdBy) : "",
        lastUpdatedBy: post.lastUpdatedBy ? String(post.lastUpdatedBy) : "",
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
    const session = await getServerSession(authOptions);
    const actorEmail = session?.user?.email ? normalizeEmail(session.user.email) : "";
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

    const created = await PostModel.create({
      title,
      content,
      communities: communityIds,
      createdBy: actorProfileId,
      lastUpdatedBy: actorProfileId,
    });

    const populatedCreated = await PostModel.findById(created._id)
      .populate("communities", "name")
      .lean();

    return NextResponse.json(
      {
        requestId,
        id: String(populatedCreated?._id ?? created._id),
        title: populatedCreated?.title ?? created.title,
        content: populatedCreated?.content ?? created.content,
        communities: toCommunityNames(
          (populatedCreated?.communities as JoinedCommunityValue[] | undefined) ?? [],
        ),
        createdBy: populatedCreated?.createdBy ? String(populatedCreated.createdBy) : "",
        lastUpdatedBy: populatedCreated?.lastUpdatedBy ? String(populatedCreated.lastUpdatedBy) : "",
        createdAt: populatedCreated?.createdAt ?? created.createdAt,
        updatedAt: populatedCreated?.updatedAt ?? created.updatedAt,
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

import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectToDatabase } from "@/app/_lib/mongoose";
import { CommunityModel } from "@/app/_lib/models/Community";
import { UserProfileModel } from "@/app/_lib/models/UserProfile";
import { getSessionActor } from "@/app/_lib/admin";
import { checkRateLimit } from "@/app/_lib/rate-limit";
import { sanitizeScopedUploadUrl } from "@/app/_lib/upload-url";
import {
  getApiErrorMessage,
  getOrCreateRequestId,
  logApiError,
} from "@/app/_lib/api-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type JoinedTagValue =
  | string
  | Types.ObjectId
  | { _id?: Types.ObjectId | string; name?: string }
  | null
  | undefined;

function toTagNames(values: JoinedTagValue[] | undefined) {
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

export async function GET(request: Request) {
  const requestId = getOrCreateRequestId(request);

  try {
    await connectToDatabase();
    const actor = await getSessionActor();
    const canViewUnapproved = Boolean(actor?.isAdmin);
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim().toLowerCase() ?? "";

    const query: Record<string, unknown> = canViewUnapproved
      ? {}
      : { moderationStatus: "approved" };

    if (search) {
      query.name = { $regex: search, $options: "i" };
    }

    const communities = await CommunityModel.find(query)
      .populate("tags", "name")
      .sort({ name: 1 })
      .lean();

    return NextResponse.json(
      communities.map((community) => ({
        id: String(community._id),
        name: community.name,
        tags: toTagNames(community.tags as JoinedTagValue[]),
        bannerImageUrl: sanitizeScopedUploadUrl(community.bannerImageUrl, "community"),
        titleImageUrl: sanitizeScopedUploadUrl(community.titleImageUrl, "community"),
        createdBy: community.createdBy ? String(community.createdBy) : "",
        lastUpdatedBy: community.lastUpdatedBy ? String(community.lastUpdatedBy) : "",
        moderationStatus: community.moderationStatus ?? "approved",
        createdAt: community.createdAt,
        updatedAt: community.updatedAt,
      })),
      {
        headers: {
          "x-request-id": requestId,
        },
      },
    );
  } catch (error) {
    logApiError({
      route: "/api/communities",
      method: "GET",
      error,
      requestId,
    });
    const message = getApiErrorMessage(error, "Failed to fetch communities");
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
    scope: "communities:create",
    request,
    limit: 10,
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

    const payload = (await request.json()) as { name?: string };
    const normalizedName = payload?.name?.trim().toLowerCase() ?? "";

    if (normalizedName.length < 3) {
      return NextResponse.json(
        { error: "Community name must be at least 3 characters.", requestId },
        {
          status: 400,
          headers: {
            "x-request-id": requestId,
          },
        },
      );
    }

    const existing = await CommunityModel.findOne({ name: normalizedName }).lean();
    if (existing) {
      return NextResponse.json(
        { error: "Community already exists.", requestId },
        {
          status: 409,
          headers: {
            "x-request-id": requestId,
          },
        },
      );
    }

    const moderationStatus = actor?.isAdmin ? "approved" : "pending";
    const approvedAt = moderationStatus === "approved" ? new Date() : null;

    const created = await CommunityModel.create({
      name: normalizedName,
      createdBy: actorProfileId,
      lastUpdatedBy: actorProfileId,
      moderationStatus,
      approvedAt,
      approvedBy: moderationStatus === "approved" ? actorProfileId : null,
    });

    return NextResponse.json(
      {
        requestId,
        id: String(created._id),
        name: created.name,
        bannerImageUrl: sanitizeScopedUploadUrl(created.bannerImageUrl, "community"),
        titleImageUrl: sanitizeScopedUploadUrl(created.titleImageUrl, "community"),
        createdBy: created.createdBy ? String(created.createdBy) : "",
        lastUpdatedBy: created.lastUpdatedBy ? String(created.lastUpdatedBy) : "",
        moderationStatus: created.moderationStatus ?? moderationStatus,
        approvedAt: created.approvedAt ?? approvedAt,
        createdAt: created.createdAt,
        updatedAt: created.updatedAt,
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
      route: "/api/communities",
      method: "POST",
      error,
      requestId,
    });
    const message = getApiErrorMessage(error, "Failed to create community");
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

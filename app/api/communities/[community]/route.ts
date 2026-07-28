import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectToDatabase } from "@/app/_lib/mongoose";
import { CommunityModel } from "@/app/_lib/models/Community";
import { UserProfileModel } from "@/app/_lib/models/UserProfile";
import { getSessionActor } from "@/app/_lib/admin";
import { sanitizeScopedUploadUrl } from "@/app/_lib/upload-url";
import {
  getApiErrorMessage,
  getOrCreateRequestId,
  logApiError,
} from "@/app/_lib/api-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ParamsContext = {
  params: Promise<{
    community: string;
  }>;
};

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

function getVersionFilter(version: number | undefined) {
  if (typeof version === "number") {
    return { __v: version };
  }

  return { __v: { $exists: false } };
}

export async function GET(request: Request, { params }: ParamsContext) {
  const requestId = getOrCreateRequestId(request);
  let communityName = "";

  try {
    await connectToDatabase();
    const actor = await getSessionActor();
    const canViewUnapproved = Boolean(actor?.isAdmin);

    ({ community: communityName } = await params);
    const normalizedName = decodeURIComponent(communityName).trim().toLowerCase();

    if (!normalizedName) {
      return NextResponse.json(
        { error: "Community name is required.", requestId },
        {
          status: 400,
          headers: {
            "x-request-id": requestId,
          },
        },
      );
    }

    const community = await CommunityModel.findOne({
      name: normalizedName,
      ...(canViewUnapproved ? {} : { moderationStatus: "approved" }),
    })
      .populate("tags", "name")
      .lean();

    if (!community) {
      return NextResponse.json(
        { error: "Community not found.", requestId },
        {
          status: 404,
          headers: {
            "x-request-id": requestId,
          },
        },
      );
    }

    return NextResponse.json(
      {
        requestId,
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
      },
      {
        headers: {
          "x-request-id": requestId,
        },
      },
    );
  } catch (error) {
    logApiError({
      route: "/api/communities/[community]",
      method: "GET",
      error,
      requestId,
      context: {
        community: communityName,
      },
    });

    const message = getApiErrorMessage(error, "Failed to fetch community");
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

export async function PATCH(request: Request, { params }: ParamsContext) {
  const requestId = getOrCreateRequestId(request);
  let communityName = "";

  try {
    await connectToDatabase();
    const actor = await getSessionActor();
    const actorEmail = actor?.email ?? "";
    const actorProfileId = await getCanonicalActorProfileId(actorEmail);

    if (!actorProfileId) {
      return NextResponse.json(
        { error: "Unauthorized.", requestId },
        {
          status: 401,
          headers: {
            "x-request-id": requestId,
          },
        },
      );
    }

    const payload = (await request.json()) as {
      bannerImageUrl?: string;
      titleImageUrl?: string;
    };

    ({ community: communityName } = await params);
    const normalizedName = decodeURIComponent(communityName).trim().toLowerCase();

    if (!normalizedName) {
      return NextResponse.json(
        { error: "Community name is required.", requestId },
        {
          status: 400,
          headers: {
            "x-request-id": requestId,
          },
        },
      );
    }

    const existing = await CommunityModel.findOne(
      { name: normalizedName },
      { _id: 1, createdBy: 1, __v: 1, bannerImageUrl: 1, titleImageUrl: 1 },
    ).lean();

    if (!existing) {
      return NextResponse.json(
        { error: "Community not found.", requestId },
        {
          status: 404,
          headers: {
            "x-request-id": requestId,
          },
        },
      );
    }

    if (!existing.createdBy || String(existing.createdBy) !== String(actorProfileId)) {
      return NextResponse.json(
        { error: "Only community owners can update community images.", requestId },
        {
          status: 403,
          headers: {
            "x-request-id": requestId,
          },
        },
      );
    }

    const hasBannerField = Object.prototype.hasOwnProperty.call(payload, "bannerImageUrl");
    const hasTitleField = Object.prototype.hasOwnProperty.call(payload, "titleImageUrl");

    if (!hasBannerField && !hasTitleField) {
      return NextResponse.json(
        { error: "At least one image field is required.", requestId },
        {
          status: 400,
          headers: {
            "x-request-id": requestId,
          },
        },
      );
    }

    const nextSet: {
      bannerImageUrl?: string;
      titleImageUrl?: string;
      lastUpdatedBy?: Types.ObjectId;
    } = {
      lastUpdatedBy: new Types.ObjectId(String(actorProfileId)),
    };

    if (hasBannerField) {
      nextSet.bannerImageUrl = sanitizeScopedUploadUrl(payload.bannerImageUrl, "community");
    }

    if (hasTitleField) {
      nextSet.titleImageUrl = sanitizeScopedUploadUrl(payload.titleImageUrl, "community");
    }

    const updated = await CommunityModel.findOneAndUpdate(
      {
        _id: existing._id,
        ...getVersionFilter(existing.__v),
      },
      {
        $set: nextSet,
      },
      {
        new: true,
      },
    ).lean();

    if (!updated) {
      return NextResponse.json(
        { error: "Community changed while updating. Please retry.", requestId },
        {
          status: 409,
          headers: {
            "x-request-id": requestId,
          },
        },
      );
    }

    return NextResponse.json(
      {
        requestId,
        id: String(updated._id),
        name: updated.name,
        bannerImageUrl: sanitizeScopedUploadUrl(updated.bannerImageUrl, "community"),
        titleImageUrl: sanitizeScopedUploadUrl(updated.titleImageUrl, "community"),
        createdBy: updated.createdBy ? String(updated.createdBy) : "",
        lastUpdatedBy: updated.lastUpdatedBy ? String(updated.lastUpdatedBy) : "",
        updatedAt: updated.updatedAt,
      },
      {
        headers: {
          "x-request-id": requestId,
        },
      },
    );
  } catch (error) {
    logApiError({
      route: "/api/communities/[community]",
      method: "PATCH",
      error,
      requestId,
      context: {
        community: communityName,
      },
    });

    const message = getApiErrorMessage(error, "Failed to update community images");
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

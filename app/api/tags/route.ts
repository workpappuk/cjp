import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Types } from "mongoose";
import { authOptions } from "@/app/_lib/auth";
import { connectToDatabase } from "@/app/_lib/mongoose";
import { TagModel } from "@/app/_lib/models/Tag";
import { UserProfileModel } from "@/app/_lib/models/UserProfile";
import { PostModel } from "@/app/_lib/models/Post";
import { CommunityModel } from "@/app/_lib/models/Community";
import { checkRateLimit } from "@/app/_lib/rate-limit";
import {
  getApiErrorMessage,
  getOrCreateRequestId,
  logApiError,
} from "@/app/_lib/api-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TargetType = "Post" | "Community";

type TargetInput = {
  targetType?: string;
  targetId?: string;
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function normalizeTagName(name: string) {
  return name.trim().toLowerCase();
}

function isTargetType(value: string): value is TargetType {
  return value === "Post" || value === "Community";
}

function isDuplicateKeyError(error: { code?: number } | Error | null | undefined) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: number }).code === 11000
  );
}

function validateTargetInput(payload: TargetInput) {
  const targetTypeRaw = payload?.targetType?.trim() ?? "";
  const targetIdRaw = payload?.targetId?.trim() ?? "";

  if (!isTargetType(targetTypeRaw)) {
    return { error: "Invalid targetType. Use Post or Community." };
  }

  if (!Types.ObjectId.isValid(targetIdRaw)) {
    return { error: "Invalid targetId." };
  }

  return {
    targetType: targetTypeRaw,
    targetIdRaw,
  };
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

async function requireActorProfileId() {
  const session = await getServerSession(authOptions);
  const actorEmail = session?.user?.email ? normalizeEmail(session.user.email) : "";

  if (!actorEmail) {
    return null;
  }

  const actorProfileId = await getCanonicalActorProfileId(actorEmail);
  return actorProfileId ? new Types.ObjectId(String(actorProfileId)) : null;
}

async function upsertDictionaryTag(name: string, actorProfileId: Types.ObjectId) {
  const normalizedName = normalizeTagName(name);

  let tag = await TagModel.findOneAndUpdate(
    { normalizedName },
    {
      $setOnInsert: {
        name,
        normalizedName,
        createdBy: actorProfileId,
      },
      $set: {
        name,
        isActive: true,
        lastUpdatedBy: actorProfileId,
      },
    },
    {
      upsert: true,
      returnDocument: "after",
      setDefaultsOnInsert: true,
      lean: true,
    },
  );

  if (!tag) {
    tag = await TagModel.findOne({ normalizedName }).lean();
  }

  return tag;
}

async function getTargetOwnerAndTags(targetType: TargetType, targetId: string) {
  if (targetType === "Post") {
    return PostModel.findById(targetId, { createdBy: 1, tags: 1 }).lean();
  }

  return CommunityModel.findById(targetId, { createdBy: 1, tags: 1 }).lean();
}

async function ensureOwner(
  targetType: TargetType,
  targetId: string,
  actorProfileId: Types.ObjectId,
) {
  const target = await getTargetOwnerAndTags(targetType, targetId);

  if (!target) {
    return { error: "Target not found.", status: 404 as const };
  }

  if (!target.createdBy || String(target.createdBy) !== String(actorProfileId)) {
    return { error: "Only the target owner can manage tags.", status: 403 as const };
  }

  return { target };
}

async function attachTagToTarget(targetType: TargetType, targetId: string, tagId: Types.ObjectId, actorProfileId: Types.ObjectId) {
  const update = {
    $addToSet: { tags: tagId },
    $set: { lastUpdatedBy: actorProfileId },
  };

  if (targetType === "Post") {
    await PostModel.updateOne({ _id: targetId }, update);
    return;
  }

  await CommunityModel.updateOne({ _id: targetId }, update);
}

async function detachTagFromTarget(targetType: TargetType, targetId: string, tagId: Types.ObjectId, actorProfileId: Types.ObjectId) {
  const update = {
    $pull: { tags: tagId },
    $set: { lastUpdatedBy: actorProfileId },
  };

  if (targetType === "Post") {
    await PostModel.updateOne({ _id: targetId }, update);
    return;
  }

  await CommunityModel.updateOne({ _id: targetId }, update);
}

export async function GET(request: Request) {
  const requestId = getOrCreateRequestId(request);

  try {
    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const targetTypeRaw = (searchParams.get("targetType") ?? "").trim();
    const targetIdRaw = (searchParams.get("targetId") ?? "").trim();

    if ((targetTypeRaw && !targetIdRaw) || (!targetTypeRaw && targetIdRaw)) {
      return NextResponse.json(
        { error: "targetType and targetId must be provided together.", requestId },
        {
          status: 400,
          headers: {
            "x-request-id": requestId,
          },
        },
      );
    }

    if (targetTypeRaw) {
      const parsed = validateTargetInput({ targetType: targetTypeRaw, targetId: targetIdRaw });
      if ("error" in parsed) {
        return NextResponse.json(
          { error: parsed.error, requestId },
          {
            status: 400,
            headers: {
              "x-request-id": requestId,
            },
          },
        );
      }

      const target = await getTargetOwnerAndTags(parsed.targetType, parsed.targetIdRaw);
      if (!target) {
        return NextResponse.json(
          { error: "Target not found.", requestId },
          {
            status: 404,
            headers: {
              "x-request-id": requestId,
            },
          },
        );
      }

      const tagIds = Array.isArray(target.tags)
        ? target.tags.map((id: Types.ObjectId | string) => new Types.ObjectId(String(id)))
        : [];

      const tags = tagIds.length
        ? await TagModel.find({ _id: { $in: tagIds }, isActive: true })
            .sort({ createdAt: -1 })
            .lean()
        : [];

      return NextResponse.json(
        tags.map((tag) => ({
          id: String(tag._id),
          name: tag.name,
          normalizedName: tag.normalizedName,
          targetType: parsed.targetType,
          targetId: parsed.targetIdRaw,
          createdBy: tag.createdBy ? String(tag.createdBy) : "",
          lastUpdatedBy: tag.lastUpdatedBy ? String(tag.lastUpdatedBy) : "",
          createdAt: tag.createdAt,
          updatedAt: tag.updatedAt,
        })),
        {
          headers: {
            "x-request-id": requestId,
          },
        },
      );
    }

    const tags = await TagModel.find({ isActive: true })
      .sort({ createdAt: -1 })
      .limit(500)
      .lean();

    return NextResponse.json(
      tags.map((tag) => ({
        id: String(tag._id),
        name: tag.name,
        normalizedName: tag.normalizedName,
        targetType: null,
        targetId: null,
        createdBy: tag.createdBy ? String(tag.createdBy) : "",
        lastUpdatedBy: tag.lastUpdatedBy ? String(tag.lastUpdatedBy) : "",
        createdAt: tag.createdAt,
        updatedAt: tag.updatedAt,
      })),
      {
        headers: {
          "x-request-id": requestId,
        },
      },
    );
  } catch (error) {
    logApiError({
      route: "/api/tags",
      method: "GET",
      error,
      requestId,
    });
    const message = getApiErrorMessage(error, "Failed to fetch tags");
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
    scope: "tags:create",
    request,
    limit: 60,
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

    const actorProfileId = await requireActorProfileId();
    if (!actorProfileId) {
      return NextResponse.json(
        { error: "Unauthorized", requestId },
        {
          status: 401,
          headers: {
            "x-request-id": requestId,
          },
        },
      );
    }

    const payload = (await request.json()) as {
      name?: string;
      targetType?: string;
      targetId?: string;
    };

    const parsed = validateTargetInput(payload);
    if ("error" in parsed) {
      return NextResponse.json(
        { error: parsed.error, requestId },
        {
          status: 400,
          headers: {
            "x-request-id": requestId,
          },
        },
      );
    }

    const name = payload?.name?.trim() ?? "";
    if (!name) {
      return NextResponse.json(
        { error: "Tag name is required.", requestId },
        {
          status: 400,
          headers: {
            "x-request-id": requestId,
          },
        },
      );
    }

    if (name.length > 64) {
      return NextResponse.json(
        { error: "Tag name must be 64 characters or fewer.", requestId },
        {
          status: 400,
          headers: {
            "x-request-id": requestId,
          },
        },
      );
    }

    if (/\s/.test(name)) {
      return NextResponse.json(
        { error: "Tag must be a single word with no spaces.", requestId },
        {
          status: 400,
          headers: {
            "x-request-id": requestId,
          },
        },
      );
    }

    const ownership = await ensureOwner(parsed.targetType, parsed.targetIdRaw, actorProfileId);
    if ("error" in ownership) {
      return NextResponse.json(
        { error: ownership.error, requestId },
        {
          status: ownership.status,
          headers: {
            "x-request-id": requestId,
          },
        },
      );
    }

    const tag = await upsertDictionaryTag(name, actorProfileId);
    if (!tag?._id) {
      return NextResponse.json(
        { error: "Failed to create tag.", requestId },
        {
          status: 500,
          headers: {
            "x-request-id": requestId,
          },
        },
      );
    }

    await attachTagToTarget(
      parsed.targetType,
      parsed.targetIdRaw,
      new Types.ObjectId(String(tag._id)),
      actorProfileId,
    );

    return NextResponse.json(
      {
        requestId,
        id: String(tag._id),
        name: tag.name,
        normalizedName: tag.normalizedName,
        targetType: parsed.targetType,
        targetId: parsed.targetIdRaw,
        createdBy: tag.createdBy ? String(tag.createdBy) : "",
        lastUpdatedBy: tag.lastUpdatedBy ? String(tag.lastUpdatedBy) : "",
        createdAt: tag.createdAt,
        updatedAt: tag.updatedAt,
      },
      {
        status: 201,
        headers: {
          "x-request-id": requestId,
        },
      },
    );
  } catch (error) {
    if (isDuplicateKeyError(error as { code?: number } | Error | null | undefined)) {
      return NextResponse.json(
        { error: "Tag already exists.", requestId },
        {
          status: 409,
          headers: {
            "x-request-id": requestId,
          },
        },
      );
    }

    logApiError({
      route: "/api/tags",
      method: "POST",
      error,
      requestId,
    });
    const message = getApiErrorMessage(error, "Failed to create tag");
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

export async function PATCH(request: Request) {
  const requestId = getOrCreateRequestId(request);

  const rateLimit = await checkRateLimit({
    scope: "tags:update",
    request,
    limit: 60,
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

    const actorProfileId = await requireActorProfileId();
    if (!actorProfileId) {
      return NextResponse.json(
        { error: "Unauthorized", requestId },
        {
          status: 401,
          headers: {
            "x-request-id": requestId,
          },
        },
      );
    }

    const payload = (await request.json()) as {
      targetType?: string;
      targetId?: string;
      oldName?: string;
      newName?: string;
    };

    const parsed = validateTargetInput(payload);
    if ("error" in parsed) {
      return NextResponse.json(
        { error: parsed.error, requestId },
        {
          status: 400,
          headers: {
            "x-request-id": requestId,
          },
        },
      );
    }

    const oldName = payload?.oldName?.trim() ?? "";
    const newName = payload?.newName?.trim() ?? "";

    if (!oldName || !newName) {
      return NextResponse.json(
        { error: "oldName and newName are required.", requestId },
        {
          status: 400,
          headers: {
            "x-request-id": requestId,
          },
        },
      );
    }

    if (/\s/.test(oldName) || /\s/.test(newName)) {
      return NextResponse.json(
        { error: "Tag must be a single word with no spaces.", requestId },
        {
          status: 400,
          headers: {
            "x-request-id": requestId,
          },
        },
      );
    }

    const ownership = await ensureOwner(parsed.targetType, parsed.targetIdRaw, actorProfileId);
    if ("error" in ownership) {
      return NextResponse.json(
        { error: ownership.error, requestId },
        {
          status: ownership.status,
          headers: {
            "x-request-id": requestId,
          },
        },
      );
    }

    const oldTag = await TagModel.findOne({ normalizedName: normalizeTagName(oldName), isActive: true }).lean();
    if (!oldTag?._id) {
      return NextResponse.json(
        { error: "Old tag not found.", requestId },
        {
          status: 404,
          headers: {
            "x-request-id": requestId,
          },
        },
      );
    }

    const targetTagIds = Array.isArray(ownership.target.tags)
      ? ownership.target.tags.map((id: Types.ObjectId | string) => String(id))
      : [];
    const hasOldTag = targetTagIds.includes(String(oldTag._id));

    if (!hasOldTag) {
      return NextResponse.json(
        { error: "Old tag is not attached to this target.", requestId },
        {
          status: 404,
          headers: {
            "x-request-id": requestId,
          },
        },
      );
    }

    const newTag = await upsertDictionaryTag(newName, actorProfileId);
    if (!newTag?._id) {
      return NextResponse.json(
        { error: "Failed to create replacement tag.", requestId },
        {
          status: 500,
          headers: {
            "x-request-id": requestId,
          },
        },
      );
    }

    const oldTagId = new Types.ObjectId(String(oldTag._id));
    const newTagId = new Types.ObjectId(String(newTag._id));

    if (String(oldTagId) !== String(newTagId)) {
      await detachTagFromTarget(parsed.targetType, parsed.targetIdRaw, oldTagId, actorProfileId);
      await attachTagToTarget(parsed.targetType, parsed.targetIdRaw, newTagId, actorProfileId);
    }

    return NextResponse.json(
      {
        requestId,
        id: String(newTag._id),
        name: newTag.name,
        normalizedName: newTag.normalizedName,
        targetType: parsed.targetType,
        targetId: parsed.targetIdRaw,
      },
      {
        headers: {
          "x-request-id": requestId,
        },
      },
    );
  } catch (error) {
    logApiError({
      route: "/api/tags",
      method: "PATCH",
      error,
      requestId,
    });
    const message = getApiErrorMessage(error, "Failed to update tag");
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

export async function DELETE(request: Request) {
  const requestId = getOrCreateRequestId(request);

  const rateLimit = await checkRateLimit({
    scope: "tags:delete",
    request,
    limit: 60,
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

    const actorProfileId = await requireActorProfileId();
    if (!actorProfileId) {
      return NextResponse.json(
        { error: "Unauthorized", requestId },
        {
          status: 401,
          headers: {
            "x-request-id": requestId,
          },
        },
      );
    }

    const payload = (await request.json()) as {
      targetType?: string;
      targetId?: string;
      name?: string;
    };

    const parsed = validateTargetInput(payload);
    if ("error" in parsed) {
      return NextResponse.json(
        { error: parsed.error, requestId },
        {
          status: 400,
          headers: {
            "x-request-id": requestId,
          },
        },
      );
    }

    const name = payload?.name?.trim() ?? "";
    if (!name) {
      return NextResponse.json(
        { error: "Tag name is required.", requestId },
        {
          status: 400,
          headers: {
            "x-request-id": requestId,
          },
        },
      );
    }

    const ownership = await ensureOwner(parsed.targetType, parsed.targetIdRaw, actorProfileId);
    if ("error" in ownership) {
      return NextResponse.json(
        { error: ownership.error, requestId },
        {
          status: ownership.status,
          headers: {
            "x-request-id": requestId,
          },
        },
      );
    }

    const tag = await TagModel.findOne({ normalizedName: normalizeTagName(name), isActive: true }).lean();
    if (!tag?._id) {
      return NextResponse.json(
        { error: "Tag not found.", requestId },
        {
          status: 404,
          headers: {
            "x-request-id": requestId,
          },
        },
      );
    }

    const tagId = new Types.ObjectId(String(tag._id));
    const targetTagIds = Array.isArray(ownership.target.tags)
      ? ownership.target.tags.map((id: Types.ObjectId | string) => String(id))
      : [];

    if (!targetTagIds.includes(String(tagId))) {
      return NextResponse.json(
        { error: "Tag is not attached to this target.", requestId },
        {
          status: 404,
          headers: {
            "x-request-id": requestId,
          },
        },
      );
    }

    await detachTagFromTarget(parsed.targetType, parsed.targetIdRaw, tagId, actorProfileId);

    return NextResponse.json(
      {
        requestId,
        success: true,
      },
      {
        headers: {
          "x-request-id": requestId,
        },
      },
    );
  } catch (error) {
    logApiError({
      route: "/api/tags",
      method: "DELETE",
      error,
      requestId,
    });
    const message = getApiErrorMessage(error, "Failed to delete tag");
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

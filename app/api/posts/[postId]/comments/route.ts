import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { connectToDatabase } from "@/app/_lib/mongoose";
import { CommentModel } from "@/app/_lib/models/Comment";
import { PostModel } from "@/app/_lib/models/Post";
import { UserProfileModel } from "@/app/_lib/models/UserProfile";
import { getSessionActor } from "@/app/_lib/admin";
import { checkRateLimit } from "@/app/_lib/rate-limit";
import { sanitizeScopedUploadUrls } from "@/app/_lib/upload-url";
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

type ParamsContext = {
  params: Promise<{
    postId: string;
  }>;
};

function isValidObjectId(value: string) {
  return mongoose.Types.ObjectId.isValid(value);
}

export async function GET(_request: Request, { params }: ParamsContext) {
  const requestId = getOrCreateRequestId(_request);
  let postId = "";

  try {
    await connectToDatabase();
    const actor = await getSessionActor();
    const canViewUnapproved = Boolean(actor?.isAdmin);

    ({ postId } = await params);
    if (!isValidObjectId(postId)) {
      return NextResponse.json(
        { error: "Invalid post id.", requestId },
        {
          status: 400,
          headers: {
            "x-request-id": requestId,
          },
        },
      );
    }

    const comments = await CommentModel.find({
      $or: [
        { targetType: "Post", targetId: postId },
        { postId },
      ],
      ...(canViewUnapproved ? {} : { moderationStatus: "approved" }),
    })
      .sort({ createdAt: -1 })
      .limit(1000)
      .lean();

    return NextResponse.json(
      comments.map((comment) => ({
        id: String(comment._id),
        postId: String(comment.targetId),
        text: comment.text,
        imageUrls: sanitizeScopedUploadUrls(comment.imageUrls, "comment"),
        createdBy: comment.createdBy ? String(comment.createdBy) : "",
        lastUpdatedBy: comment.lastUpdatedBy ? String(comment.lastUpdatedBy) : "",
        moderationStatus: comment.moderationStatus ?? "approved",
        parentCommentId: comment.parentCommentId
          ? String(comment.parentCommentId)
          : null,
        createdAt: comment.createdAt,
        updatedAt: comment.updatedAt,
      })),
      {
        headers: {
          "x-request-id": requestId,
        },
      },
    );
  } catch (error) {
    logApiError({
      route: "/api/posts/[postId]/comments",
      method: "GET",
      error,
      requestId,
      context: { postId },
    });
    const message = getApiErrorMessage(error, "Failed to fetch comments");
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

export async function POST(request: Request, { params }: ParamsContext) {
  const requestId = getOrCreateRequestId(request);
  let postId = "";

  const rateLimit = await checkRateLimit({
    scope: "comments:create",
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
    const actor = await getSessionActor();
    const actorEmail = actor?.email ?? "";
    const actorProfileId = await getCanonicalActorProfileId(actorEmail);

    ({ postId } = await params);
    if (!isValidObjectId(postId)) {
      return NextResponse.json(
        { error: "Invalid post id.", requestId },
        {
          status: 400,
          headers: {
            "x-request-id": requestId,
          },
        },
      );
    }

    const postExists = await PostModel.exists({ _id: postId });
    if (!postExists) {
      return NextResponse.json(
        { error: "Post not found.", requestId },
        {
          status: 404,
          headers: {
            "x-request-id": requestId,
          },
        },
      );
    }

    const payload = (await request.json()) as {
      text?: string;
      parentCommentId?: string | null;
      imageUrls?: string[];
    };

    const text = payload?.text?.trim() ?? "";
    const imageUrls = sanitizeScopedUploadUrls(payload?.imageUrls, "comment");
    if (!text && imageUrls.length === 0) {
      return NextResponse.json(
        { error: "Comment text or at least one image is required.", requestId },
        {
          status: 400,
          headers: {
            "x-request-id": requestId,
          },
        },
      );
    }

    const parentCommentId = payload?.parentCommentId ?? null;
    if (parentCommentId && !isValidObjectId(parentCommentId)) {
      return NextResponse.json(
        { error: "Invalid parent comment id.", requestId },
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

    const created = await CommentModel.create({
      targetType: "Post",
      targetId: postId,
      text,
      imageUrls,
      parentCommentId,
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
        postId: String(created.targetId),
        text: created.text,
        imageUrls: sanitizeScopedUploadUrls(created.imageUrls ?? imageUrls, "comment"),
        createdBy: created.createdBy ? String(created.createdBy) : "",
        lastUpdatedBy: created.lastUpdatedBy ? String(created.lastUpdatedBy) : "",
        moderationStatus: created.moderationStatus ?? moderationStatus,
        approvedAt: created.approvedAt ?? approvedAt,
        parentCommentId: created.parentCommentId
          ? String(created.parentCommentId)
          : null,
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
      route: "/api/posts/[postId]/comments",
      method: "POST",
      error,
      requestId,
      context: { postId },
    });
    const message = getApiErrorMessage(error, "Failed to create comment");
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

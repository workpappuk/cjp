import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { connectToDatabase } from "@/app/_lib/mongoose";
import { CommentModel } from "@/app/_lib/models/Comment";
import { PostModel } from "@/app/_lib/models/Post";
import { checkRateLimit } from "@/app/_lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ParamsContext = {
  params: {
    postId: string;
  };
};

function isValidObjectId(value: string) {
  return mongoose.Types.ObjectId.isValid(value);
}

export async function GET(_request: Request, { params }: ParamsContext) {
  try {
    await connectToDatabase();

    const postId = params.postId;
    if (!isValidObjectId(postId)) {
      return NextResponse.json({ error: "Invalid post id." }, { status: 400 });
    }

    const comments = await CommentModel.find({ postId })
      .sort({ createdAt: -1 })
      .limit(1000)
      .lean();

    return NextResponse.json(
      comments.map((comment) => ({
        id: String(comment._id),
        postId: String(comment.postId),
        text: comment.text,
        parentCommentId: comment.parentCommentId
          ? String(comment.parentCommentId)
          : null,
        createdAt: comment.createdAt,
        updatedAt: comment.updatedAt,
      })),
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch comments";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: ParamsContext) {
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
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(rateLimit.retryAfterSeconds),
        },
      },
    );
  }

  try {
    await connectToDatabase();

    const postId = params.postId;
    if (!isValidObjectId(postId)) {
      return NextResponse.json({ error: "Invalid post id." }, { status: 400 });
    }

    const postExists = await PostModel.exists({ _id: postId });
    if (!postExists) {
      return NextResponse.json({ error: "Post not found." }, { status: 404 });
    }

    const payload = (await request.json()) as {
      text?: string;
      parentCommentId?: string | null;
    };

    const text = payload?.text?.trim() ?? "";
    if (!text) {
      return NextResponse.json(
        { error: "Comment text is required." },
        { status: 400 },
      );
    }

    const parentCommentId = payload?.parentCommentId ?? null;
    if (parentCommentId && !isValidObjectId(parentCommentId)) {
      return NextResponse.json(
        { error: "Invalid parent comment id." },
        { status: 400 },
      );
    }

    const created = await CommentModel.create({
      postId,
      text,
      parentCommentId,
    });

    return NextResponse.json(
      {
        id: String(created._id),
        postId: String(created.postId),
        text: created.text,
        parentCommentId: created.parentCommentId
          ? String(created.parentCommentId)
          : null,
        createdAt: created.createdAt,
        updatedAt: created.updatedAt,
      },
      { status: 201 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create comment";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

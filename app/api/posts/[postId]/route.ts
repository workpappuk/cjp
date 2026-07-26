import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectToDatabase } from "@/app/_lib/mongoose";
import { PostModel } from "@/app/_lib/models/Post";
import {
  getApiErrorMessage,
  getOrCreateRequestId,
  logApiError,
} from "@/app/_lib/api-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ParamsContext = {
  params: {
    postId: string;
  };
};

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

export async function GET(_request: Request, { params }: ParamsContext) {
  const requestId = getOrCreateRequestId(_request);

  try {
    await connectToDatabase();

    if (!mongoose.Types.ObjectId.isValid(params.postId)) {
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

    const post = await PostModel.findById(params.postId)
      .populate("communities", "name")
      .lean();
    if (!post) {
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

    return NextResponse.json({
      requestId,
      id: String(post._id),
      title: post.title,
      content: post.content,
      communities: toCommunityNames(post.communities as JoinedCommunityValue[]),
      createdBy: post.createdBy ? String(post.createdBy) : "",
      lastUpdatedBy: post.lastUpdatedBy ? String(post.lastUpdatedBy) : "",
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
    }, {
      headers: {
        "x-request-id": requestId,
      },
    });
  } catch (error) {
    logApiError({
      route: "/api/posts/[postId]",
      method: "GET",
      error,
      requestId,
      context: { postId: params.postId },
    });
    const message = getApiErrorMessage(error, "Failed to fetch post");
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

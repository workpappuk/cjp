import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectToDatabase } from "@/app/_lib/mongoose";
import { PostModel } from "@/app/_lib/models/Post";
import { CommunityModel } from "@/app/_lib/models/Community";
import { TagModel } from "@/app/_lib/models/Tag";
import { getSessionActor } from "@/app/_lib/admin";
import {
  getApiErrorMessage,
  getOrCreateRequestId,
  logApiError,
} from "@/app/_lib/api-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ParamsContext = {
  params: Promise<{
    postId: string;
  }>;
};

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

export async function GET(_request: Request, { params }: ParamsContext) {
  const requestId = getOrCreateRequestId(_request);
  let postId = "";

  try {
    await connectToDatabase();
    const actor = await getSessionActor();
    const canViewUnapproved = Boolean(actor?.isAdmin);
    ({ postId } = await params);

    if (!mongoose.Types.ObjectId.isValid(postId)) {
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

    const post = await PostModel.findOne({
      _id: postId,
      ...(canViewUnapproved ? {} : { moderationStatus: "approved" }),
    }).lean();
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

    const communityIds = extractObjectIdStrings(
      Array.isArray(post.communities)
        ? (post.communities as Array<string | Types.ObjectId>)
        : [],
    );
    const tagIds = extractObjectIdStrings(
      Array.isArray(post.tags) ? (post.tags as Array<string | Types.ObjectId>) : [],
    );

    const [communities, tags] = await Promise.all([
      communityIds.length > 0
        ? CommunityModel.find({ _id: { $in: communityIds } }, { _id: 1, name: 1 }).lean()
        : Promise.resolve([]),
      tagIds.length > 0
        ? TagModel.find({ _id: { $in: tagIds } }, { _id: 1, name: 1 }).lean()
        : Promise.resolve([]),
    ]);

    const communityNameById = new Map<string, string>(
      communities.map((community) => [String(community._id), community.name]),
    );
    const tagNameById = new Map<string, string>(
      tags.map((tag) => [String(tag._id), tag.name]),
    );

    return NextResponse.json({
      requestId,
      id: String(post._id),
      title: post.title,
      content: post.content,
      communities: resolveRefNames(post.communities as JoinedCommunityValue[] | undefined, communityNameById),
      tags: resolveRefNames(post.tags as JoinedTagValue[] | undefined, tagNameById),
      createdBy: post.createdBy ? String(post.createdBy) : "",
      lastUpdatedBy: post.lastUpdatedBy ? String(post.lastUpdatedBy) : "",
      moderationStatus: post.moderationStatus ?? "approved",
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
      context: { postId },
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

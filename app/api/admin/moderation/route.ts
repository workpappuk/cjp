import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectToDatabase } from "@/app/_lib/mongoose";
import { getSessionActor } from "@/app/_lib/admin";
import { PostModel } from "@/app/_lib/models/Post";
import { CommunityModel } from "@/app/_lib/models/Community";
import { CommentModel } from "@/app/_lib/models/Comment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ModerationTargetType = "Post" | "Community" | "Comment";
type ModerationAction = "approve" | "reject";
type ModerationStatus = "pending" | "approved" | "rejected";
type RecordStatus = "active" | "deleted" | "archived" | "flagged";

type ListItem = {
  _id: Types.ObjectId;
  createdAt?: Date;
  moderationStatus?: ModerationStatus;
  recordStatus?: RecordStatus;
  [key: string]: unknown;
};

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

function isTargetType(value: string): value is ModerationTargetType {
  return value === "Post" || value === "Community" || value === "Comment";
}

function isAction(value: string): value is ModerationAction {
  return value === "approve" || value === "reject";
}

function isRecordStatus(value: string): value is RecordStatus {
  return value === "active" || value === "deleted" || value === "archived" || value === "flagged";
}

function isModerationStatus(value: string): value is ModerationStatus {
  return value === "pending" || value === "approved" || value === "rejected";
}

function normalizePageSize(raw: string | null) {
  const parsed = Number.parseInt(raw ?? "", 10);
  if (Number.isNaN(parsed)) {
    return DEFAULT_PAGE_SIZE;
  }

  return Math.min(Math.max(parsed, 1), MAX_PAGE_SIZE);
}

function parseCursor(rawCursor: string) {
  const [isoDate, id] = rawCursor.split("::");
  if (!isoDate || !id || !Types.ObjectId.isValid(id)) {
    return null;
  }

  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return {
    createdAt: date,
    id: new Types.ObjectId(id),
  };
}

function makeNextCursor(item: ListItem | null | undefined) {
  if (!item?._id || !item.createdAt) {
    return null;
  }

  const createdAt = new Date(item.createdAt);
  if (Number.isNaN(createdAt.getTime())) {
    return null;
  }

  return `${createdAt.toISOString()}::${String(item._id)}`;
}

function buildListFilter({
  moderationStatus,
  recordStatus,
}: {
  moderationStatus: string;
  recordStatus: string;
}) {
  const filter: {
    moderationStatus?: ModerationStatus;
    recordStatus?: RecordStatus;
  } = {};

  if (moderationStatus !== "all") {
    if (!isModerationStatus(moderationStatus)) {
      return { error: "Invalid moderationStatus filter." as const };
    }
    filter.moderationStatus = moderationStatus;
  }

  if (recordStatus !== "all") {
    if (!isRecordStatus(recordStatus)) {
      return { error: "Invalid recordStatus filter." as const };
    }
    filter.recordStatus = recordStatus;
  }

  return { filter };
}

function toObjectIdStrings(values: Array<string | Types.ObjectId | null | undefined>) {
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

function getVersionFilter(version: number | undefined) {
  if (typeof version === "number") {
    return { __v: version };
  }

  return { __v: { $exists: false } };
}

async function getSummaryCounts() {
  const [pendingPosts, pendingCommunities, pendingComments] = await Promise.all([
    PostModel.countDocuments({ moderationStatus: "pending" }),
    CommunityModel.countDocuments({ moderationStatus: "pending" }),
    CommentModel.countDocuments({ moderationStatus: "pending" }),
  ]);

  return {
    pending: {
      posts: pendingPosts,
      communities: pendingCommunities,
      comments: pendingComments,
      total: pendingPosts + pendingCommunities + pendingComments,
    },
  };
}

async function listTargetItems({
  targetType,
  filter,
  pageSize,
  cursor,
}: {
  targetType: ModerationTargetType;
  filter: { moderationStatus?: ModerationStatus; recordStatus?: RecordStatus };
  pageSize: number;
  cursor: { createdAt: Date; id: Types.ObjectId } | null;
}) {
  const model =
    targetType === "Post"
      ? PostModel
      : targetType === "Community"
        ? CommunityModel
        : CommentModel;

  const where = cursor
    ? {
        ...filter,
        $or: [
          { createdAt: { $lt: cursor.createdAt } },
          { createdAt: cursor.createdAt, _id: { $lt: cursor.id } },
        ],
      }
    : filter;

  const docs = (await model
    .find(where)
    .sort({ createdAt: -1, _id: -1 })
    .limit(pageSize + 1)
    .lean()) as ListItem[];

  const hasMore = docs.length > pageSize;
  const windowed = hasMore ? docs.slice(0, pageSize) : docs;
  const nextCursor = hasMore ? makeNextCursor(windowed[windowed.length - 1]) : null;

  if (targetType === "Post") {
    const communityIds = toObjectIdStrings(
      windowed.flatMap((item) => {
        const communities = item.communities;
        return Array.isArray(communities)
          ? (communities as Array<string | Types.ObjectId>)
          : [];
      }),
    );

    const communityRefs = communityIds.length
      ? await CommunityModel.find({ _id: { $in: communityIds } }, { _id: 1, name: 1 }).lean()
      : [];

    const communityNameById = new Map<string, string>(
      communityRefs.map((communityDoc) => [String(communityDoc._id), communityDoc.name]),
    );

    return {
      items: windowed.map((post) => ({
        id: String(post._id),
        title: String(post.title ?? ""),
        content: String(post.content ?? ""),
        communities: Array.isArray(post.communities)
          ? (post.communities as Array<string | Types.ObjectId>)
              .map((community) => {
                const id = String(community);
                return Types.ObjectId.isValid(id)
                  ? (communityNameById.get(id) ?? "")
                  : id;
              })
              .filter(Boolean)
          : [],
        moderationStatus: (post.moderationStatus ?? "approved") as ModerationStatus,
        recordStatus: (post.recordStatus ?? "active") as RecordStatus,
        createdAt: post.createdAt,
      })),
      nextCursor,
      hasMore,
    };
  }

  if (targetType === "Community") {
    return {
      items: windowed.map((community) => ({
        id: String(community._id),
        name: String(community.name ?? ""),
        moderationStatus: (community.moderationStatus ?? "approved") as ModerationStatus,
        recordStatus: (community.recordStatus ?? "active") as RecordStatus,
        createdAt: community.createdAt,
      })),
      nextCursor,
      hasMore,
    };
  }

  return {
    items: windowed.map((comment) => ({
      id: String(comment._id),
      targetType: String(comment.targetType ?? ""),
      targetId: String(comment.targetId ?? ""),
      text: String(comment.text ?? ""),
      parentCommentId: comment.parentCommentId ? String(comment.parentCommentId) : null,
      moderationStatus: (comment.moderationStatus ?? "approved") as ModerationStatus,
      recordStatus: (comment.recordStatus ?? "active") as RecordStatus,
      createdAt: comment.createdAt,
    })),
    nextCursor,
    hasMore,
  };
}

export async function GET(request: Request) {
  await connectToDatabase();

  const actor = await getSessionActor();
  if (!actor?.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const targetTypeRaw = searchParams.get("targetType")?.trim() ?? "";

  if (!targetTypeRaw) {
    const summary = await getSummaryCounts();
    return NextResponse.json({ summary });
  }

  if (!isTargetType(targetTypeRaw)) {
    return NextResponse.json({ error: "Invalid targetType." }, { status: 400 });
  }

  const moderationStatus = (searchParams.get("moderationStatus") ?? "pending").trim().toLowerCase();
  const recordStatus = (searchParams.get("recordStatus") ?? "all").trim().toLowerCase();
  const pageSize = normalizePageSize(searchParams.get("limit"));
  const rawCursor = searchParams.get("cursor")?.trim() ?? "";

  const parsedFilters = buildListFilter({ moderationStatus, recordStatus });
  if ("error" in parsedFilters) {
    return NextResponse.json({ error: parsedFilters.error }, { status: 400 });
  }

  const cursor = rawCursor ? parseCursor(rawCursor) : null;
  if (rawCursor && !cursor) {
    return NextResponse.json({ error: "Invalid cursor." }, { status: 400 });
  }

  const result = await listTargetItems({
    targetType: targetTypeRaw,
    filter: parsedFilters.filter,
    pageSize,
    cursor,
  });

  return NextResponse.json({
    targetType: targetTypeRaw,
    pageSize,
    moderationStatus,
    recordStatus,
    nextCursor: result.nextCursor,
    hasMore: result.hasMore,
    items: result.items,
  });
}

export async function PATCH(request: Request) {
  await connectToDatabase();

  const actor = await getSessionActor();
  if (!actor?.isAdmin || !actor.profileId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const payload = (await request.json()) as {
    targetType?: string;
    targetId?: string;
    action?: string;
    recordStatus?: string;
  };

  const targetType = payload.targetType?.trim() ?? "";
  const targetId = payload.targetId?.trim() ?? "";
  const action = payload.action?.trim() ?? "";
  const recordStatus = payload.recordStatus?.trim() ?? "";

  if (!isTargetType(targetType)) {
    return NextResponse.json({ error: "Invalid target type." }, { status: 400 });
  }

  if (!Types.ObjectId.isValid(targetId)) {
    return NextResponse.json({ error: "Invalid target id." }, { status: 400 });
  }

  if (!action && !recordStatus) {
    return NextResponse.json({ error: "Either action or recordStatus is required." }, { status: 400 });
  }

  if (action && !isAction(action)) {
    return NextResponse.json({ error: "Invalid moderation action." }, { status: 400 });
  }

  if (recordStatus && !isRecordStatus(recordStatus)) {
    return NextResponse.json({ error: "Invalid record status." }, { status: 400 });
  }

  const now = new Date();
  const nextRecordStatus = isRecordStatus(recordStatus) ? recordStatus : undefined;

  const updateSet: {
    moderationStatus?: ModerationStatus;
    approvedBy?: Types.ObjectId;
    approvedAt?: Date | null;
    recordStatus?: RecordStatus;
    lastUpdatedBy: Types.ObjectId;
  } = {
    lastUpdatedBy: actor.profileId,
  };

  if (action) {
    const isApprove = action === "approve";
    updateSet.moderationStatus = isApprove ? "approved" : "rejected";
    updateSet.approvedBy = actor.profileId;
    updateSet.approvedAt = isApprove ? now : null;
  }

  if (nextRecordStatus) {
    updateSet.recordStatus = nextRecordStatus;
  }

  const model =
    targetType === "Post"
      ? PostModel
      : targetType === "Community"
        ? CommunityModel
        : CommentModel;

  const existing = await model.findById(targetId, { _id: 1, __v: 1 }).lean();

  if (!existing) {
    return NextResponse.json({ error: "Target not found." }, { status: 404 });
  }

  const updateResult = await model.updateOne(
    {
      _id: targetId,
      ...getVersionFilter(typeof existing.__v === "number" ? existing.__v : undefined),
    },
    {
      $set: {
        ...updateSet,
      },
      $inc: {
        __v: 1,
      },
    },
  );

  if (updateResult.matchedCount === 0) {
    return NextResponse.json(
      { error: "Conflict: target was modified by another request." },
      { status: 409 },
    );
  }

  const updated = await model.findById(targetId, {
    _id: 1,
    moderationStatus: 1,
    recordStatus: 1,
    approvedAt: 1,
    __v: 1,
  }).lean();

  if (!updated) {
    return NextResponse.json({ error: "Target not found." }, { status: 404 });
  }

  return NextResponse.json({
    id: String(updated._id),
    targetType,
    moderationStatus: updated.moderationStatus,
    recordStatus: updated.recordStatus,
    approvedAt: updated.approvedAt,
    version: updated.__v ?? null,
  });
}

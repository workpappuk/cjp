import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectToDatabase } from "@/app/_lib/mongoose";
import { getSessionActor } from "@/app/_lib/admin";
import { PostModel } from "@/app/_lib/models/Post";
import { UserProfileModel } from "@/app/_lib/models/UserProfile";

type AuditModelName = "Post" | "Community" | "Comment" | "Tag" | "UserProfile";
type AuditOperation = "create" | "update";

type AuditDelta = {
  path: string;
  from: unknown;
  to: unknown;
};

type AuditRecord = {
  _id: Types.ObjectId;
  documentId: string;
  documentEmail?: string | null;
  modelName: AuditModelName;
  collectionName: string;
  operation: AuditOperation;
  actorId?: string | null;
  actorEmail?: string | null;
  requestId?: string | null;
  source?: string | null;
  changedAt?: Date;
  delta?: AuditDelta[];
};

type ProfileRef = {
  _id: Types.ObjectId;
  name?: string;
  email?: string;
};

type Cursor = {
  changedAt: Date;
  id: Types.ObjectId;
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

const MODEL_TO_COLLECTION: Record<AuditModelName, string> = {
  Post: "posts",
  Community: "communities",
  Comment: "comments",
  Tag: "tags",
  UserProfile: "userprofiles",
};

function getAuditDbName() {
  const explicit = (process.env.MONGODB_AUDIT_DB ?? "").trim();
  if (explicit) {
    return explicit;
  }

  const primaryDb = (process.env.MONGODB_DB ?? "threadforge").trim();
  return `${primaryDb}_audit`;
}

function isAuditModelName(value: string): value is AuditModelName {
  return value === "Post" || value === "Community" || value === "Comment" || value === "Tag" || value === "UserProfile";
}

function isAuditOperation(value: string): value is AuditOperation {
  return value === "create" || value === "update";
}

function normalizePageSize(raw: string | null) {
  const parsed = Number.parseInt(raw ?? "", 10);
  if (Number.isNaN(parsed)) {
    return DEFAULT_PAGE_SIZE;
  }

  return Math.min(Math.max(parsed, 1), MAX_PAGE_SIZE);
}

function parseCursor(rawCursor: string): Cursor | null {
  const [isoDate, id] = rawCursor.split("::");
  if (!isoDate || !id || !Types.ObjectId.isValid(id)) {
    return null;
  }

  const changedAt = new Date(isoDate);
  if (Number.isNaN(changedAt.getTime())) {
    return null;
  }

  return {
    changedAt,
    id: new Types.ObjectId(id),
  };
}

function makeNextCursor(item: AuditRecord | null | undefined) {
  if (!item?._id || !item.changedAt) {
    return null;
  }

  const changedAt = new Date(item.changedAt);
  if (Number.isNaN(changedAt.getTime())) {
    return null;
  }

  return `${changedAt.toISOString()}::${String(item._id)}`;
}

async function listFromModelCollection(params: {
  modelName: AuditModelName;
  documentId?: string;
  operation?: AuditOperation;
  cursor: Cursor | null;
  pageSize: number;
}) {
  const dbName = getAuditDbName();
  const collectionName = `${MODEL_TO_COLLECTION[params.modelName]}_audit`;
  const collection = PostModel.db.useDb(dbName, { useCache: true }).collection(collectionName);

  const filter: {
    documentId?: string;
    operation?: AuditOperation;
    $or?: Array<{ changedAt: { $lt: Date } } | { changedAt: Date; _id: { $lt: Types.ObjectId } }>;
  } = {};

  if (params.documentId) {
    filter.documentId = params.documentId;
  }

  if (params.operation) {
    filter.operation = params.operation;
  }

  if (params.cursor) {
    filter.$or = [
      { changedAt: { $lt: params.cursor.changedAt } },
      { changedAt: params.cursor.changedAt, _id: { $lt: params.cursor.id } },
    ];
  }

  const docs = (await collection
    .find(filter)
    .sort({ changedAt: -1, _id: -1 })
    .limit(params.pageSize + 1)
    .toArray()) as AuditRecord[];

  const hasMore = docs.length > params.pageSize;
  const windowed = hasMore ? docs.slice(0, params.pageSize) : docs;
  const nextCursor = hasMore ? makeNextCursor(windowed[windowed.length - 1]) : null;

  return {
    collectionName,
    items: windowed,
    hasMore,
    nextCursor,
  };
}

export async function GET(request: Request) {
  await connectToDatabase();

  const actor = await getSessionActor();
  if (!actor?.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const modelNameRaw = searchParams.get("modelName")?.trim() ?? "";
  const documentIdRaw = searchParams.get("documentId")?.trim() ?? "";
  const operationRaw = (searchParams.get("operation") ?? "all").trim().toLowerCase();
  const pageSize = normalizePageSize(searchParams.get("limit"));
  const rawCursor = searchParams.get("cursor")?.trim() ?? "";

  if (!modelNameRaw) {
    return NextResponse.json(
      {
        error: "modelName is required.",
        allowedModelNames: Object.keys(MODEL_TO_COLLECTION),
      },
      { status: 400 },
    );
  }

  if (!isAuditModelName(modelNameRaw)) {
    return NextResponse.json(
      {
        error: "Invalid modelName.",
        allowedModelNames: Object.keys(MODEL_TO_COLLECTION),
      },
      { status: 400 },
    );
  }

  if (documentIdRaw && !Types.ObjectId.isValid(documentIdRaw)) {
    return NextResponse.json({ error: "Invalid documentId." }, { status: 400 });
  }

  let operation: AuditOperation | undefined;
  if (operationRaw !== "all") {
    if (!isAuditOperation(operationRaw)) {
      return NextResponse.json({ error: "Invalid operation filter." }, { status: 400 });
    }

    operation = operationRaw;
  }

  if (operation && !isAuditOperation(operation)) {
    return NextResponse.json({ error: "Invalid operation filter." }, { status: 400 });
  }

  const cursor = rawCursor ? parseCursor(rawCursor) : null;
  if (rawCursor && !cursor) {
    return NextResponse.json({ error: "Invalid cursor." }, { status: 400 });
  }

  const result = await listFromModelCollection({
    modelName: modelNameRaw,
    documentId: documentIdRaw || undefined,
    operation,
    cursor,
    pageSize,
  });

  const profileIds = new Set<string>();

  for (const item of result.items) {
    if (item.actorId && Types.ObjectId.isValid(item.actorId)) {
      profileIds.add(item.actorId);
    }

    if (item.modelName === "UserProfile" && Types.ObjectId.isValid(item.documentId)) {
      profileIds.add(item.documentId);
    }
  }

  const profileRefs = profileIds.size
    ? ((await UserProfileModel.find(
        { _id: { $in: [...profileIds] } },
        { _id: 1, name: 1, email: 1 },
      ).lean()) as ProfileRef[])
    : [];

  const profileDisplayById = new Map<string, string>(
    profileRefs.map((profile) => {
      const primary = (profile.name ?? "").trim() || (profile.email ?? "").trim();
      const display = primary || String(profile._id);
      return [String(profile._id), display];
    }),
  );

  return NextResponse.json({
    modelName: modelNameRaw,
    auditDb: getAuditDbName(),
    collectionName: result.collectionName,
    pageSize,
    operation: operation ?? "all",
    documentId: documentIdRaw || null,
    hasMore: result.hasMore,
    nextCursor: result.nextCursor,
    items: result.items.map((item) => ({
      id: String(item._id),
      documentId: item.documentId,
      documentDisplayName:
        item.modelName === "UserProfile"
          ? (profileDisplayById.get(item.documentId) ?? item.documentEmail ?? null)
          : null,
      documentEmail: item.documentEmail ?? null,
      modelName: item.modelName,
      collectionName: item.collectionName,
      operation: item.operation,
      actorId: item.actorId ?? null,
      actorName: item.actorId ? (profileDisplayById.get(item.actorId) ?? item.actorEmail ?? null) : null,
      actorEmail: item.actorEmail ?? null,
      requestId: item.requestId ?? null,
      source: item.source ?? null,
      changedAt: item.changedAt ?? null,
      delta: Array.isArray(item.delta)
        ? item.delta.map((change) => ({
            path: change.path,
            from: change.from,
            to: change.to,
          }))
        : [],
    })),
  });
}

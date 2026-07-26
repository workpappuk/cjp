import "server-only";
import { Types, type Query, type Schema } from "mongoose";

type AnyRecord = Record<string, unknown>;

type AuditContext = {
  actorId?: string | Types.ObjectId | null;
  actorEmail?: string | null;
  requestId?: string | null;
  source?: string | null;
};

type AuditDelta = {
  path: string;
  from: unknown;
  to: unknown;
};

type AuditPluginOptions = {
  ignorePaths?: string[];
  source?: string;
};

type AuditModelRef = {
  db: {
    useDb: (dbName: string, options?: { useCache?: boolean }) => {
      collection: (name: string) => {
        insertOne: (document: AnyRecord) => Promise<unknown>;
        findOne: (
          filter: AnyRecord,
          options?: { projection?: AnyRecord },
        ) => Promise<AnyRecord | null>;
      };
    };
  };
  modelName: string;
  collection: {
    name: string;
  };
};

type QueryAuditState = {
  before: AnyRecord | null;
  filter: AnyRecord;
};

const QUERY_AUDIT_STATE_KEY = Symbol("queryAuditState");
const QUERY_AUDIT_CONTEXT_KEY = Symbol("queryAuditContext");
const DOC_AUDIT_CONTEXT_KEY = Symbol("docAuditContext");

const DEFAULT_IGNORED_PATHS = new Set<string>(["_id", "createdAt", "updatedAt"]);

function isPlainObject(value: unknown): value is AnyRecord {
  if (!value || typeof value !== "object") {
    return false;
  }

  if (Array.isArray(value)) {
    return false;
  }

  if (value instanceof Date || value instanceof Types.ObjectId) {
    return false;
  }

  return Object.getPrototypeOf(value) === Object.prototype;
}

function toComparable(value: unknown): unknown {
  if (value instanceof Types.ObjectId) {
    return `oid:${String(value)}`;
  }

  if (value instanceof Date) {
    return `date:${value.getTime()}`;
  }

  if (Array.isArray(value)) {
    return value.map((item) => toComparable(item));
  }

  if (isPlainObject(value)) {
    const keys = Object.keys(value).sort();
    const normalized: AnyRecord = {};
    for (const key of keys) {
      normalized[key] = toComparable(value[key]);
    }
    return normalized;
  }

  return value;
}

function deepEqual(left: unknown, right: unknown): boolean {
  if (left === right) {
    return true;
  }

  if (left instanceof Types.ObjectId || right instanceof Types.ObjectId) {
    if (!(left instanceof Types.ObjectId) || !(right instanceof Types.ObjectId)) {
      return false;
    }
    return String(left) === String(right);
  }

  if (left instanceof Date || right instanceof Date) {
    if (!(left instanceof Date) || !(right instanceof Date)) {
      return false;
    }
    return left.getTime() === right.getTime();
  }

  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right)) {
      return false;
    }
    if (left.length !== right.length) {
      return false;
    }

    return left.every((item, index) => deepEqual(item, right[index]));
  }

  if (isPlainObject(left) || isPlainObject(right)) {
    if (!isPlainObject(left) || !isPlainObject(right)) {
      return false;
    }

    const leftKeys = Object.keys(left).sort();
    const rightKeys = Object.keys(right).sort();

    if (leftKeys.length !== rightKeys.length) {
      return false;
    }

    for (let index = 0; index < leftKeys.length; index += 1) {
      if (leftKeys[index] !== rightKeys[index]) {
        return false;
      }
    }

    return leftKeys.every((key) => deepEqual(left[key], right[key]));
  }

  return Object.is(toComparable(left), toComparable(right));
}

function normalizeForStorage(value: unknown): unknown {
  if (value === undefined) {
    return null;
  }

  if (value === null) {
    return null;
  }

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (typeof value === "bigint") {
    return value.toString();
  }

  if (value instanceof Date || value instanceof Types.ObjectId) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeForStorage(item));
  }

  if (isPlainObject(value)) {
    const normalized: AnyRecord = {};
    for (const [key, item] of Object.entries(value)) {
      normalized[key] = normalizeForStorage(item);
    }
    return normalized;
  }

  return String(value);
}

function toObjectIdString(value: unknown): string | null {
  if (!value) {
    return null;
  }

  if (value instanceof Types.ObjectId) {
    return String(value);
  }

  if (typeof value === "string" && Types.ObjectId.isValid(value)) {
    return value;
  }

  return null;
}

function getAuditDatabaseName() {
  const explicit = (process.env.MONGODB_AUDIT_DB ?? "").trim();
  if (explicit) {
    return explicit;
  }

  const primaryDb = (process.env.MONGODB_DB ?? "threadforge").trim();
  return `${primaryDb}_audit`;
}

function getPrimaryDatabaseName() {
  return (process.env.MONGODB_DB ?? "threadforge").trim();
}

function normalizeEmail(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  return normalized || null;
}

async function resolveActorEmail(params: {
  model: AuditModelRef;
  actorId: string | null;
  context: AuditContext | null;
}) {
  const fromContext = normalizeEmail(params.context?.actorEmail);
  if (fromContext) {
    return fromContext;
  }

  if (!params.actorId || !Types.ObjectId.isValid(params.actorId)) {
    return null;
  }

  try {
    const primaryDb = getPrimaryDatabaseName();
    const profile = await params.model.db
      .useDb(primaryDb, { useCache: true })
      .collection("userprofiles")
      .findOne(
        { _id: new Types.ObjectId(params.actorId) },
        { projection: { email: 1 } },
      );

    return normalizeEmail(profile?.email);
  } catch {
    return null;
  }
}

function collectCreateDelta(
  after: unknown,
  basePath: string,
  delta: AuditDelta[],
  ignoredPaths: Set<string>,
) {
  if (isPlainObject(after)) {
    for (const [key, value] of Object.entries(after)) {
      const path = basePath ? `${basePath}.${key}` : key;
      collectCreateDelta(value, path, delta, ignoredPaths);
    }
    return;
  }

  if (ignoredPaths.has(basePath)) {
    return;
  }

  delta.push({
    path: basePath,
    from: null,
    to: normalizeForStorage(after),
  });
}

function collectUpdateDelta(
  before: unknown,
  after: unknown,
  basePath: string,
  delta: AuditDelta[],
  ignoredPaths: Set<string>,
) {
  if (deepEqual(before, after)) {
    return;
  }

  if (isPlainObject(before) && isPlainObject(after)) {
    const allKeys = new Set<string>([
      ...Object.keys(before),
      ...Object.keys(after),
    ]);

    for (const key of allKeys) {
      const path = basePath ? `${basePath}.${key}` : key;
      collectUpdateDelta(before[key], after[key], path, delta, ignoredPaths);
    }
    return;
  }

  if (ignoredPaths.has(basePath)) {
    return;
  }

  delta.push({
    path: basePath,
    from: normalizeForStorage(before),
    to: normalizeForStorage(after),
  });
}

async function writeAuditEntry(params: {
  model: AuditModelRef;
  modelName: string;
  collectionName: string;
  documentId: string;
  documentEmail: string | null;
  operation: "create" | "update";
  delta: AuditDelta[];
  actorId: string | null;
  context: AuditContext | null;
  source: string | null;
}) {
  const auditDbName = getAuditDatabaseName();
  const auditCollectionName = `${params.collectionName}_audit`;
  const auditCollection = params.model.db
    .useDb(auditDbName, { useCache: true })
    .collection(auditCollectionName);

  const resolvedActorId = params.context?.actorId
    ? toObjectIdString(params.context.actorId)
    : params.actorId;
  const actorEmail = await resolveActorEmail({
    model: params.model,
    actorId: resolvedActorId,
    context: params.context,
  });

  await auditCollection.insertOne({
    documentId: params.documentId,
    documentEmail: normalizeEmail(params.documentEmail),
    modelName: params.modelName,
    collectionName: params.collectionName,
    operation: params.operation,
    actorId: resolvedActorId,
    actorEmail,
    requestId: params.context?.requestId ?? null,
    source: params.context?.source ?? params.source,
    changedAt: new Date(),
    delta: params.delta,
  });
}

function readActorIdFromDocument(document: AnyRecord | null | undefined) {
  return toObjectIdString(document?.lastUpdatedBy) ?? toObjectIdString(document?.createdBy);
}

function readDocumentId(document: AnyRecord | null | undefined) {
  const id = document?._id;
  if (!id) {
    return null;
  }
  if (id instanceof Types.ObjectId) {
    return String(id);
  }
  if (typeof id === "string") {
    return id;
  }
  return null;
}

function readDocumentEmail(document: AnyRecord | null | undefined) {
  return normalizeEmail(document?.email);
}

function getContextFromQuery(query: Query<unknown, unknown>) {
  const context = (query as Query<unknown, unknown> & {
    [QUERY_AUDIT_CONTEXT_KEY]?: AuditContext;
  })[QUERY_AUDIT_CONTEXT_KEY];
  return context ?? null;
}

function getContextFromDocument(document: { $locals?: Record<string, unknown> }) {
  const context = document.$locals?.[String(DOC_AUDIT_CONTEXT_KEY)] as AuditContext | undefined;
  return context ?? null;
}

export function setAuditContextForQuery<T extends Query<unknown, unknown>>(
  query: T,
  context: AuditContext,
) {
  (query as T & { [QUERY_AUDIT_CONTEXT_KEY]?: AuditContext })[QUERY_AUDIT_CONTEXT_KEY] = context;
  return query;
}

export function setAuditContextForDocument(
  document: { $locals?: Record<string, unknown> },
  context: AuditContext,
) {
  if (!document.$locals) {
    document.$locals = {};
  }
  document.$locals[String(DOC_AUDIT_CONTEXT_KEY)] = context;
}

export function applyModelDeltaAuditPlugin(
  schema: Schema,
  options?: AuditPluginOptions,
) {
  const ignoredPaths = new Set<string>([
    ...DEFAULT_IGNORED_PATHS,
    ...(options?.ignorePaths ?? []),
  ]);

  schema.pre(["findOneAndUpdate", "updateOne"], async function queryBeforeUpdate() {
    const query = this as Query<unknown, unknown> & {
      [QUERY_AUDIT_STATE_KEY]?: QueryAuditState;
    };

    const before = (await query.model.findOne(query.getFilter()).lean()) as AnyRecord | null;

    query[QUERY_AUDIT_STATE_KEY] = {
      before,
      filter: (query.getFilter() ?? {}) as AnyRecord,
    };
  });

  schema.post("findOneAndUpdate", async function queryAfterFindOneAndUpdate(result: unknown) {
    const query = this as Query<unknown, unknown> & {
      [QUERY_AUDIT_STATE_KEY]?: QueryAuditState;
    };

    const state = query[QUERY_AUDIT_STATE_KEY];
    if (!state) {
      return;
    }

    const resultDoc = (result ?? null) as AnyRecord | null;
    let after = resultDoc;

    if (!after) {
      after = (await query.model.findOne(state.filter).lean()) as AnyRecord | null;
    }

    if (!after) {
      return;
    }

    const operation = state.before ? "update" : "create";
    const delta: AuditDelta[] = [];

    if (operation === "create") {
      collectCreateDelta(after, "", delta, ignoredPaths);
    } else {
      collectUpdateDelta(state.before, after, "", delta, ignoredPaths);
    }

    if (delta.length === 0) {
      return;
    }

    const documentId = readDocumentId(after);
    if (!documentId) {
      return;
    }

    const actorId = readActorIdFromDocument(after) ?? readActorIdFromDocument(state.before);
    const documentEmail = readDocumentEmail(after) ?? readDocumentEmail(state.before);
    const context = getContextFromQuery(query);

    try {
      await writeAuditEntry({
        model: query.model as unknown as AuditModelRef,
        modelName: query.model.modelName,
        collectionName: query.model.collection.name,
        documentId,
        documentEmail,
        operation,
        delta,
        actorId,
        context,
        source: options?.source ?? null,
      });
    } catch {
      // Best-effort only: never fail primary writes if auditing has an issue.
    }
  });

  schema.post("updateOne", async function queryAfterUpdateOne() {
    const query = this as Query<unknown, unknown> & {
      [QUERY_AUDIT_STATE_KEY]?: QueryAuditState;
    };

    const state = query[QUERY_AUDIT_STATE_KEY];
    if (!state) {
      return;
    }

    const after = (await query.model.findOne(state.filter).lean()) as AnyRecord | null;

    if (!after) {
      return;
    }

    const operation = state.before ? "update" : "create";
    const delta: AuditDelta[] = [];

    if (operation === "create") {
      collectCreateDelta(after, "", delta, ignoredPaths);
    } else {
      collectUpdateDelta(state.before, after, "", delta, ignoredPaths);
    }

    if (delta.length === 0) {
      return;
    }

    const documentId = readDocumentId(after);
    if (!documentId) {
      return;
    }

    const actorId = readActorIdFromDocument(after) ?? readActorIdFromDocument(state.before);
    const documentEmail = readDocumentEmail(after) ?? readDocumentEmail(state.before);
    const context = getContextFromQuery(query);

    try {
      await writeAuditEntry({
        model: query.model as unknown as AuditModelRef,
        modelName: query.model.modelName,
        collectionName: query.model.collection.name,
        documentId,
        documentEmail,
        operation,
        delta,
        actorId,
        context,
        source: options?.source ?? null,
      });
    } catch {
      // Best-effort only: never fail primary writes if auditing has an issue.
    }
  });

  schema.pre("save", async function documentBeforeSave() {
    const document = this as unknown as {
      isNew: boolean;
      _id?: unknown;
      constructor: {
        findById: (id: unknown) => { lean: () => Promise<AnyRecord | null> };
      };
      $locals?: Record<string, unknown>;
    };

    if (!document.$locals) {
      document.$locals = {};
    }

    document.$locals.__auditWasNew = document.isNew;

    if (document.isNew || !document._id) {
      document.$locals.__auditBefore = null;
      return;
    }

    const before = await document.constructor.findById(document._id).lean();
    document.$locals.__auditBefore = before;
  });

  schema.post("save", async function documentAfterSave() {
    const document = this as unknown as {
      toObject: () => AnyRecord;
      constructor: {
        db: AuditModelRef["db"];
        modelName?: string;
        collection?: { name?: string };
      };
      $locals?: Record<string, unknown>;
    };

    const after = document.toObject();
    const before = (document.$locals?.__auditBefore ?? null) as AnyRecord | null;
    const wasNew = Boolean(document.$locals?.__auditWasNew);

    const operation = wasNew ? "create" : "update";
    const delta: AuditDelta[] = [];

    if (operation === "create") {
      collectCreateDelta(after, "", delta, ignoredPaths);
    } else {
      collectUpdateDelta(before, after, "", delta, ignoredPaths);
    }

    if (delta.length === 0) {
      return;
    }

    const documentId = readDocumentId(after);
    if (!documentId) {
      return;
    }

    const actorId = readActorIdFromDocument(after) ?? readActorIdFromDocument(before);
    const documentEmail = readDocumentEmail(after) ?? readDocumentEmail(before);
    const context = getContextFromDocument(document);
    const modelRef = document.constructor;

    try {
      await writeAuditEntry({
        model: modelRef as AuditModelRef,
        modelName: modelRef.modelName ?? "UnknownModel",
        collectionName: modelRef.collection?.name ?? "unknown_collection",
        documentId,
        documentEmail,
        operation,
        delta,
        actorId,
        context,
        source: options?.source ?? null,
      });
    } catch {
      // Best-effort only: never fail primary writes if auditing has an issue.
    }
  });
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button, Card, CardBody, Typography } from "@/app/_types/mtw";
import AppNavbar from "@/app/_components/AppNavbar";
import { isAuthenticated } from "@/app/_utils/auth";

type AuditModelName = "Post" | "Community" | "Comment" | "Tag" | "UserProfile";
type AuditOperation = "all" | "create" | "update";

type AuditDeltaItem = {
  path: string;
  from: unknown;
  to: unknown;
};

type AuditItem = {
  id: string;
  documentId: string;
  documentDisplayName: string | null;
  documentEmail?: string | null;
  modelName: AuditModelName;
  collectionName: string;
  operation: "create" | "update";
  actorId: string | null;
  actorName: string | null;
  actorEmail?: string | null;
  requestId: string | null;
  source: string | null;
  changedAt: string | null;
  delta: AuditDeltaItem[];
};

type AuditResponse = {
  items: AuditItem[];
  nextCursor: string | null;
  hasMore: boolean;
};

type AuditQueueState = {
  items: AuditItem[];
  nextCursor: string | null;
  hasMore: boolean;
  loading: boolean;
};

const PAGE_SIZE = 50;
const AUDIT_MODEL_OPTIONS: AuditModelName[] = [
  "Post",
  "Community",
  "Comment",
  "Tag",
  "UserProfile",
];

const defaultAuditQueueState = (): AuditQueueState => ({
  items: [],
  nextCursor: null,
  hasMore: false,
  loading: false,
});

function formatDisplayDate(input: string | Date) {
  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) return String(input);
  return parsed.toLocaleString();
}

function renderAuditValue(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function buildAuditDocumentLabel(item: AuditItem) {
  if (item.documentDisplayName) {
    return `${item.documentDisplayName} (${item.documentId})`;
  }

  if (item.documentEmail) {
    return `${item.documentEmail} (${item.documentId})`;
  }

  return item.documentId;
}

function buildActorLabel(item: AuditItem) {
  if (item.actorId && item.actorName) {
    return `${item.actorName} (${item.actorId})`;
  }

  if (item.actorId && item.actorEmail) {
    return `${item.actorEmail} (${item.actorId})`;
  }

  return item.actorId ?? "-";
}

export default function AdminAuditPage() {
  const { status } = useSession();
  const router = useRouter();

  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState("");
  const [auditModelName, setAuditModelName] = useState<AuditModelName>("Post");
  const [auditDocumentId, setAuditDocumentId] = useState("");
  const [auditOperation, setAuditOperation] = useState<AuditOperation>("all");
  const [auditQueue, setAuditQueue] = useState<AuditQueueState>(defaultAuditQueueState);

  useEffect(() => {
    if (status === "loading") {
      return;
    }

    if (status === "unauthenticated" && !isAuthenticated()) {
      router.replace("/");
      return;
    }

    let isMounted = true;

    const hydrate = async () => {
      try {
        const profileResponse = await fetch("/api/user-profile", { cache: "no-store" });
        if (!profileResponse.ok) {
          throw new Error("Failed profile check");
        }

        const profile = (await profileResponse.json()) as { isAdmin?: boolean };
        const nextIsAdmin = Boolean(profile.isAdmin);

        if (!isMounted) {
          return;
        }

        setIsAdmin(nextIsAdmin);

        if (!nextIsAdmin) {
          router.replace("/pages/home");
        }
      } catch {
        if (!isMounted) {
          return;
        }

        setError("Failed to load admin profile.");
      }
    };

    void hydrate();

    return () => {
      isMounted = false;
    };
  }, [router, status]);

  const fetchAudit = async (
    options?: {
      cursor?: string | null;
      append?: boolean;
      modelName?: AuditModelName;
      documentId?: string;
      operation?: AuditOperation;
    },
  ) => {
    setAuditQueue((prev) => ({ ...prev, loading: true }));

    try {
      const modelName = options?.modelName ?? auditModelName;
      const documentId = (options?.documentId ?? auditDocumentId).trim();
      const operation = options?.operation ?? auditOperation;

      const params = new URLSearchParams({
        modelName,
        limit: String(PAGE_SIZE),
      });

      if (documentId) {
        params.set("documentId", documentId);
      }

      if (operation !== "all") {
        params.set("operation", operation);
      }

      if (options?.cursor) {
        params.set("cursor", options.cursor);
      }

      const response = await fetch(`/api/admin/audit?${params.toString()}`, {
        cache: "no-store",
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(payload?.error ?? "Failed to load audit history.");
      }

      const payload = (await response.json()) as AuditResponse;

      setAuditQueue((prev) => ({
        ...prev,
        loading: false,
        items: options?.append ? [...prev.items, ...(payload.items ?? [])] : (payload.items ?? []),
        nextCursor: payload.nextCursor ?? null,
        hasMore: Boolean(payload.hasMore),
      }));
    } catch (caughtError) {
      setAuditQueue((prev) => ({ ...prev, loading: false }));
      const message = caughtError instanceof Error ? caughtError.message : "Failed to load audit history.";
      setError(message);
    }
  };

  const runAuditSearch = async () => {
    setError("");
    setAuditQueue(defaultAuditQueueState());
    await fetchAudit();
  };

  if (!isAdmin) {
    return null;
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <AppNavbar
        subtitle="Admin audit"
        maxWidthClassName="max-w-6xl"
        rightContent={(
          <div className="flex items-center gap-2">
            <Link
              href="/pages/admin"
              className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-blue-gray-700 hover:bg-slate-100"
            >
              Dashboard
            </Link>
            <Link
              href="/pages/admin/moderation"
              className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-blue-gray-700 hover:bg-slate-100"
            >
              Moderation
            </Link>
            <Link
              href="/pages/admin/audit"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-sm font-medium text-blue-gray-800"
            >
              Audit
            </Link>
            <Link
              href="/pages/home"
              className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-blue-gray-700 hover:bg-slate-100"
            >
              Back to Home
            </Link>
          </div>
        )}
      />

      <div className="mx-auto w-full max-w-6xl space-y-8 px-6 py-8 sm:px-10 lg:px-16">
        <section className="space-y-4 rounded-2xl border border-slate-200/80 bg-gradient-to-b from-slate-50 to-white p-4 sm:p-5">
          <div>
            <Typography variant="h5" className="text-blue-gray-900">
              Audit
            </Typography>
            <Typography className="text-sm text-slate-600">
              Inspect field-level deltas and who changed what.
            </Typography>
          </div>

          <Card className="border border-slate-200 bg-white shadow-none">
            <CardBody className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Typography variant="h5" className="text-blue-gray-900">Audit Explorer</Typography>
                <Typography className="text-xs text-slate-500">Query model delta history</Typography>
              </div>

              <div className="grid gap-2 md:grid-cols-4">
                <select
                  className="rounded border border-slate-300 px-2 py-2 text-sm"
                  value={auditModelName}
                  onChange={(event) => setAuditModelName(event.target.value as AuditModelName)}
                >
                  {AUDIT_MODEL_OPTIONS.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>

                <input
                  className="rounded border border-slate-300 px-2 py-2 text-sm"
                  placeholder="documentId (optional)"
                  value={auditDocumentId}
                  onChange={(event) => setAuditDocumentId(event.target.value)}
                />

                <select
                  className="rounded border border-slate-300 px-2 py-2 text-sm"
                  value={auditOperation}
                  onChange={(event) => setAuditOperation(event.target.value as AuditOperation)}
                >
                  <option value="all">all operations</option>
                  <option value="create">create</option>
                  <option value="update">update</option>
                </select>

                <Button
                  color="blue"
                  onClick={() => {
                    void runAuditSearch();
                  }}
                  disabled={auditQueue.loading}
                >
                  {auditQueue.loading ? "Loading..." : "Search Audit"}
                </Button>
              </div>

              {error ? <Typography className="text-red-600">{error}</Typography> : null}

              {auditQueue.items.length === 0 ? (
                <Typography className="text-slate-600">No audit events loaded yet. Run a search.</Typography>
              ) : (
                <div className="space-y-2">
                  {auditQueue.items.map((item) => (
                    <div key={item.id} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                      <Typography className="text-sm font-semibold text-blue-gray-900">
                        {item.modelName} • {item.operation}
                      </Typography>
                      <Typography className="pt-1 text-xs text-slate-500">
                        doc: {buildAuditDocumentLabel(item)} • at: {item.changedAt ? formatDisplayDate(item.changedAt) : "-"}
                      </Typography>
                      <Typography className="pt-1 text-xs text-slate-500">
                        actor: {buildActorLabel(item)} • source: {item.source ?? "-"} • req: {item.requestId ?? "-"}
                      </Typography>

                      {item.delta.length === 0 ? (
                        <Typography className="pt-2 text-xs text-slate-600">No field deltas.</Typography>
                      ) : (
                        <div className="mt-2 overflow-x-auto">
                          <table className="min-w-full border-collapse text-left text-xs">
                            <thead>
                              <tr className="border-b border-slate-200 text-slate-500">
                                <th className="py-1 pr-2 font-medium">Field</th>
                                <th className="py-1 pr-2 font-medium">From</th>
                                <th className="py-1 font-medium">To</th>
                              </tr>
                            </thead>
                            <tbody>
                              {item.delta.map((change, index) => (
                                <tr key={`${item.id}-${change.path}-${index}`} className="border-b border-slate-100 align-top">
                                  <td className="py-1 pr-2 text-blue-gray-900">{change.path}</td>
                                  <td className="py-1 pr-2 text-slate-600">
                                    {renderAuditValue(change.from)}
                                  </td>
                                  <td className="py-1 text-slate-600">
                                    {renderAuditValue(change.to)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {auditQueue.hasMore ? (
                <Button
                  size="sm"
                  variant="outlined"
                  color="blue-gray"
                  onClick={() => {
                    void fetchAudit({
                      cursor: auditQueue.nextCursor,
                      append: true,
                    });
                  }}
                  disabled={auditQueue.loading}
                >
                  {auditQueue.loading ? "Loading..." : "Load More Audit Events"}
                </Button>
              ) : null}
            </CardBody>
          </Card>
        </section>
      </div>
    </main>
  );
}

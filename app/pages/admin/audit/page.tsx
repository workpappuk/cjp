"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Button,
  Card,
  CardBody,
  Spinner,
  Timeline,
  TimelineItem,
  TimelineConnector,
  TimelineHeader,
  TimelineIcon,
  TimelineBody,
  Typography,
} from "@/app/_types/mtw";
import AppNavbar from "@/app/_components/AppNavbar";
import AppToast, { type AppToastTone } from "@/app/_components/AppToast";
import { useTheme } from "@/app/_context/theme-context";
import { getThemeColorTokens } from "@/app/_utils/theme-colors";
import { useSignInRedirect } from "@/app/_utils/use-sign-in-redirect";

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

function getTimelineIconColor(operation: AuditOperation | "create" | "update") {
  if (operation === "create") {
    return "green" as const;
  }

  if (operation === "update") {
    return "blue" as const;
  }

  return "blue-gray" as const;
}

export default function AdminAuditPage() {
  const { status } = useSession();
  const router = useRouter();
  const { theme } = useTheme();
  const { accent } = getThemeColorTokens(theme);

  const [isAdmin, setIsAdmin] = useState(false);
  const [isCheckingAdmin, setIsCheckingAdmin] = useState(true);
  const [toast, setToast] = useState<{ open: boolean; message: string; tone: AppToastTone }>({
    open: false,
    message: "",
    tone: "info",
  });
  const [auditModelName, setAuditModelName] = useState<AuditModelName>("Post");
  const [auditDocumentId, setAuditDocumentId] = useState("");
  const [auditOperation, setAuditOperation] = useState<AuditOperation>("all");
  const [auditQueue, setAuditQueue] = useState<AuditQueueState>(defaultAuditQueueState);

  const showToast = useCallback((message: string, tone: AppToastTone = "info") => {
    setToast({ open: true, message, tone });
  }, []);

  const { requiresSignIn, promptSignIn } = useSignInRedirect({
    status,
    onBeforeRedirect: (reason) => showToast(reason, "info"),
  });

  useEffect(() => {
    if (status === "loading") {
      return;
    }

    if (requiresSignIn) {
      promptSignIn("Sign in to access the admin audit log.");
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

        showToast("Failed to load admin profile.", "error");
      } finally {
        if (!isMounted) {
          return;
        }

        setIsCheckingAdmin(false);
      }
    };

    void hydrate();

    return () => {
      isMounted = false;
    };
  }, [promptSignIn, requiresSignIn, router, status]);

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
      showToast(message, "error");
    }
  };

  const runAuditSearch = async () => {
    setAuditQueue(defaultAuditQueueState());
    await fetchAudit();
  };

  if (status === "loading" || isCheckingAdmin) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        <div className="inline-flex items-center gap-3">
          <Spinner className="h-5 w-5" />
          <Typography>Loading audit page...</Typography>
        </div>
      </main>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <AppNavbar
        subtitle="Admin audit"
        maxWidthClassName="max-w-none"
        rightContent={(
          <div className="flex items-center gap-2">
            <Link
              href="/pages/admin"
              className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${accent.link}`}
            >
              Dashboard
            </Link>
            <Link
              href="/pages/admin/moderation"
              className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${accent.link}`}
            >
              Moderation
            </Link>
            <Link
              href="/pages/admin/audit"
              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium ${accent.activePill}`}
            >
              Audit
            </Link>
            <Link
              href="/pages/home"
              className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Back to Home
            </Link>
          </div>
        )}
      />

      <div className="mx-auto w-full max-w-none space-y-8 px-6 py-8 sm:px-10 lg:px-16">
        <section className={`space-y-4 rounded-2xl border bg-linear-to-b from-slate-50 to-white p-4 sm:p-5 dark:from-slate-950 dark:to-slate-900 ${accent.section}`}>
          <div>
            <Typography variant="h5" className={accent.title}>
              Audit
            </Typography>
            <Typography className="text-sm text-slate-700 dark:text-slate-200">
              Inspect field-level deltas and who changed what.
            </Typography>
          </div>

          <Card className="border border-slate-200 bg-white shadow-none dark:border-slate-700 dark:bg-slate-900">
            <CardBody className="space-y-4 p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Typography variant="h5" className={accent.title}>Audit Explorer</Typography>
                <Typography className="text-xs text-slate-700 dark:text-slate-300">Query model delta history</Typography>
              </div>

              <div className="grid gap-2 md:grid-cols-4 md:items-end">
                <select
                  className="h-10 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  value={auditModelName}
                  onChange={(event) => setAuditModelName(event.target.value as AuditModelName)}
                >
                  {AUDIT_MODEL_OPTIONS.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>

                <input
                  className="h-10 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-400"
                  placeholder="documentId (optional)"
                  value={auditDocumentId}
                  onChange={(event) => setAuditDocumentId(event.target.value)}
                />

                <select
                  className="h-10 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  value={auditOperation}
                  onChange={(event) => setAuditOperation(event.target.value as AuditOperation)}
                >
                  <option value="all">all operations</option>
                  <option value="create">create</option>
                  <option value="update">update</option>
                </select>

                <Button
                  color="blue"
                  className="h-10 rounded-lg"
                  onClick={() => {
                    void runAuditSearch();
                  }}
                  disabled={auditQueue.loading}
                >
                  {auditQueue.loading ? (
                    <span className="inline-flex items-center gap-2">
                      <Spinner className="h-4 w-4" />
                      Loading...
                    </span>
                  ) : "Search Audit"}
                </Button>
              </div>

              {auditQueue.items.length === 0 ? (
                <Typography className="text-slate-700 dark:text-slate-200">No audit events loaded yet. Run a search.</Typography>
              ) : (
                <Timeline>
                  {auditQueue.items.map((item, index) => (
                    <TimelineItem key={item.id} className="pb-8 last:pb-0">
                      {index < auditQueue.items.length - 1 ? <TimelineConnector className="w-0.5! bg-slate-300 dark:bg-slate-700" /> : null}

                      <TimelineHeader>
                        <TimelineIcon color={getTimelineIconColor(item.operation)} />
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <Typography className="text-sm font-semibold text-blue-gray-900 dark:text-slate-100">
                            {item.modelName}
                          </Typography>
                          <span className="text-xs font-medium uppercase tracking-wide text-slate-700 dark:text-slate-300">
                            {item.operation}
                          </span>
                        </div>
                      </TimelineHeader>

                      <TimelineBody className="mt-2 rounded-xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-700 dark:bg-slate-800/70">
                        <Typography className="text-xs text-slate-700 dark:text-slate-300">
                          doc: {buildAuditDocumentLabel(item)} • at: {item.changedAt ? formatDisplayDate(item.changedAt) : "-"}
                        </Typography>
                        <Typography className="pt-1 text-xs text-slate-700 dark:text-slate-300">
                          actor: {buildActorLabel(item)} • source: {item.source ?? "-"} • req: {item.requestId ?? "-"}
                        </Typography>

                        {item.delta.length === 0 ? (
                          <Typography className="pt-2 text-xs text-slate-700 dark:text-slate-200">No field deltas.</Typography>
                        ) : (
                          <div className="mt-2 overflow-x-auto">
                            <table className="min-w-full border-collapse text-left text-xs">
                              <thead>
                                <tr className="border-b border-slate-200 text-slate-700 dark:border-slate-700 dark:text-slate-300">
                                  <th className="py-1 pr-2 font-medium">Field</th>
                                  <th className="py-1 pr-2 font-medium">From</th>
                                  <th className="py-1 font-medium">To</th>
                                </tr>
                              </thead>
                              <tbody>
                                {item.delta.map((change, deltaIndex) => (
                                  <tr key={`${item.id}-${change.path}-${deltaIndex}`} className="border-b border-slate-100 align-top dark:border-slate-700">
                                    <td className="py-1 pr-2 text-blue-gray-900 dark:text-slate-100">{change.path}</td>
                                    <td className="py-1 pr-2 text-slate-700 dark:text-slate-200">
                                      {renderAuditValue(change.from)}
                                    </td>
                                    <td className="py-1 text-slate-700 dark:text-slate-200">
                                      {renderAuditValue(change.to)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </TimelineBody>
                    </TimelineItem>
                  ))}
                </Timeline>
              )}

              {auditQueue.hasMore ? (
                <Button
                  size="sm"
                  variant="outlined"
                  color="blue-gray"
                  className="rounded-lg"
                  onClick={() => {
                    void fetchAudit({
                      cursor: auditQueue.nextCursor,
                      append: true,
                    });
                  }}
                  disabled={auditQueue.loading}
                >
                  {auditQueue.loading ? (
                    <span className="inline-flex items-center gap-2">
                      <Spinner className="h-4 w-4" />
                      Loading...
                    </span>
                  ) : "Load More Audit Events"}
                </Button>
              ) : null}
            </CardBody>
          </Card>
        </section>
      </div>
      <AppToast
        open={toast.open}
        message={toast.message}
        tone={toast.tone}
        onClose={() => setToast((prev) => ({ ...prev, open: false }))}
      />
    </main>
  );
}

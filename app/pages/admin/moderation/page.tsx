"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button, Card, CardBody, Chip, Spinner, Typography } from "@/app/_types/mtw";
import AppNavbar from "@/app/_components/AppNavbar";
import AppToast, { type AppToastTone } from "@/app/_components/AppToast";
import PostImageCarousel from "@/app/_components/PostImageCarousel";
import { useTheme } from "@/app/_context/theme-context";
import { isAuthenticated } from "@/app/_utils/auth";
import { getThemeColorTokens } from "@/app/_utils/theme-colors";

type ModerationStatus = "pending" | "approved" | "rejected";
type RecordStatus = "active" | "deleted" | "archived" | "flagged";
type TargetType = "Post" | "Community" | "Comment";

type ModerationPost = {
  id: string;
  title: string;
  content: string;
  communities: string[];
  moderationStatus: ModerationStatus;
  recordStatus: RecordStatus;
  createdAt: string;
};

type ModerationCommunity = {
  id: string;
  name: string;
  moderationStatus: ModerationStatus;
  recordStatus: RecordStatus;
  createdAt: string;
};

type ModerationComment = {
  id: string;
  targetType: string;
  targetId: string;
  text: string;
  imageUrls?: string[];
  moderationStatus: ModerationStatus;
  recordStatus: RecordStatus;
  createdAt: string;
};

type Summary = {
  pending: {
    posts: number;
    communities: number;
    comments: number;
    total: number;
  };
};

type QueueState<TItem> = {
  items: TItem[];
  nextCursor: string | null;
  hasMore: boolean;
  loading: boolean;
  moderationFilter: ModerationStatus | "all";
  recordFilter: RecordStatus | "all";
};

type QueueResponse<TItem> = {
  items: TItem[];
  nextCursor: string | null;
  hasMore: boolean;
};

type QueueFetchOptions = {
  moderationFilter: ModerationStatus | "all";
  recordFilter: RecordStatus | "all";
  cursor?: string | null;
  append?: boolean;
};

type UploadScope = "post" | "community" | "comment";

type UploadCleanupResponse = {
  dryRun: boolean;
  maxDelete: number;
  scope: UploadScope | "all";
  deletedTotal: number;
  results: Array<{
    scope: UploadScope;
    totalStored: number;
    totalReferenced: number;
    orphanedCount: number;
    deletedCount: number;
    sampleOrphans: string[];
  }>;
};

const PAGE_SIZE = 50;

const defaultQueueState = <TItem,>(): QueueState<TItem> => ({
  items: [],
  nextCursor: null,
  hasMore: false,
  loading: false,
  moderationFilter: "pending",
  recordFilter: "all",
});

function formatDisplayDate(input: string | Date) {
  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) return String(input);
  return parsed.toLocaleString();
}

function getModerationChipColor(status: ModerationStatus) {
  if (status === "approved") return "green" as const;
  if (status === "rejected") return "red" as const;
  return "amber" as const;
}

function getRecordChipColor(status: RecordStatus) {
  if (status === "active") return "green" as const;
  if (status === "flagged") return "amber" as const;
  if (status === "deleted") return "red" as const;
  return "blue-gray" as const;
}

function buildQueueUrl(
  targetType: TargetType,
  moderationFilter: ModerationStatus | "all",
  recordFilter: RecordStatus | "all",
  cursor?: string | null,
) {
  const params = new URLSearchParams({
    targetType,
    limit: String(PAGE_SIZE),
    moderationStatus: moderationFilter,
    recordStatus: recordFilter,
  });

  if (cursor) {
    params.set("cursor", cursor);
  }

  return `/api/admin/moderation?${params.toString()}`;
}

export default function AdminModerationPage() {
  const { status } = useSession();
  const router = useRouter();
  const { theme } = useTheme();
  const { accent } = getThemeColorTokens(theme);

  const [isAdmin, setIsAdmin] = useState(false);
  const [isCheckingAdmin, setIsCheckingAdmin] = useState(true);
  const [isLoadingSummary, setIsLoadingSummary] = useState(true);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [toast, setToast] = useState<{ open: boolean; message: string; tone: AppToastTone }>({
    open: false,
    message: "",
    tone: "info",
  });

  const [postQueue, setPostQueue] = useState<QueueState<ModerationPost>>(defaultQueueState);
  const [communityQueue, setCommunityQueue] = useState<QueueState<ModerationCommunity>>(defaultQueueState);
  const [commentQueue, setCommentQueue] = useState<QueueState<ModerationComment>>(defaultQueueState);
  const [expandedCommentMediaIds, setExpandedCommentMediaIds] = useState<string[]>([]);
  const [isRunningUploadCleanup, setIsRunningUploadCleanup] = useState(false);
  const [cleanupSummary, setCleanupSummary] = useState<UploadCleanupResponse | null>(null);

  const pendingTotal = useMemo(() => {
    return summary?.pending.total ?? 0;
  }, [summary]);

  const showToast = (message: string, tone: AppToastTone = "info") => {
    setToast({ open: true, message, tone });
  };

  const fetchSummary = async () => {
    const response = await fetch("/api/admin/moderation", { cache: "no-store" });
    if (!response.ok) {
      throw new Error("Failed to load summary");
    }

    const payload = (await response.json()) as { summary?: Summary };
    setSummary(payload.summary ?? null);
  };

  const fetchQueue = async <TItem,>(
    targetType: TargetType,
    setState: React.Dispatch<React.SetStateAction<QueueState<TItem>>>,
    options: QueueFetchOptions,
  ) => {
    setState((prev) => ({ ...prev, loading: true }));

    const url = buildQueueUrl(
      targetType,
      options.moderationFilter,
      options.recordFilter,
      options.cursor ?? null,
    );

    try {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`Failed to load ${targetType} queue`);
      }

      const payload = (await response.json()) as QueueResponse<TItem>;

      setState((prev) => ({
        ...prev,
        loading: false,
        items: options.append ? [...prev.items, ...payload.items] : payload.items,
        nextCursor: payload.nextCursor,
        hasMore: payload.hasMore,
      }));
    } catch {
      setState((prev) => ({ ...prev, loading: false }));
      showToast(`Failed to load ${targetType} queue.`, "error");
    }
  };

  const refreshQueueForTarget = async (targetType: TargetType) => {
    if (targetType === "Post") {
      await fetchQueue("Post", setPostQueue, {
        moderationFilter: postQueue.moderationFilter,
        recordFilter: postQueue.recordFilter,
      });
      return;
    }

    if (targetType === "Community") {
      await fetchQueue("Community", setCommunityQueue, {
        moderationFilter: communityQueue.moderationFilter,
        recordFilter: communityQueue.recordFilter,
      });
      return;
    }

    await fetchQueue("Comment", setCommentQueue, {
      moderationFilter: commentQueue.moderationFilter,
      recordFilter: commentQueue.recordFilter,
    });
  };

  const sendModerationPatchWithRetry = async (payload: {
    targetType: TargetType;
    targetId: string;
    action?: "approve" | "reject";
    recordStatus?: RecordStatus;
  }) => {
    let didRetryAfterConflict = false;

    while (true) {
      const response = await fetch("/api/admin/moderation", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (response.status !== 409 || didRetryAfterConflict) {
        return {
          response,
          didRetryAfterConflict,
        };
      }

      didRetryAfterConflict = true;
      await Promise.all([
        fetchSummary(),
        refreshQueueForTarget(payload.targetType),
      ]);
    }
  };

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
      setIsLoadingSummary(true);

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
          return;
        }

        await fetchSummary();

        await Promise.all([
          fetchQueue("Post", setPostQueue, {
            moderationFilter: "pending",
            recordFilter: "all",
          }),
          fetchQueue("Community", setCommunityQueue, {
            moderationFilter: "pending",
            recordFilter: "all",
          }),
          fetchQueue("Comment", setCommentQueue, {
            moderationFilter: "pending",
            recordFilter: "all",
          }),
        ]);
      } catch {
        if (!isMounted) return;
        showToast("Failed to load admin data.", "error");
      } finally {
        if (!isMounted) return;
        setIsCheckingAdmin(false);
        setIsLoadingSummary(false);
      }
    };

    void hydrate();

    return () => {
      isMounted = false;
    };
  }, [router, status]);

  const moderate = async (
    targetType: TargetType,
    targetId: string,
    action: "approve" | "reject",
  ) => {
    const { response, didRetryAfterConflict } = await sendModerationPatchWithRetry({
      targetType,
      targetId,
      action,
    });

    if (!response.ok) {
      if (response.status === 409) {
        showToast("This item changed while you were moderating. Please review and retry.", "warning");
      } else {
        showToast("Moderation action failed. Please retry.", "error");
      }
      return;
    }

    if (didRetryAfterConflict) {
      showToast("Moderation saved after resolving a concurrent update.", "success");
    }

    const payload = (await response.json()) as {
      moderationStatus?: ModerationStatus;
      recordStatus?: RecordStatus;
    };

    const apply = <T extends { id: string; moderationStatus: ModerationStatus; recordStatus: RecordStatus }>(
      list: T[],
    ) =>
      list.map((item) =>
        item.id === targetId
          ? {
              ...item,
              moderationStatus: payload.moderationStatus ?? item.moderationStatus,
              recordStatus: payload.recordStatus ?? item.recordStatus,
            }
          : item,
      );

    if (targetType === "Post") {
      setPostQueue((prev) => ({ ...prev, items: apply(prev.items) }));
    } else if (targetType === "Community") {
      setCommunityQueue((prev) => ({ ...prev, items: apply(prev.items) }));
    } else {
      setCommentQueue((prev) => ({ ...prev, items: apply(prev.items) }));
    }

    void fetchSummary();
  };

  const updateRecordStatus = async (
    targetType: TargetType,
    targetId: string,
    recordStatus: RecordStatus,
  ) => {
    const { response, didRetryAfterConflict } = await sendModerationPatchWithRetry({
      targetType,
      targetId,
      recordStatus,
    });

    if (!response.ok) {
      if (response.status === 409) {
        showToast("This item changed while you were updating it. Please review and retry.", "warning");
      } else {
        showToast("Status update failed. Please retry.", "error");
      }
      return;
    }

    if (didRetryAfterConflict) {
      showToast("Record status saved after resolving a concurrent update.", "success");
    }

    const payload = (await response.json()) as {
      moderationStatus?: ModerationStatus;
      recordStatus?: RecordStatus;
    };

    const apply = <T extends { id: string; moderationStatus: ModerationStatus; recordStatus: RecordStatus }>(
      list: T[],
    ) =>
      list.map((item) =>
        item.id === targetId
          ? {
              ...item,
              moderationStatus: payload.moderationStatus ?? item.moderationStatus,
              recordStatus: payload.recordStatus ?? item.recordStatus,
            }
          : item,
      );

    if (targetType === "Post") {
      setPostQueue((prev) => ({ ...prev, items: apply(prev.items) }));
    } else if (targetType === "Community") {
      setCommunityQueue((prev) => ({ ...prev, items: apply(prev.items) }));
    } else {
      setCommentQueue((prev) => ({ ...prev, items: apply(prev.items) }));
    }
  };

  const updateFilters = <TItem,>(
    targetType: TargetType,
    setState: React.Dispatch<React.SetStateAction<QueueState<TItem>>>,
    nextFilters: {
      moderationFilter: ModerationStatus | "all";
      recordFilter: RecordStatus | "all";
    },
  ) => {
    setState((prev) => ({
      ...prev,
      moderationFilter: nextFilters.moderationFilter,
      recordFilter: nextFilters.recordFilter,
      items: [],
      nextCursor: null,
      hasMore: false,
    }));

    void fetchQueue(targetType, setState, {
      moderationFilter: nextFilters.moderationFilter,
      recordFilter: nextFilters.recordFilter,
    });
  };

  const runUploadsCleanup = async ({ dryRun }: { dryRun: boolean }) => {
    setIsRunningUploadCleanup(true);

    try {
      const response = await fetch("/api/admin/uploads/cleanup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          scope: "all",
          dryRun,
          maxDelete: 1000,
        }),
      });

      if (!response.ok) {
        throw new Error("Cleanup request failed");
      }

      const payload = (await response.json()) as UploadCleanupResponse;
      setCleanupSummary(payload);

      if (payload.dryRun) {
        const totalOrphans = payload.results.reduce((sum, item) => sum + item.orphanedCount, 0);
        showToast(`Dry run complete. Found ${totalOrphans} orphaned uploads.`, "info");
      } else {
        showToast(`Cleanup complete. Deleted ${payload.deletedTotal} orphaned uploads.`, "success");
      }
    } catch {
      showToast("Failed to run uploads cleanup.", "error");
    } finally {
      setIsRunningUploadCleanup(false);
    }
  };

  const toggleCommentMedia = (commentId: string) => {
    setExpandedCommentMediaIds((prev) =>
      prev.includes(commentId)
        ? prev.filter((id) => id !== commentId)
        : [...prev, commentId],
    );
  };

  if (status === "loading" || isCheckingAdmin) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        <div className="inline-flex items-center gap-3">
          <Spinner className="h-5 w-5" />
          <Typography>Loading moderation page...</Typography>
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
        subtitle="Admin moderation"
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
              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium ${accent.activePill}`}
            >
              Moderation
            </Link>
            <Link
              href="/pages/admin/audit"
              className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${accent.link}`}
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
        <section className={`space-y-4 rounded-2xl border bg-linear-to-b from-white to-slate-50 p-4 sm:p-5 dark:from-slate-900 dark:to-slate-950 ${accent.section}`}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <Typography variant="h5" className={accent.title}>
                Moderation
              </Typography>
              <Typography className="text-sm text-slate-700 dark:text-slate-200">
                Review posts, communities, and comments that need admin decisions.
              </Typography>
            </div>
          </div>

          <Card className="border border-slate-200 bg-white shadow-none dark:border-slate-700 dark:bg-slate-900">
            <CardBody className="space-y-3 p-5">
              <Typography variant="h4" className={accent.title}>
                Moderation Queue
              </Typography>
              <Typography className="text-slate-700 dark:text-slate-200">
                {pendingTotal.toLocaleString()} pending items requiring admin attention.
              </Typography>
              {isLoadingSummary ? (
                <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
                  <Spinner className="h-4 w-4" />
                  <Typography>Loading summary...</Typography>
                </div>
              ) : null}
            </CardBody>
          </Card>

          <Card className="border border-slate-200 bg-white shadow-none dark:border-slate-700 dark:bg-slate-900">
            <CardBody className="space-y-4 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <Typography variant="h5" className="text-blue-gray-900 dark:text-slate-100">Uploads Cleanup</Typography>
                  <Typography className="text-sm text-slate-700 dark:text-slate-300">
                    Find and remove orphaned image uploads that are no longer referenced.
                  </Typography>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outlined"
                    color="blue-gray"
                    onClick={() => void runUploadsCleanup({ dryRun: true })}
                    disabled={isRunningUploadCleanup}
                  >
                    {isRunningUploadCleanup ? "Running..." : "Dry Run"}
                  </Button>
                  <Button
                    size="sm"
                    color="red"
                    onClick={() => void runUploadsCleanup({ dryRun: false })}
                    disabled={isRunningUploadCleanup}
                  >
                    {isRunningUploadCleanup ? "Running..." : "Delete Orphans"}
                  </Button>
                </div>
              </div>

              {cleanupSummary ? (
                <div className="space-y-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                  <div className="flex flex-wrap items-center gap-2">
                    <Chip
                      value={cleanupSummary.dryRun ? "Dry Run" : "Delete Mode"}
                      size="sm"
                      variant="ghost"
                      color={cleanupSummary.dryRun ? "blue-gray" : "red"}
                      className="rounded-full"
                    />
                    <Chip
                      value={`Deleted: ${cleanupSummary.deletedTotal}`}
                      size="sm"
                      variant="ghost"
                      color={cleanupSummary.deletedTotal > 0 ? "green" : "blue-gray"}
                      className="rounded-full"
                    />
                    <Chip
                      value={`Max Delete: ${cleanupSummary.maxDelete}`}
                      size="sm"
                      variant="ghost"
                      color="blue-gray"
                      className="rounded-full"
                    />
                  </div>

                  <div className="space-y-2">
                    {cleanupSummary.results.map((result) => (
                      <div key={result.scope} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                        <Typography className="font-medium text-slate-800 dark:text-slate-100">
                          {result.scope}
                        </Typography>
                        <Typography variant="small" className="text-slate-700 dark:text-slate-300">
                          Stored: {result.totalStored} | Referenced: {result.totalReferenced} | Orphaned: {result.orphanedCount} | Deleted: {result.deletedCount}
                        </Typography>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </CardBody>
          </Card>

          <Card className="border border-slate-200 bg-white shadow-none dark:border-slate-700 dark:bg-slate-900">
            <CardBody className="space-y-4 p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Typography variant="h5" className="text-blue-gray-900 dark:text-slate-100">Posts</Typography>
                <div className="flex flex-wrap gap-2">
                  <select
                    className="h-10 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                    value={postQueue.moderationFilter}
                    onChange={(event) =>
                      updateFilters("Post", setPostQueue, {
                        moderationFilter: event.target.value as ModerationStatus | "all",
                        recordFilter: postQueue.recordFilter,
                      })
                    }
                  >
                    <option value="pending">pending</option>
                    <option value="approved">approved</option>
                    <option value="rejected">rejected</option>
                    <option value="all">all</option>
                  </select>
                  <select
                    className="h-10 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                    value={postQueue.recordFilter}
                    onChange={(event) =>
                      updateFilters("Post", setPostQueue, {
                        moderationFilter: postQueue.moderationFilter,
                        recordFilter: event.target.value as RecordStatus | "all",
                      })
                    }
                  >
                    <option value="all">all status</option>
                    <option value="active">active</option>
                    <option value="flagged">flagged</option>
                    <option value="archived">archived</option>
                    <option value="deleted">deleted</option>
                  </select>
                </div>
              </div>

              {postQueue.items.length === 0 ? (
                <Typography className="text-slate-700 dark:text-slate-200">No matching posts.</Typography>
              ) : (
                postQueue.items.map((post) => (
                  <div key={post.id} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700 dark:bg-slate-800/70">
                    <Typography className="font-semibold text-blue-gray-900 dark:text-slate-100">{post.title}</Typography>
                    <Typography className="text-sm text-slate-700 dark:text-slate-200">{post.content}</Typography>
                    <Typography className="pt-1 text-xs text-slate-700 dark:text-slate-300">
                      {post.communities.join(", ") || "no communities"} • {formatDisplayDate(post.createdAt)}
                    </Typography>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Chip
                        value={`Moderation: ${post.moderationStatus}`}
                        size="sm"
                        variant="ghost"
                        color={getModerationChipColor(post.moderationStatus)}
                        className="rounded-full"
                      />
                      <Chip
                        value={`Status: ${post.recordStatus}`}
                        size="sm"
                        variant="ghost"
                        color={getRecordChipColor(post.recordStatus)}
                        className="rounded-full"
                      />
                    </div>
                    <div className="mt-3 flex gap-2">
                      <Button size="sm" color="green" onClick={() => moderate("Post", post.id, "approve")}>Approve</Button>
                      <Button size="sm" color="red" variant="outlined" onClick={() => moderate("Post", post.id, "reject")}>Reject</Button>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button size="sm" variant="outlined" color="blue" onClick={() => updateRecordStatus("Post", post.id, "active")}>Active</Button>
                      <Button size="sm" variant="outlined" color="amber" onClick={() => updateRecordStatus("Post", post.id, "flagged")}>Flagged</Button>
                      <Button size="sm" variant="outlined" color="blue-gray" onClick={() => updateRecordStatus("Post", post.id, "archived")}>Archived</Button>
                      <Button size="sm" variant="outlined" color="red" onClick={() => updateRecordStatus("Post", post.id, "deleted")}>Deleted</Button>
                    </div>
                  </div>
                ))
              )}

              {postQueue.hasMore ? (
                <Button
                  size="sm"
                  variant="outlined"
                  color="blue-gray"
                  onClick={() =>
                    void fetchQueue("Post", setPostQueue, {
                      moderationFilter: postQueue.moderationFilter,
                      recordFilter: postQueue.recordFilter,
                      cursor: postQueue.nextCursor,
                      append: true,
                    })
                  }
                  disabled={postQueue.loading}
                  className="rounded-lg"
                >
                    {postQueue.loading ? (
                      <span className="inline-flex items-center gap-2">
                        <Spinner className="h-4 w-4" />
                        Loading...
                      </span>
                    ) : "Load More Posts"}
                </Button>
              ) : null}
            </CardBody>
          </Card>

          <Card className="border border-slate-200 bg-white shadow-none dark:border-slate-700 dark:bg-slate-900">
            <CardBody className="space-y-4 p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Typography variant="h5" className="text-blue-gray-900 dark:text-slate-100">Communities</Typography>
                <div className="flex flex-wrap gap-2">
                  <select
                    className="h-10 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                    value={communityQueue.moderationFilter}
                    onChange={(event) =>
                      updateFilters("Community", setCommunityQueue, {
                        moderationFilter: event.target.value as ModerationStatus | "all",
                        recordFilter: communityQueue.recordFilter,
                      })
                    }
                  >
                    <option value="pending">pending</option>
                    <option value="approved">approved</option>
                    <option value="rejected">rejected</option>
                    <option value="all">all</option>
                  </select>
                  <select
                    className="h-10 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                    value={communityQueue.recordFilter}
                    onChange={(event) =>
                      updateFilters("Community", setCommunityQueue, {
                        moderationFilter: communityQueue.moderationFilter,
                        recordFilter: event.target.value as RecordStatus | "all",
                      })
                    }
                  >
                    <option value="all">all status</option>
                    <option value="active">active</option>
                    <option value="flagged">flagged</option>
                    <option value="archived">archived</option>
                    <option value="deleted">deleted</option>
                  </select>
                </div>
              </div>

              {communityQueue.items.length === 0 ? (
                <Typography className="text-slate-700 dark:text-slate-200">No matching communities.</Typography>
              ) : (
                communityQueue.items.map((community) => (
                  <div key={community.id} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700 dark:bg-slate-800/70">
                    <Typography className="font-semibold text-blue-gray-900 dark:text-slate-100">{community.name}</Typography>
                    <Typography className="pt-1 text-xs text-slate-700 dark:text-slate-300">{formatDisplayDate(community.createdAt)}</Typography>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Chip
                        value={`Moderation: ${community.moderationStatus}`}
                        size="sm"
                        variant="ghost"
                        color={getModerationChipColor(community.moderationStatus)}
                        className="rounded-full"
                      />
                      <Chip
                        value={`Status: ${community.recordStatus}`}
                        size="sm"
                        variant="ghost"
                        color={getRecordChipColor(community.recordStatus)}
                        className="rounded-full"
                      />
                    </div>
                    <div className="mt-3 flex gap-2">
                      <Button size="sm" color="green" onClick={() => moderate("Community", community.id, "approve")}>Approve</Button>
                      <Button size="sm" color="red" variant="outlined" onClick={() => moderate("Community", community.id, "reject")}>Reject</Button>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button size="sm" variant="outlined" color="blue" onClick={() => updateRecordStatus("Community", community.id, "active")}>Active</Button>
                      <Button size="sm" variant="outlined" color="amber" onClick={() => updateRecordStatus("Community", community.id, "flagged")}>Flagged</Button>
                      <Button size="sm" variant="outlined" color="blue-gray" onClick={() => updateRecordStatus("Community", community.id, "archived")}>Archived</Button>
                      <Button size="sm" variant="outlined" color="red" onClick={() => updateRecordStatus("Community", community.id, "deleted")}>Deleted</Button>
                    </div>
                  </div>
                ))
              )}

              {communityQueue.hasMore ? (
                <Button
                  size="sm"
                  variant="outlined"
                  color="blue-gray"
                  onClick={() =>
                    void fetchQueue("Community", setCommunityQueue, {
                      moderationFilter: communityQueue.moderationFilter,
                      recordFilter: communityQueue.recordFilter,
                      cursor: communityQueue.nextCursor,
                      append: true,
                    })
                  }
                  disabled={communityQueue.loading}
                  className="rounded-lg"
                >
                    {communityQueue.loading ? (
                      <span className="inline-flex items-center gap-2">
                        <Spinner className="h-4 w-4" />
                        Loading...
                      </span>
                    ) : "Load More Communities"}
                </Button>
              ) : null}
            </CardBody>
          </Card>

          <Card className="border border-slate-200 bg-white shadow-none dark:border-slate-700 dark:bg-slate-900">
            <CardBody className="space-y-4 p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Typography variant="h5" className="text-blue-gray-900 dark:text-slate-100">Comments</Typography>
                <div className="flex flex-wrap gap-2">
                  <select
                    className="h-10 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                    value={commentQueue.moderationFilter}
                    onChange={(event) =>
                      updateFilters("Comment", setCommentQueue, {
                        moderationFilter: event.target.value as ModerationStatus | "all",
                        recordFilter: commentQueue.recordFilter,
                      })
                    }
                  >
                    <option value="pending">pending</option>
                    <option value="approved">approved</option>
                    <option value="rejected">rejected</option>
                    <option value="all">all</option>
                  </select>
                  <select
                    className="h-10 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                    value={commentQueue.recordFilter}
                    onChange={(event) =>
                      updateFilters("Comment", setCommentQueue, {
                        moderationFilter: commentQueue.moderationFilter,
                        recordFilter: event.target.value as RecordStatus | "all",
                      })
                    }
                  >
                    <option value="all">all status</option>
                    <option value="active">active</option>
                    <option value="flagged">flagged</option>
                    <option value="archived">archived</option>
                    <option value="deleted">deleted</option>
                  </select>
                </div>
              </div>

              {commentQueue.items.length === 0 ? (
                <Typography className="text-slate-700 dark:text-slate-200">No matching comments.</Typography>
              ) : (
                commentQueue.items.map((comment) => (
                  <div key={comment.id} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700 dark:bg-slate-800/70">
                    <Typography className="text-sm text-slate-700 dark:text-slate-200">{comment.targetType} • {comment.targetId}</Typography>
                    <Typography className="font-medium text-blue-gray-900 dark:text-slate-100">{comment.text}</Typography>
                    {Array.isArray(comment.imageUrls) && comment.imageUrls.length > 0 ? (
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Chip
                            value={`${comment.imageUrls.length} media`}
                            size="sm"
                            variant="ghost"
                            color="blue-gray"
                            className="rounded-full"
                          />
                          <Button
                            size="sm"
                            variant="text"
                            color="blue-gray"
                            className="rounded-lg"
                            onClick={() => toggleCommentMedia(comment.id)}
                          >
                            {expandedCommentMediaIds.includes(comment.id) ? "Hide media" : "Show media"}
                          </Button>
                        </div>

                        {expandedCommentMediaIds.includes(comment.id) ? (
                          <PostImageCarousel
                            imageUrls={comment.imageUrls}
                            title="Comment media"
                            heightClassName="h-44 sm:h-52"
                          />
                        ) : null}
                      </div>
                    ) : null}
                    <Typography className="pt-1 text-xs text-slate-700 dark:text-slate-300">{formatDisplayDate(comment.createdAt)}</Typography>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Chip
                        value={`Moderation: ${comment.moderationStatus}`}
                        size="sm"
                        variant="ghost"
                        color={getModerationChipColor(comment.moderationStatus)}
                        className="rounded-full"
                      />
                      <Chip
                        value={`Status: ${comment.recordStatus}`}
                        size="sm"
                        variant="ghost"
                        color={getRecordChipColor(comment.recordStatus)}
                        className="rounded-full"
                      />
                    </div>
                    <div className="mt-3 flex gap-2">
                      <Button size="sm" color="green" onClick={() => moderate("Comment", comment.id, "approve")}>Approve</Button>
                      <Button size="sm" color="red" variant="outlined" onClick={() => moderate("Comment", comment.id, "reject")}>Reject</Button>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button size="sm" variant="outlined" color="blue" onClick={() => updateRecordStatus("Comment", comment.id, "active")}>Active</Button>
                      <Button size="sm" variant="outlined" color="amber" onClick={() => updateRecordStatus("Comment", comment.id, "flagged")}>Flagged</Button>
                      <Button size="sm" variant="outlined" color="blue-gray" onClick={() => updateRecordStatus("Comment", comment.id, "archived")}>Archived</Button>
                      <Button size="sm" variant="outlined" color="red" onClick={() => updateRecordStatus("Comment", comment.id, "deleted")}>Deleted</Button>
                    </div>
                  </div>
                ))
              )}

              {commentQueue.hasMore ? (
                <Button
                  size="sm"
                  variant="outlined"
                  color="blue-gray"
                  onClick={() =>
                    void fetchQueue("Comment", setCommentQueue, {
                      moderationFilter: commentQueue.moderationFilter,
                      recordFilter: commentQueue.recordFilter,
                      cursor: commentQueue.nextCursor,
                      append: true,
                    })
                  }
                  disabled={commentQueue.loading}
                  className="rounded-lg"
                >
                    {commentQueue.loading ? (
                      <span className="inline-flex items-center gap-2">
                        <Spinner className="h-4 w-4" />
                        Loading...
                      </span>
                    ) : "Load More Comments"}
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

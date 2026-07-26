"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button, Card, CardBody, Chip, Typography } from "@/app/_types/mtw";
import AppNavbar from "@/app/_components/AppNavbar";
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
  const [isLoadingSummary, setIsLoadingSummary] = useState(true);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState("");

  const [postQueue, setPostQueue] = useState<QueueState<ModerationPost>>(defaultQueueState);
  const [communityQueue, setCommunityQueue] = useState<QueueState<ModerationCommunity>>(defaultQueueState);
  const [commentQueue, setCommentQueue] = useState<QueueState<ModerationComment>>(defaultQueueState);

  const pendingTotal = useMemo(() => {
    return summary?.pending.total ?? 0;
  }, [summary]);

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
      setError(`Failed to load ${targetType} queue.`);
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
      setError("");

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
        setError("Failed to load admin data.");
      } finally {
        if (!isMounted) return;
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
    const response = await fetch("/api/admin/moderation", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ targetType, targetId, action }),
    });

    if (!response.ok) {
      setError("Moderation action failed. Please retry.");
      return;
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
    const response = await fetch("/api/admin/moderation", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ targetType, targetId, recordStatus }),
    });

    if (!response.ok) {
      setError("Status update failed. Please retry.");
      return;
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

  if (!isAdmin) {
    return null;
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <AppNavbar
        subtitle="Admin moderation"
        maxWidthClassName="max-w-6xl"
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

      <div className="mx-auto w-full max-w-6xl space-y-8 px-6 py-8 sm:px-10 lg:px-16">
        <section className={`space-y-4 rounded-2xl border bg-gradient-to-b from-white to-slate-50 p-4 sm:p-5 dark:from-slate-900 dark:to-slate-950 ${accent.section}`}>
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
            <CardBody className="space-y-2">
              <Typography variant="h4" className={accent.title}>
                Moderation Queue
              </Typography>
              <Typography className="text-slate-700 dark:text-slate-200">
                {pendingTotal.toLocaleString()} pending items requiring admin attention.
              </Typography>
              {error ? <Typography className="text-red-600">{error}</Typography> : null}
              {isLoadingSummary ? <Typography className="text-slate-700 dark:text-slate-200">Loading summary...</Typography> : null}
            </CardBody>
          </Card>

          <Card className="border border-slate-200 bg-white shadow-none dark:border-slate-700 dark:bg-slate-900">
            <CardBody className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Typography variant="h5" className="text-blue-gray-900 dark:text-slate-100">Posts</Typography>
                <div className="flex flex-wrap gap-2">
                  <select
                    className="rounded border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
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
                    className="rounded border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
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
                >
                  {postQueue.loading ? "Loading..." : "Load More Posts"}
                </Button>
              ) : null}
            </CardBody>
          </Card>

          <Card className="border border-slate-200 bg-white shadow-none dark:border-slate-700 dark:bg-slate-900">
            <CardBody className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Typography variant="h5" className="text-blue-gray-900 dark:text-slate-100">Communities</Typography>
                <div className="flex flex-wrap gap-2">
                  <select
                    className="rounded border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
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
                    className="rounded border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
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
                >
                  {communityQueue.loading ? "Loading..." : "Load More Communities"}
                </Button>
              ) : null}
            </CardBody>
          </Card>

          <Card className="border border-slate-200 bg-white shadow-none dark:border-slate-700 dark:bg-slate-900">
            <CardBody className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Typography variant="h5" className="text-blue-gray-900 dark:text-slate-100">Comments</Typography>
                <div className="flex flex-wrap gap-2">
                  <select
                    className="rounded border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
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
                    className="rounded border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
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
                >
                  {commentQueue.loading ? "Loading..." : "Load More Comments"}
                </Button>
              ) : null}
            </CardBody>
          </Card>
        </section>
      </div>
    </main>
  );
}

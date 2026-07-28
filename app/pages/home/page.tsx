"use client";

import type { ChangeEvent, FormEvent } from "react";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  HiArrowTopRightOnSquare,
  HiCheckCircle,
  HiFolderPlus,
  HiPencilSquare,
  HiUserPlus,
} from "react-icons/hi2";
import { Button, Card, CardBody, Chip, Input, Spinner, Typography } from "@/app/_types/mtw";
import { useTheme } from "@/app/_context/theme-context";
import AppNavbar from "@/app/_components/AppNavbar";
import AppToast, { type AppToastTone } from "@/app/_components/AppToast";
import PostImageCarousel from "@/app/_components/PostImageCarousel";
import TagsPicker from "@/app/_components/TagsPicker";
import { isAuthenticated } from "@/app/_utils/auth";
import { getThemeColorTokens } from "@/app/_utils/theme-colors";
import { attachTagsToTarget, dedupeTagNames } from "@/app/_utils/tags";
import { updateJoinedCommunitiesWithConflictRetry } from "@/app/_utils/api";

const HOME_UI_PREFS_KEY = "threadforge-home-ui-prefs";

type PostItem = {
  id: string | number;
  title: string;
  content: string;
  imageUrls?: string[];
  communities?: string[];
  tags?: string[];
  createdAt: string;
};

type UserProfileResponse = {
  joinedCommunities?: string[];
};

function formatDisplayDate(input: string | Date) {
  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) return String(input);
  return parsed.toLocaleString();
}

export default function HomePage() {
  const router = useRouter();
  const { status } = useSession();
  const { theme } = useTheme();
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [communityName, setCommunityName] = useState("");
  const [communityTags, setCommunityTags] = useState<string[]>([]);
  const [communities, setCommunities] = useState<string[]>([]);
  const [communityTagsByName, setCommunityTagsByName] = useState<Record<string, string[]>>({});
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [joinedCommunities, setJoinedCommunities] = useState<string[]>([]);
  const [communitySearch, setCommunitySearch] = useState("");
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(true);
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(true);
  const [isMobileLeftModalOpen, setIsMobileLeftModalOpen] = useState(false);
  const [isMobileRightModalOpen, setIsMobileRightModalOpen] = useState(false);
  const [isHydrating, setIsHydrating] = useState(true);
  const [toast, setToast] = useState<{ open: boolean; message: string; tone: AppToastTone }>({
    open: false,
    message: "",
    tone: "info",
  });
  const discoverListRef = useRef<HTMLDivElement | null>(null);
  const feedListRef = useRef<HTMLDivElement | null>(null);

  const showToast = (message: string, tone: AppToastTone = "info") => {
    setToast({ open: true, message, tone });
  };

  const persistJoinedCommunities = async (nextJoined: string[]) => {
    return updateJoinedCommunitiesWithConflictRetry({
      nextJoinedCommunities: nextJoined,
      retries: 1,
      mergeOnConflict: (latest, intended) => [...latest, ...intended],
    });
  };

  const { buttonColor, toggle: toggleColors, accent: accentClasses } = getThemeColorTokens(theme);
  const communityDisabled = communityName.trim().length < 3;
  const normalizedCommunityName = communityName.trim().toLowerCase();

  const postCountLabel = useMemo(() => {
    return posts.length === 1 ? "1 authored" : `${posts.length} authored`;
  }, [posts.length]);

  const availableCommunities = useMemo(() => {
    const combined = [...communities, ...joinedCommunities];
    return [...new Set(combined.map((item) => item.trim()).filter(Boolean))];
  }, [communities, joinedCommunities]);

  const joinedCommunitiesSet = useMemo(
    () => new Set(joinedCommunities),
    [joinedCommunities],
  );

  const activeFeedCommunities = useMemo(() => joinedCommunities, [joinedCommunities]);

  const filteredPosts = useMemo(() => {
    if (activeFeedCommunities.length === 0) {
      return posts;
    }

    const activeSet = new Set(activeFeedCommunities);

    return posts.filter(
      (post) =>
        Array.isArray(post.communities) &&
        post.communities.some((community) =>
          activeSet.has(community),
        ),
    );
  }, [posts, activeFeedCommunities]);

  const displayFeedPosts = useMemo(() => filteredPosts, [filteredPosts]);

  const filteredPostCountLabel = useMemo(() => {
    return `${filteredPosts.length.toLocaleString()} posts in feed`;
  }, [filteredPosts.length]);

  const deferredCommunitySearch = useDeferredValue(communitySearch);
  const normalizedCommunitySearch = useMemo(() => {
    return deferredCommunitySearch.trim().toLowerCase();
  }, [deferredCommunitySearch]);

  const filteredAvailableCommunities = useMemo(() => {
    if (!normalizedCommunitySearch) {
      return availableCommunities;
    }
    return availableCommunities.filter((item) =>
      item.toLowerCase().includes(normalizedCommunitySearch),
    );
  }, [availableCommunities, normalizedCommunitySearch]);

  const discoverVirtualizer = useVirtualizer({
    count: filteredAvailableCommunities.length,
    getScrollElement: () => discoverListRef.current,
    estimateSize: () => 56,
    overscan: 10,
    getItemKey: (index) => filteredAvailableCommunities[index] ?? `community-${index}`,
  });

  const feedVirtualizer = useVirtualizer({
    count: displayFeedPosts.length,
    getScrollElement: () => feedListRef.current,
    estimateSize: () => 320,
    overscan: 10,
    getItemKey: (index) => String(displayFeedPosts[index]?.id ?? `post-${index}`),
  });

  useEffect(() => {
    discoverVirtualizer.scrollToOffset(0);
  }, [normalizedCommunitySearch, discoverVirtualizer]);

  useEffect(() => {
    feedVirtualizer.scrollToOffset(0);
  }, [joinedCommunities.length, feedVirtualizer]);

  useEffect(() => {
    const shouldLockBodyScroll = isMobileLeftModalOpen || isMobileRightModalOpen;
    if (!shouldLockBodyScroll) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isMobileLeftModalOpen, isMobileRightModalOpen]);

  useEffect(() => {
    if (status === "loading") {
      return;
    }

    if (status === "unauthenticated" && !isAuthenticated()) {
      router.replace("/");
      return;
    }

    let isMounted = true;

    const hydrateFromApi = async () => {
      try {
        const [postsRes, communitiesRes, tagsRes, profileRes] = await Promise.all([
          fetch("/api/posts", { cache: "no-store" }),
          fetch("/api/communities", { cache: "no-store" }),
          fetch("/api/tags", { cache: "no-store" }),
          fetch("/api/user-profile", { cache: "no-store" }),
        ]);

        if (!isMounted) {
          return;
        }

        if (postsRes.ok) {
          const parsedPosts = (await postsRes.json()) as Array<{
            id: string;
            title: string;
            content: string;
            imageUrls?: string[];
            communities?: string[];
            tags?: string[];
            createdAt: string;
          }>;

          setPosts(
            Array.isArray(parsedPosts)
              ? parsedPosts.map((post) => ({
                  id: post.id,
                  title: post.title,
                  content: post.content,
                  imageUrls: Array.isArray(post.imageUrls) ? post.imageUrls : [],
                  communities: post.communities,
                  tags: post.tags,
                  createdAt: formatDisplayDate(post.createdAt),
                }))
              : [],
          );
        }

        if (communitiesRes.ok) {
          const parsedCommunities = (await communitiesRes.json()) as Array<{
            name: string;
            tags?: string[];
          }>;

          const nextTagsByName: Record<string, string[]> = {};
          if (Array.isArray(parsedCommunities)) {
            for (const community of parsedCommunities) {
              const normalizedName = community.name.trim().toLowerCase();
              nextTagsByName[normalizedName] = dedupeTagNames(
                Array.isArray(community.tags) ? community.tags : [],
              );
            }
          }

          setCommunityTagsByName(nextTagsByName);

          setCommunities(
            Array.isArray(parsedCommunities)
              ? parsedCommunities.map((item) => item.name)
              : [],
          );
        }

        if (profileRes.ok) {
          const profile = (await profileRes.json()) as UserProfileResponse;
          setJoinedCommunities(
            Array.isArray(profile.joinedCommunities)
              ? profile.joinedCommunities
              : [],
          );
        }

        if (tagsRes.ok) {
          const parsedTags = (await tagsRes.json()) as Array<{ name?: string }>;
          setAvailableTags(
            dedupeTagNames(
              Array.isArray(parsedTags)
                ? parsedTags
                    .map((item) => item.name?.trim() ?? "")
                    .filter(Boolean)
                : [],
            ),
          );
        }
      } catch {
        if (!isMounted) {
          return;
        }

        setPosts([]);
        setCommunities([]);
        setCommunityTagsByName({});
        setAvailableTags([]);
        setJoinedCommunities([]);
      } finally {
        if (!isMounted) {
          return;
        }

        setIsHydrating(false);
      }
    };

    const hydrateUiPrefs = () => {
      const savedUiPrefs = window.localStorage.getItem(HOME_UI_PREFS_KEY);
      if (savedUiPrefs) {
        try {
          const parsedUiPrefs = JSON.parse(savedUiPrefs);
          if (typeof parsedUiPrefs.left === "boolean") {
            setIsLeftSidebarOpen(parsedUiPrefs.left);
          }
          if (typeof parsedUiPrefs.right === "boolean") {
            setIsRightSidebarOpen(parsedUiPrefs.right);
          }
        } catch {
          setIsLeftSidebarOpen(true);
          setIsRightSidebarOpen(true);
        }
      }
    };

    hydrateUiPrefs();

    void hydrateFromApi();

    return () => {
      isMounted = false;
    };
  }, [router, status]);

  useEffect(() => {
    window.localStorage.setItem(
      HOME_UI_PREFS_KEY,
      JSON.stringify({
        left: isLeftSidebarOpen,
        right: isRightSidebarOpen,
      }),
    );
  }, [isLeftSidebarOpen, isRightSidebarOpen]);

  const handleCreateCommunity = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (communityDisabled) return;

    const nextName = normalizedCommunityName;
    const exists = communities.some(
      (item) => item.toLowerCase() === nextName.toLowerCase(),
    );

    if (exists) {
      setCommunityName("");
      return;
    }

    const response = await fetch("/api/communities", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: nextName }),
    });

    if (!response.ok) {
      return;
    }

    const created = (await response.json()) as {
      id: string;
      name: string;
      moderationStatus?: string;
      createdAt: string;
      updatedAt: string;
      createdBy?: string;
      lastUpdatedBy?: string;
    };

    const tagAttach = await attachTagsToTarget({
      targetType: "Community",
      targetId: created.id,
      tags: communityTags,
    });

    if (tagAttach.didRetry) {
      showToast("Community tags were retried after a concurrent change.", "warning");
    }

    if (created.moderationStatus === "pending") {
      setCommunityName("");
      setCommunityTags([]);
      showToast("Community submitted for admin approval.", "info");
      return;
    }

    const nextCommunities = [...communities, nextName.toLowerCase()];
    setCommunities(nextCommunities);
    setCommunityTagsByName((prev) => ({
      ...prev,
      [nextName.toLowerCase()]: dedupeTagNames(communityTags),
    }));
    setAvailableTags((prev) => dedupeTagNames([...prev, ...communityTags]));

    const alreadyJoined = joinedCommunities.some(
      (item) => item.toLowerCase() === nextName.toLowerCase(),
    );
    if (!alreadyJoined) {
      const nextJoined = [...joinedCommunities, nextName];
      setJoinedCommunities(nextJoined);
      const joinResult = await persistJoinedCommunities(nextJoined);
      if (!joinResult.response.ok) {
        showToast("Community created, but auto-join failed. Retry joining.", "warning");
      } else if (joinResult.didRetry) {
        showToast("Community join saved after resolving a concurrent update.", "success");
      }
    }

    setCommunityName("");
    setCommunityTags([]);
  };

  const handleToggleJoinCommunity = async (name: string) => {
    const normalizedName = name.toLowerCase();
    const isJoined = joinedCommunitiesSet.has(normalizedName);
    if (isJoined) {
      return;
    }

    const nextJoined = [...joinedCommunities, normalizedName];

    setJoinedCommunities(nextJoined);
    const result = await persistJoinedCommunities(nextJoined);

    if (!result.response.ok) {
      showToast("Failed to join community. Please retry.", "error");
      return;
    }

    if (result.didRetry) {
      showToast("Join saved after resolving a concurrent update.", "success");
    }
  };

  const leftSidebarContent = (
    <>
      <Card className={`border shadow-none dark:bg-slate-900 ${accentClasses.sectionBorder}`}>
        <CardBody className="space-y-4 p-5">
          <Typography variant="h6" className={accentClasses.heading}>
            Find Communities
          </Typography>
          <Typography variant="small" className="text-slate-700 dark:text-slate-300">
            Customize panel visibility from the Profile menu in the top-right.
          </Typography>
          <Input
            variant="standard"
            label="Search communities"
            value={communitySearch}
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              setCommunitySearch(event.target.value)
            }
            color={buttonColor}
          />
        </CardBody>
      </Card>

      <Card className={`border shadow-none dark:bg-slate-900 ${accentClasses.sectionBorder}`}>
        <CardBody className="space-y-4 p-5">
          <Typography variant="h5" className={`inline-flex items-center gap-2 ${accentClasses.heading}`}>
            <HiUserPlus className="h-5 w-5" />
            Join Communities
          </Typography>

          <Typography variant="small" className="text-slate-700 dark:text-slate-300">
            Join one or more communities. Unlimited communities supported.
          </Typography>

          {filteredAvailableCommunities.length === 0 ? (
            <Typography variant="small" className="text-slate-700 dark:text-slate-300">
              No communities match your search.
            </Typography>
          ) : (
            <div
              ref={discoverListRef}
              className="max-h-96 overflow-y-auto overscroll-contain pr-1"
              style={{ WebkitOverflowScrolling: "touch" }}
            >
              <div
                className="relative"
                style={{ height: `${discoverVirtualizer.getTotalSize()}px` }}
              >
                {discoverVirtualizer.getVirtualItems().map((virtualItem) => {
                  const item = filteredAvailableCommunities[virtualItem.index];
                  if (!item) return null;
                  const isJoined = joinedCommunitiesSet.has(item);
                  const itemTags = communityTagsByName[item] ?? [];

                  return (
                    <div
                      key={item}
                      data-index={virtualItem.index}
                      ref={discoverVirtualizer.measureElement}
                      className="absolute left-0 top-0 w-full pb-2"
                      style={{ transform: `translateY(${virtualItem.start}px)` }}
                    >
                      <div className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/60">
                        <div className="min-w-0">
                          <span className="text-sm text-slate-700 dark:text-slate-200">{item}</span>
                          {itemTags.length > 0 ? (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {itemTags.slice(0, 3).map((tag) => (
                                <span
                                  key={`${item}-tag-${tag}`}
                                  className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${accentClasses.softBadge}`}
                                >
                                  #{tag}
                                </span>
                              ))}
                            </div>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/pages/community/${encodeURIComponent(item)}`}
                            className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium ${accentClasses.link}`}
                          >
                            Open
                            <HiArrowTopRightOnSquare className="h-4 w-4" />
                          </Link>
                          <Button
                            size="sm"
                            color={isJoined ? "blue-gray" : buttonColor}
                            variant={isJoined ? "outlined" : "filled"}
                            onClick={() => handleToggleJoinCommunity(item)}
                            disabled={isJoined}
                            className="rounded-lg"
                          >
                            {isJoined ? "Joined" : "Join"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardBody>
      </Card>
    </>
  );

  const rightSidebarContent = (
    <>
      <Card className={`border shadow-none dark:bg-slate-900 ${accentClasses.sectionBorder}`}>
        <CardBody className="space-y-4 p-5">
          <Typography variant="h5" className={accentClasses.heading}>
            Create
          </Typography>
          <Typography variant="small" className="text-slate-700 dark:text-slate-300">
            Home supports community creation. Use the dedicated post creator page to publish posts.
          </Typography>
          <Link href="/pages/post/create" className="inline-flex w-full items-center justify-center gap-2">
            <Button color={buttonColor} className="w-full rounded-lg">
              Go To Post Creator
            </Button>
          </Link>
        </CardBody>
      </Card>

      <Card className={`border shadow-none dark:bg-slate-900 ${accentClasses.sectionBorder}`}>
        <CardBody className="space-y-4 p-5">
          <Typography variant="h5" className={`inline-flex items-center gap-2 ${accentClasses.heading}`}>
            <HiFolderPlus className="h-5 w-5" />
            Create Community
          </Typography>

          <form className="flex flex-col gap-3" onSubmit={handleCreateCommunity}>
            <Input
                        variant="standard"

              label="Community name"
              value={communityName}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                setCommunityName(event.target.value)
              }
              crossOrigin={undefined}
              color={buttonColor}
            />
            <TagsPicker
              label="Community tags"
              value={communityTags}
              onChange={setCommunityTags}
              suggestedTags={availableTags}
              disabled={communityDisabled}
              color={buttonColor}
              helperText="Optional. Helps people discover this community."
            />
            <Button color={buttonColor} type="submit" disabled={communityDisabled}>
              Add Community
            </Button>
          </form>

          {communities.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {communities.map((item) => (
                <span
                  key={item}
                  className="rounded-full border border-slate-300 bg-slate-50 px-3 py-1 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  {item}
                </span>
              ))}
            </div>
          ) : (
            <Typography variant="small" className="text-slate-700 dark:text-slate-300">
              No custom communities yet.
            </Typography>
          )}
        </CardBody>
      </Card>
    </>
  );

  if (status === "loading" || isHydrating) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        <div className="inline-flex items-center gap-3">
          <Spinner className="h-5 w-5" />
          <Typography>Loading home feed...</Typography>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <AppNavbar
        centerContent={(
          <>
            <Chip value={postCountLabel} variant="ghost" color={buttonColor} className="rounded-full" />
            <Chip
              value={`${joinedCommunities.length} joined`}
              variant="ghost"
              color={buttonColor}
              className="rounded-full"
            />
          </>
        )}
        profileMenuContent={(
          <div className="space-y-2 px-1 py-1">
            <Typography variant="small" className="px-2 text-xs font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">
              Layout Panels
            </Typography>

            <div className="grid min-h-9 grid-cols-[1fr_auto] items-center gap-3 rounded-lg border border-slate-200 px-2.5 py-2 dark:border-slate-700 dark:bg-slate-800/60">
              <Typography variant="small" className="leading-none text-slate-700 dark:text-slate-300">
                Community Finder
              </Typography>
              <button
                type="button"
                role="switch"
                aria-checked={isLeftSidebarOpen}
                onClick={() => setIsLeftSidebarOpen((prev) => !prev)}
                title={isLeftSidebarOpen ? "Hide Community Finder" : "Show Community Finder"}
                aria-label={isLeftSidebarOpen ? "Hide Community Finder" : "Show Community Finder"}
                className={`relative inline-flex h-6 w-11 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 ${toggleColors.ring} ${
                  isLeftSidebarOpen ? toggleColors.on : "bg-slate-300 dark:bg-slate-700"
                }`}
              >
                <span
                  className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                    isLeftSidebarOpen ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            <div className="grid min-h-9 grid-cols-[1fr_auto] items-center gap-3 rounded-lg border border-slate-200 px-2.5 py-2 dark:border-slate-700 dark:bg-slate-800/60">
              <Typography variant="small" className="leading-none text-slate-700 dark:text-slate-300">
                Create Panel
              </Typography>
              <button
                type="button"
                role="switch"
                aria-checked={isRightSidebarOpen}
                onClick={() => setIsRightSidebarOpen((prev) => !prev)}
                title={isRightSidebarOpen ? "Hide Create Panel" : "Show Create Panel"}
                aria-label={isRightSidebarOpen ? "Hide Create Panel" : "Show Create Panel"}
                className={`relative inline-flex h-6 w-11 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 ${toggleColors.ring} ${
                  isRightSidebarOpen ? toggleColors.on : "bg-slate-300 dark:bg-slate-700"
                }`}
              >
                <span
                  className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                    isRightSidebarOpen ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          </div>
        )}
      />

      <div className="mx-auto w-full max-w-none px-6 py-8 sm:px-10 lg:px-16">
        <div className="mb-4 flex gap-2 lg:hidden">
          {isLeftSidebarOpen ? (
            <Button
              size="sm"
              variant="outlined"
              color={buttonColor}
              className="rounded-lg"
              onClick={() => setIsMobileLeftModalOpen(true)}
            >
              Open Community Finder
            </Button>
          ) : null}

          {isRightSidebarOpen ? (
            <Button
              size="sm"
              color={buttonColor}
              className="rounded-lg"
              onClick={() => setIsMobileRightModalOpen(true)}
            >
              Open Create Panel
            </Button>
          ) : null}
        </div>

        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          {isLeftSidebarOpen ? (
            <aside className="hidden space-y-4 lg:block lg:w-80 lg:shrink-0">
              {leftSidebarContent}
            </aside>
          ) : null}

          <section className="min-w-0 flex-1">
            <Card className={`rounded-3xl border bg-white shadow-xl dark:bg-slate-900 ${accentClasses.sectionBorder}`}>
              <CardBody className="flex flex-col gap-6 p-8 sm:p-10">
                <div className="space-y-4">
                  <Card className={`border shadow-none dark:bg-slate-900 ${accentClasses.sectionBorder}`}>
                    <CardBody className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <Typography variant="h5" className={accentClasses.heading}>
                          Feed
                        </Typography>
                        <Typography variant="small" className="text-slate-700 dark:text-slate-300">
                          {filteredPostCountLabel}
                        </Typography>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <Chip
                          value="Joined communities"
                          size="sm"
                          variant="ghost"
                          color={buttonColor}
                          className="rounded-full"
                        />
                      </div>
                    </CardBody>
                  </Card>

                  {displayFeedPosts.length === 0 ? (
                    <Card className="border border-dashed border-slate-300 shadow-none dark:border-slate-700 dark:bg-slate-900">
                      <CardBody className="space-y-3">
                        <Typography variant="h6" className={`inline-flex items-center gap-2 ${accentClasses.heading}`}>
                          <HiPencilSquare className="h-5 w-5" />
                          No posts in this feed
                        </Typography>
                        <Typography className="text-slate-700 dark:text-slate-200">
                          Join communities from the left panel to get feeds.
                        </Typography>
                      </CardBody>
                    </Card>
                  ) : (
                    <div
                      ref={feedListRef}
                      className="max-h-[72vh] overflow-y-auto overscroll-contain pr-1"
                      style={{ WebkitOverflowScrolling: "touch" }}
                    >
                      <div
                        className="relative"
                        style={{ height: `${feedVirtualizer.getTotalSize()}px` }}
                      >
                        {feedVirtualizer.getVirtualItems().map((virtualItem) => {
                          const post = displayFeedPosts[virtualItem.index];
                          if (!post) return null;

                          return (
                            <div
                              key={post.id}
                              data-index={virtualItem.index}
                              ref={feedVirtualizer.measureElement}
                              className="absolute left-0 top-0 w-full pb-4"
                              style={{ transform: `translateY(${virtualItem.start}px)` }}
                            >
                              <Card className={`border shadow-none dark:bg-slate-900 ${accentClasses.sectionBorder}`}>
                                <CardBody className="space-y-4">
                                  <div className="flex items-start justify-between gap-3">
                                    <Typography variant="h6" className={accentClasses.heading}>
                                      {post.title}
                                    </Typography>
                                    <Typography variant="small" className="shrink-0 text-slate-700 dark:text-slate-300">
                                      {post.createdAt}
                                    </Typography>
                                  </div>

                                  {Array.isArray(post.communities) && post.communities.length > 0 ? (
                                    <div className="flex flex-wrap gap-2">
                                      {post.communities.map((community) => (
                                        <Link
                                          key={`${post.id}-${community}`}
                                          href={`/pages/community/${encodeURIComponent(community)}`}
                                        >
                                          <Chip
                                            value={community}
                                            size="sm"
                                            variant="outlined"
                                            color={buttonColor}
                                            className="rounded-full"
                                          />
                                        </Link>
                                      ))}
                                    </div>
                                  ) : null}

                                  {Array.isArray(post.tags) && post.tags.length > 0 ? (
                                    <div className="flex flex-wrap gap-2">
                                      {post.tags.map((tag) => (
                                        <Chip
                                          key={`${post.id}-tag-${tag}`}
                                          value={`#${tag}`}
                                          size="sm"
                                          variant="ghost"
                                          color={buttonColor}
                                          className="rounded-full"
                                        />
                                      ))}
                                    </div>
                                  ) : null}

                                  <Typography className="leading-7 text-slate-800 dark:text-slate-200">
                                    {post.content}
                                  </Typography>

                                  <PostImageCarousel
                                    imageUrls={Array.isArray(post.imageUrls) ? post.imageUrls : []}
                                    title={post.title}
                                    heightClassName="h-48 sm:h-56"
                                  />

                                  <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 pt-3 dark:border-slate-700">
                                    <Link href={`/pages/post/${encodeURIComponent(String(post.id))}`}>
                                      <Button size="sm" variant="outlined" color={buttonColor} className="rounded-lg">
                                        Open post
                                      </Button>
                                    </Link>
                                    <Button size="sm" variant="text" color={buttonColor} className="rounded-lg">
                                      Upvote
                                    </Button>
                                    <Button size="sm" variant="text" color={buttonColor} className="rounded-lg">
                                      Comment
                                    </Button>
                                    <Button size="sm" variant="text" color={buttonColor} className="rounded-lg">
                                      Share
                                    </Button>
                                    <Typography variant="small" className="ml-auto inline-flex items-center gap-1 text-slate-700 dark:text-slate-300">
                                      <HiCheckCircle className="h-4 w-4" />
                                      Posted in {Array.isArray(post.communities) ? post.communities.length : 0} communities
                                    </Typography>
                                  </div>
                                </CardBody>
                              </Card>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </CardBody>
            </Card>
          </section>

          {isRightSidebarOpen ? (
            <aside className="hidden space-y-4 lg:block lg:w-80 lg:shrink-0">
              {rightSidebarContent}
            </aside>
          ) : null}
        </div>
      </div>

      {isLeftSidebarOpen && isMobileLeftModalOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-slate-900/50"
            onClick={() => setIsMobileLeftModalOpen(false)}
          />

          <div className="absolute inset-x-4 bottom-4 top-20 overflow-y-auto rounded-2xl bg-slate-50 p-4 shadow-2xl dark:bg-slate-900">
            <div className="mb-4 flex items-center justify-between">
              <Typography variant="h6" className={accentClasses.heading}>
                Community Finder
              </Typography>
              <Button
                size="sm"
                variant="text"
                color="blue-gray"
                className="rounded-lg"
                onClick={() => setIsMobileLeftModalOpen(false)}
              >
                Close
              </Button>
            </div>
            <div className="space-y-4">{leftSidebarContent}</div>
          </div>
        </div>
      ) : null}

      {isRightSidebarOpen && isMobileRightModalOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-slate-900/50"
            onClick={() => setIsMobileRightModalOpen(false)}
          />

          <div className="absolute inset-x-4 bottom-4 top-20 overflow-y-auto rounded-2xl bg-slate-50 p-4 shadow-2xl dark:bg-slate-900">
            <div className="mb-4 flex items-center justify-between">
              <Typography variant="h6" className={accentClasses.heading}>
                Create
              </Typography>
              <Button
                size="sm"
                variant="text"
                color="blue-gray"
                className="rounded-lg"
                onClick={() => setIsMobileRightModalOpen(false)}
              >
                Close
              </Button>
            </div>
            <div className="space-y-4">{rightSidebarContent}</div>
          </div>
        </div>
      ) : null}
      <AppToast
        open={toast.open}
        message={toast.message}
        tone={toast.tone}
        onClose={() => setToast((prev) => ({ ...prev, open: false }))}
      />
    </main>
  );
}

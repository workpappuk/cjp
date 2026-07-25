"use client";

import type { ChangeEvent, FormEvent } from "react";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Card, CardBody, Chip, IconButton, Input, Typography } from "../../_components/mtw";
import {
  HiArrowTopRightOnSquare,
  HiBars3,
  HiCheckCircle,
  HiFolderPlus,
  HiPencilSquare,
  HiXMark,
  HiUserPlus,
} from "react-icons/hi2";
import { useTheme } from "../../_context/theme-context";
import AppNavbar from "../../_components/AppNavbar";
import PostComposer from "../../_components/PostComposer";

const AUTH_KEY = "threadforge-auth";
const POSTS_KEY = "threadforge-posts";
const COMMUNITIES_KEY = "threadforge-communities";
const JOINED_COMMUNITIES_KEY = "threadforge-joined-communities";
const HOME_UI_PREFS_KEY = "threadforge-home-ui-prefs";
const COMMUNITY_POST_COUNTS_KEY = "threadforge-community-post-counts";
const SEED_VERSION_KEY = "threadforge-seed-version";
const SEED_VERSION = "v1-500x1000";
const SEED_COMMUNITY_COUNT = 500;
const SEED_USER_POST_COUNT = 500;
const SEED_POSTS_PER_COMMUNITY = 1000;
const SYNTHETIC_RENDER_LIMIT = 220;
const COMMUNITY_PAGE_SIZE = 100;
const INITIAL_FEED_VISIBLE = 40;
const FEED_LOAD_STEP = 40;
const DISCOVER_COMMUNITIES = [
  "technology",
  "design",
  "startups",
  "gaming",
  "books",
  "science",
  "sports",
  "movies",
  "music",
  "travel",
];

type PostItem = {
  id: string | number;
  title: string;
  content: string;
  communities?: string[];
  createdAt: string;
  synthetic?: boolean;
};

function readJSONFromStorage<T>(key: string, fallbackValue: T): T {
  const raw = window.localStorage.getItem(key);
  if (!raw) return fallbackValue;

  try {
    const parsed = JSON.parse(raw);
    return parsed ?? fallbackValue;
  } catch {
    return fallbackValue;
  }
}

function writeJSONToStorage(key: string, value: unknown): void {
  window.localStorage.setItem(key, JSON.stringify(value));
}

export default function HomePage() {
  const router = useRouter();
  const { theme } = useTheme();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [communityName, setCommunityName] = useState("");
  const [communities, setCommunities] = useState<string[]>([]);
  const [joinedCommunities, setJoinedCommunities] = useState<string[]>([]);
  const [communityPostCounts, setCommunityPostCounts] = useState<Record<string, number>>({});
  const [communitySearch, setCommunitySearch] = useState("");
  const [discoverVisibleCount, setDiscoverVisibleCount] = useState(
    COMMUNITY_PAGE_SIZE,
  );
  const [feedVisibleCount, setFeedVisibleCount] = useState(INITIAL_FEED_VISIBLE);
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(true);
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(true);
  const [activeComposer, setActiveComposer] = useState<"post" | "community">("post");

  const buttonColors = {
    orange: "orange",
    emerald: "green",
    sky: "blue",
  };

  const buttonColor = buttonColors[theme] ?? "orange";
  const disabled =
    title.trim().length === 0 ||
    content.trim().length === 0;

  const communityDisabled = communityName.trim().length < 3;

  const postCountLabel = useMemo(() => {
    return posts.length === 1 ? "1 authored" : `${posts.length} authored`;
  }, [posts.length]);

  const availableCommunities = useMemo(() => {
    const combined = [...DISCOVER_COMMUNITIES, ...communities];
    return [...new Set(combined.map((item) => item.trim()).filter(Boolean))];
  }, [communities]);

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

  const syntheticFeedTotal = useMemo(() => {
    if (activeFeedCommunities.length === 0) {
      return 0;
    }

    return activeFeedCommunities.reduce((sum, community) => {
      return sum + (communityPostCounts[community] ?? 0);
    }, 0);
  }, [activeFeedCommunities, communityPostCounts]);

  const syntheticFeedSamples = useMemo(() => {
    if (activeFeedCommunities.length === 0) {
      return [];
    }

    const samples = [];
    for (let i = 0; i < SYNTHETIC_RENDER_LIMIT; i += 1) {
      const community =
        activeFeedCommunities[i % activeFeedCommunities.length] ??
        activeFeedCommunities[0];
      const rank = Math.floor(i / activeFeedCommunities.length) + 1;

      samples.push({
        id: `synthetic-${community}-${rank}`,
        title: `Trending in ${community} #${rank}`,
        content:
          "Community highlight: this is a seeded high-volume post preview for consumer feed simulation.",
        communities: [community],
        createdAt: `${rank}m ago`,
        synthetic: true,
      });
    }

    return samples;
  }, [activeFeedCommunities]);

  const displayFeedPosts = useMemo(() => {
    return [...filteredPosts, ...syntheticFeedSamples].slice(
      0,
      SYNTHETIC_RENDER_LIMIT,
    );
  }, [filteredPosts, syntheticFeedSamples]);

  const visibleFeedPosts = useMemo(() => {
    return displayFeedPosts.slice(0, feedVisibleCount);
  }, [displayFeedPosts, feedVisibleCount]);

  const filteredPostCountLabel = useMemo(() => {
    const totalCount = syntheticFeedTotal + filteredPosts.length;
    return `${totalCount.toLocaleString()} posts in feed`;
  }, [syntheticFeedTotal, filteredPosts.length]);

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

  const visibleDiscoverCommunities = useMemo(() => {
    return filteredAvailableCommunities.slice(0, discoverVisibleCount);
  }, [filteredAvailableCommunities, discoverVisibleCount]);

  useEffect(() => {
    setDiscoverVisibleCount(COMMUNITY_PAGE_SIZE);
  }, [normalizedCommunitySearch]);

  useEffect(() => {
    setFeedVisibleCount(INITIAL_FEED_VISIBLE);
  }, [joinedCommunities.length]);

  useEffect(() => {
    if (window.localStorage.getItem(AUTH_KEY) !== "google") {
      router.replace("/");
      return;
    }

    if (window.localStorage.getItem(SEED_VERSION_KEY) !== SEED_VERSION) {
      const seededCommunities = Array.from(
        { length: SEED_COMMUNITY_COUNT },
        (_, index) => `community-${String(index + 1).padStart(3, "0")}`,
      );

      const seededPosts = Array.from(
        { length: SEED_USER_POST_COUNT },
        (_, index) => {
          const community = seededCommunities[index % seededCommunities.length];
          return {
            id: Date.now() + index,
            title: `Seeded Post ${index + 1}`,
            content: `This seeded post belongs to ${community} and helps simulate a regular consumer feed view.`,
            communities: [community],
            createdAt: new Date(
              Date.now() - index * 60 * 1000,
            ).toLocaleString(),
          };
        },
      );

      const seededCommunityPostCounts = seededCommunities.reduce<Record<string, number>>(
        (accumulator, community) => {
          accumulator[community] = SEED_POSTS_PER_COMMUNITY;
          return accumulator;
        },
        {},
      );

      writeJSONToStorage(COMMUNITIES_KEY, seededCommunities);
      writeJSONToStorage(JOINED_COMMUNITIES_KEY, seededCommunities);
      writeJSONToStorage(POSTS_KEY, seededPosts);
      writeJSONToStorage(COMMUNITY_POST_COUNTS_KEY, seededCommunityPostCounts);
      window.localStorage.setItem(SEED_VERSION_KEY, SEED_VERSION);
    }

    const parsedPosts = readJSONFromStorage(POSTS_KEY, []);
    const parsedCommunities = readJSONFromStorage(COMMUNITIES_KEY, []);
    const parsedJoined = readJSONFromStorage(JOINED_COMMUNITIES_KEY, []);
    const parsedCommunityPostCounts = readJSONFromStorage<Record<string, number>>(
      COMMUNITY_POST_COUNTS_KEY,
      {},
    );

    setPosts(Array.isArray(parsedPosts) ? parsedPosts : []);
    setCommunities(Array.isArray(parsedCommunities) ? parsedCommunities : []);
    setJoinedCommunities(Array.isArray(parsedJoined) ? parsedJoined : []);
    setCommunityPostCounts(parsedCommunityPostCounts);

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
        if (
          parsedUiPrefs.activeComposer === "post" ||
          parsedUiPrefs.activeComposer === "community"
        ) {
          setActiveComposer(parsedUiPrefs.activeComposer);
        }
      } catch {
        setIsLeftSidebarOpen(true);
        setIsRightSidebarOpen(true);
        setActiveComposer("post");
      }
    }
  }, [router]);

  useEffect(() => {
    window.localStorage.setItem(
      HOME_UI_PREFS_KEY,
      JSON.stringify({
        left: isLeftSidebarOpen,
        right: isRightSidebarOpen,
        activeComposer,
      }),
    );
  }, [isLeftSidebarOpen, isRightSidebarOpen, activeComposer]);

  const handleCreateCommunity = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (communityDisabled) return;

    const nextName = communityName.trim();
    const exists = communities.some(
      (item) => item.toLowerCase() === nextName.toLowerCase(),
    );

    if (exists) {
      setCommunityName("");
      return;
    }

    const nextCommunities = [...communities, nextName];
    setCommunities(nextCommunities);
    writeJSONToStorage(COMMUNITIES_KEY, nextCommunities);

    const alreadyJoined = joinedCommunities.some(
      (item) => item.toLowerCase() === nextName.toLowerCase(),
    );
    if (!alreadyJoined) {
      const nextJoined = [...joinedCommunities, nextName];
      setJoinedCommunities(nextJoined);
      writeJSONToStorage(JOINED_COMMUNITIES_KEY, nextJoined);
    }

    setCommunityName("");
  };

  const handleToggleJoinCommunity = (name: string) => {
    const isJoined = joinedCommunitiesSet.has(name);
    const nextJoined = isJoined
      ? joinedCommunities.filter((item) => item !== name)
      : [...joinedCommunities, name];

    setJoinedCommunities(nextJoined);
    writeJSONToStorage(JOINED_COMMUNITIES_KEY, nextJoined);

    if (isJoined) {
      return;
    }
  };

  const handleCreatePost = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (disabled) return;

    const newPost = {
      id: Date.now(),
      title: title.trim(),
      content: content.trim(),
      communities:
        joinedCommunities.length > 0
          ? [joinedCommunities[0]]
          : [],
      createdAt: new Date().toLocaleString(),
    };

    const nextPosts = [newPost, ...posts];
    setPosts(nextPosts);
    writeJSONToStorage(POSTS_KEY, nextPosts);
    setTitle("");
    setContent("");
  };

  return (
    <main className="min-h-screen bg-slate-50">
      <AppNavbar
        centerContent={(
          <>
            <Chip value={postCountLabel} variant="ghost" color="blue-gray" className="rounded-full" />
            <Chip
              value={`${joinedCommunities.length} joined`}
              variant="ghost"
              color="blue-gray"
              className="rounded-full"
            />
          </>
        )}
        rightContent={(
          <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1">
            <IconButton
              variant={isLeftSidebarOpen ? "filled" : "text"}
              color={buttonColor}
              size="sm"
              className="rounded-lg"
              onClick={() => setIsLeftSidebarOpen((prev) => !prev)}
              title={isLeftSidebarOpen ? "Hide left sidebar" : "Show left sidebar"}
              aria-label={isLeftSidebarOpen ? "Hide left sidebar" : "Show left sidebar"}
            >
              {isLeftSidebarOpen ? <HiXMark aria-hidden="true" /> : <HiBars3 aria-hidden="true" />}
            </IconButton>
            <IconButton
              variant={isRightSidebarOpen ? "filled" : "text"}
              color={buttonColor}
              size="sm"
              className="rounded-lg"
              onClick={() => setIsRightSidebarOpen((prev) => !prev)}
              title={isRightSidebarOpen ? "Hide right sidebar" : "Show right sidebar"}
              aria-label={isRightSidebarOpen ? "Hide right sidebar" : "Show right sidebar"}
            >
              {isRightSidebarOpen ? <HiXMark aria-hidden="true" /> : <HiBars3 aria-hidden="true" />}
            </IconButton>
          </div>
        )}
      />

      <div className="mx-auto w-full max-w-7xl px-6 py-8 sm:px-10 lg:px-16">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          {isLeftSidebarOpen ? (
            <aside className="lg:w-80 lg:shrink-0 space-y-4">
              <Card className="border border-slate-200 shadow-none">
                <CardBody className="space-y-3 p-5">
                  <Typography variant="h6" className="text-blue-gray-900">
                    Find Communities
                  </Typography>
                  <Input
                    label="Search communities"
                    value={communitySearch}
                    onChange={(event: ChangeEvent<HTMLInputElement>) =>
                      setCommunitySearch(event.target.value)
                    }
                    crossOrigin={undefined}
                    color={buttonColor}
                  />
                </CardBody>
              </Card>

              <Card className="border border-slate-200 shadow-none">
                <CardBody className="space-y-4 p-5">
                  <Typography variant="h5" className="inline-flex items-center gap-2 text-blue-gray-900">
                    <HiUserPlus aria-hidden="true" />
                    Join Communities
                  </Typography>

                  <Typography variant="small" className="text-slate-500">
                    Join one or more communities. Unlimited communities supported.
                  </Typography>

                  <div className="grid gap-2">
                    {visibleDiscoverCommunities.map((item) => {
                      const isJoined = joinedCommunitiesSet.has(item);

                      return (
                        <div
                          key={item}
                          className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2"
                        >
                          <span className="text-sm text-slate-700">{item}</span>
                          <div className="flex items-center gap-2">
                            <Link
                              href={`/pages/community/${encodeURIComponent(item)}`}
                              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-blue-gray-700 hover:bg-slate-100"
                            >
                              Open
                              <HiArrowTopRightOnSquare aria-hidden="true" />
                            </Link>
                            <Button
                              size="sm"
                              color={isJoined ? "blue-gray" : buttonColor}
                              variant={isJoined ? "outlined" : "filled"}
                              onClick={() => handleToggleJoinCommunity(item)}
                              className="rounded-lg"
                            >
                              {isJoined ? "Joined" : "Join"}
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                    {discoverVisibleCount < filteredAvailableCommunities.length ? (
                      <Button
                        size="sm"
                        variant="outlined"
                        color={buttonColor}
                        className="rounded-lg"
                        onClick={() =>
                          setDiscoverVisibleCount(
                            (prev) => prev + COMMUNITY_PAGE_SIZE,
                          )
                        }
                      >
                        Load more
                      </Button>
                    ) : null}
                  </div>
                </CardBody>
              </Card>
            </aside>
          ) : null}

          <section className="min-w-0 flex-1">
            <Card className="rounded-3xl border border-slate-200 bg-white shadow-xl">
              <CardBody className="flex flex-col gap-6 p-8 sm:p-10">
                <div className="space-y-4">
                  <Card className="border border-slate-200 shadow-none">
                    <CardBody className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <Typography variant="h5" className="text-blue-gray-900">
                          Feed
                        </Typography>
                        <Typography variant="small" className="text-slate-500">
                          {filteredPostCountLabel}
                        </Typography>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <Chip
                          value="Joined communities"
                          size="sm"
                          variant="ghost"
                          color="blue-gray"
                          className="rounded-full"
                        />
                      </div>
                    </CardBody>
                  </Card>

                  {displayFeedPosts.length === 0 ? (
                    <Card className="border border-dashed border-slate-300 shadow-none">
                      <CardBody className="space-y-3">
                        <Typography variant="h6" className="inline-flex items-center gap-2 text-blue-gray-900">
                          <HiPencilSquare aria-hidden="true" />
                          No posts in this feed
                        </Typography>
                        <Typography className="text-slate-600">
                          Create a post from the right sidebar, or join more communities from the left panel.
                        </Typography>
                      </CardBody>
                    </Card>
                  ) : (
                    visibleFeedPosts.map((post) => (
                      <Card key={post.id} className="border border-slate-200 shadow-none">
                        <CardBody className="space-y-4">
                          <div className="flex items-start justify-between gap-3">
                            <Typography variant="h6" className="text-blue-gray-900">
                              {post.title}
                            </Typography>
                            <Typography variant="small" className="shrink-0 text-slate-500">
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
                                    color="blue-gray"
                                    className="rounded-full"
                                  />
                                </Link>
                              ))}
                            </div>
                          ) : null}

                          <Typography className="leading-7 text-slate-700">
                            {post.content}
                          </Typography>

                          {post.synthetic ? (
                            <Typography variant="small" className="text-slate-500">
                              Seeded feed item for high-volume consumer simulation.
                            </Typography>
                          ) : null}

                          <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 pt-3">
                            <Link href={`/pages/post/${encodeURIComponent(String(post.id))}`}>
                              <Button size="sm" variant="outlined" color="blue-gray" className="rounded-lg">
                                Open post
                              </Button>
                            </Link>
                            <Button size="sm" variant="text" color="blue-gray" className="rounded-lg">
                              Upvote
                            </Button>
                            <Button size="sm" variant="text" color="blue-gray" className="rounded-lg">
                              Comment
                            </Button>
                            <Button size="sm" variant="text" color="blue-gray" className="rounded-lg">
                              Share
                            </Button>
                            <Typography variant="small" className="ml-auto inline-flex items-center gap-1 text-slate-500">
                              <HiCheckCircle aria-hidden="true" />
                              Posted in {Array.isArray(post.communities) ? post.communities.length : 0} communities
                            </Typography>
                          </div>
                        </CardBody>
                      </Card>
                    ))
                  )}

                  {feedVisibleCount < displayFeedPosts.length ? (
                    <div className="flex justify-center pt-2">
                      <Button
                        size="sm"
                        variant="outlined"
                        color="blue-gray"
                        className="rounded-lg"
                        onClick={() =>
                          setFeedVisibleCount((prev) => prev + FEED_LOAD_STEP)
                        }
                      >
                        Load more feed items
                      </Button>
                    </div>
                  ) : null}
                </div>
              </CardBody>
            </Card>
          </section>

          {isRightSidebarOpen ? (
            <aside className="lg:w-80 lg:shrink-0 space-y-4">
              <Card className="border border-slate-200 shadow-none">
                <CardBody className="space-y-3 p-5">
                  <Typography variant="h5" className="text-blue-gray-900">
                    Create
                  </Typography>

                  <div className="flex gap-2">
                    <Button
                      color={buttonColor}
                      variant={activeComposer === "post" ? "filled" : "outlined"}
                      className="flex-1 rounded-lg"
                      onClick={() => setActiveComposer("post")}
                    >
                      Post
                    </Button>
                    <Button
                      color={buttonColor}
                      variant={activeComposer === "community" ? "filled" : "outlined"}
                      className="flex-1 rounded-lg"
                      onClick={() => setActiveComposer("community")}
                    >
                      Community
                    </Button>
                  </div>
                </CardBody>
              </Card>

              {activeComposer === "community" ? (
                <Card className="border border-slate-200 shadow-none">
                  <CardBody className="space-y-4 p-5">
                    <Typography variant="h5" className="inline-flex items-center gap-2 text-blue-gray-900">
                      <HiFolderPlus aria-hidden="true" />
                      Create Community
                    </Typography>

                    <form className="flex flex-col gap-3" onSubmit={handleCreateCommunity}>
                      <Input
                        label="Community name"
                        value={communityName}
                        onChange={(event: ChangeEvent<HTMLInputElement>) =>
                          setCommunityName(event.target.value)
                        }
                        crossOrigin={undefined}
                        color={buttonColor}
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
                            className="rounded-full border border-slate-300 bg-slate-50 px-3 py-1 text-sm text-slate-700"
                          >
                            {item}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <Typography variant="small" className="text-slate-500">
                        No custom communities yet.
                      </Typography>
                    )}
                  </CardBody>
                </Card>
              ) : (
                <Card className="border border-slate-200 shadow-none">
                  <CardBody className="space-y-4 p-5">
                    <PostComposer
                      heading="Create New Post"
                      title={title}
                      content={content}
                      onTitleChange={setTitle}
                      onContentChange={setContent}
                      onSubmit={handleCreatePost}
                      disabled={disabled}
                      buttonLabel="Publish Post"
                      helperText="New posts are published to your first joined community."
                      color={buttonColor}
                    />
                  </CardBody>
                </Card>
              )}
            </aside>
          ) : null}
        </div>
      </div>
    </main>
  );
}

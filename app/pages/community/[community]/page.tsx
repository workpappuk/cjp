"use client";

import type { ChangeEvent, FormEvent } from "react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button, Card, CardBody, Chip, Input, Spinner, Typography } from "@/app/_types/mtw";
import { HiArrowLeft, HiCheckCircle, HiUserPlus } from "react-icons/hi2";
import AppNavbar from "@/app/_components/AppNavbar";
import AppToast, { type AppToastTone } from "@/app/_components/AppToast";
import PostComposer from "@/app/_components/PostComposer";
import TagsPicker from "@/app/_components/TagsPicker";
import { useTheme } from "@/app/_context/theme-context";
import { isAuthenticated } from "@/app/_utils/auth";
import { getThemeColorTokens } from "@/app/_utils/theme-colors";
import { attachTagsToTarget, dedupeTagNames } from "@/app/_utils/tags";
import { updateJoinedCommunitiesWithConflictRetry } from "@/app/_utils/api";

const INITIAL_FEED_RENDER_COUNT = 30;
const FEED_LOAD_STEP = 30;

type PostItem = {
  id: string | number;
  title: string;
  content: string;
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

export default function CommunityPage() {
  const router = useRouter();
  const { status } = useSession();
  const { theme } = useTheme();
  const params = useParams();
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [postTitle, setPostTitle] = useState("");
  const [postContent, setPostContent] = useState("");
  const [postTags, setPostTags] = useState<string[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [communityTags, setCommunityTags] = useState<string[]>([]);
  const [joinedCommunities, setJoinedCommunities] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(INITIAL_FEED_RENDER_COUNT);
  const [isHydrating, setIsHydrating] = useState(true);
  const [toast, setToast] = useState<{ open: boolean; message: string; tone: AppToastTone }>({
    open: false,
    message: "",
    tone: "info",
  });

  const { buttonColor, accent: accentClasses } = getThemeColorTokens(theme);
  const accent = {
    color: buttonColor,
    link: accentClasses.link,
    title: accentClasses.title,
    section: accentClasses.section,
  };

  const showToast = (message: string, tone: AppToastTone = "info") => {
    setToast({ open: true, message, tone });
  };

  const persistJoinedCommunities = async (
    nextJoined: string[],
    mergeOnConflict?: (latest: string[], intended: string[]) => string[],
  ) => {
    return updateJoinedCommunitiesWithConflictRetry({
      nextJoinedCommunities: nextJoined,
      retries: 1,
      mergeOnConflict,
    });
  };

  const communityName = useMemo(() => {
    const raw = Array.isArray(params.community)
      ? params.community[0]
      : params.community;
    return decodeURIComponent(raw || "");
  }, [params.community]);

  const normalizedCommunityName = useMemo(
    () => communityName.trim().toLowerCase(),
    [communityName],
  );

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
        const [postsRes, tagsRes, profileRes, communitiesRes] = await Promise.all([
          fetch(`/api/posts?community=${encodeURIComponent(communityName.toLowerCase())}`, {
            cache: "no-store",
          }),
          fetch("/api/tags", { cache: "no-store" }),
          fetch("/api/user-profile", { cache: "no-store" }),
          fetch("/api/communities", { cache: "no-store" }),
        ]);

        if (!isMounted) {
          return;
        }

        if (postsRes.ok) {
          const parsedPosts = (await postsRes.json()) as Array<{
            id: string;
            title: string;
            content: string;
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

          const matchedCommunity = Array.isArray(parsedCommunities)
            ? parsedCommunities.find(
                (item) => item.name.trim().toLowerCase() === communityName.trim().toLowerCase(),
              )
            : undefined;

          setCommunityTags(
            matchedCommunity?.tags && Array.isArray(matchedCommunity.tags)
              ? dedupeTagNames(matchedCommunity.tags)
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
        setAvailableTags([]);
        setCommunityTags([]);
        setJoinedCommunities([]);
      } finally {
        if (!isMounted) {
          return;
        }

        setIsHydrating(false);
      }
    };

    void hydrateFromApi();

    return () => {
      isMounted = false;
    };
  }, [communityName, router, status]);

  const authoredPosts = useMemo(() => {
    return posts.filter(
      (post) =>
        Array.isArray(post.communities) &&
          post.communities.includes(normalizedCommunityName),
    );
        }, [normalizedCommunityName, posts]);

  const totalCount = authoredPosts.length;
  const isJoined = joinedCommunities.includes(normalizedCommunityName);
  const postComposerDisabled =
    !isJoined || postTitle.trim().length === 0 || postContent.trim().length === 0;

  const feedItems = useMemo(() => {
    return authoredPosts.map((post) => ({
      id: post.id,
      title: post.title,
      content: post.content,
      tags: post.tags,
      createdAt: post.createdAt,
    }));
  }, [authoredPosts]);

  const filteredFeedItems = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    if (!normalizedQuery) {
      return feedItems;
    }

    return feedItems.filter((item) => {
      const haystack = `${item.title} ${item.content}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [feedItems, searchQuery]);

  const visibleFeedItems = useMemo(() => {
    return filteredFeedItems.slice(0, visibleCount);
  }, [filteredFeedItems, visibleCount]);

  const handleCreatePost = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isJoined || postComposerDisabled) return;

    const response = await fetch("/api/posts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: postTitle.trim(),
        content: postContent.trim(),
        communities: [communityName.toLowerCase()],
      }),
    });

    if (!response.ok) {
      return;
    }

    const created = (await response.json()) as {
      id: string;
      title: string;
      content: string;
      communities?: string[];
      tags?: string[];
      moderationStatus?: string;
      createdAt: string;
    };

    const tagAttach = await attachTagsToTarget({
      targetType: "Post",
      targetId: created.id,
      tags: postTags,
    });

    if (tagAttach.didRetry) {
      showToast("Tag update retried after a concurrent change.", "warning");
    }

    if (created.moderationStatus === "pending") {
      setPostTitle("");
      setPostContent("");
      setPostTags([]);
      showToast("Post submitted for admin approval.", "info");
      return;
    }

    const newPost = {
      id: created.id,
      title: created.title,
      content: created.content,
      communities: created.communities,
      tags: dedupeTagNames(postTags.length > 0 ? postTags : created.tags ?? []),
      createdAt: formatDisplayDate(created.createdAt),
    };

    const nextPosts = [newPost, ...posts];
    setPosts(nextPosts);
    setAvailableTags((prev) => dedupeTagNames([...prev, ...postTags]));
    setPostTitle("");
    setPostContent("");
    setPostTags([]);
  };

  const handleJoinCommunity = async () => {
    if (isJoined) return;

    const nextJoined = [...joinedCommunities, normalizedCommunityName];
    setJoinedCommunities(nextJoined);
    const result = await persistJoinedCommunities(nextJoined, (latest, intended) => [
      ...latest,
      ...intended,
      normalizedCommunityName,
    ]);

    if (!result.response.ok) {
      showToast("Failed to join community. Please retry.", "error");
      return;
    }

    if (result.didRetry) {
      showToast("Join saved after resolving a concurrent update.", "success");
    }
  };

  const handleLeaveCommunity = async () => {
    if (!isJoined) return;

    const nextJoined = joinedCommunities.filter((item) => item !== normalizedCommunityName);
    setJoinedCommunities(nextJoined);
    const result = await persistJoinedCommunities(nextJoined, (latest) =>
      latest.filter((item) => item !== normalizedCommunityName),
    );

    if (!result.response.ok) {
      showToast("Failed to leave community. Please retry.", "error");
      return;
    }

    if (result.didRetry) {
      showToast("Leave saved after resolving a concurrent update.", "success");
    }
  };

  if (status === "loading" || isHydrating) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        <div className="inline-flex items-center gap-3">
          <Spinner className="h-5 w-5" />
          <Typography>Loading community feed...</Typography>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <AppNavbar
        subtitle={`Community • ${communityName}`}
        maxWidthClassName="max-w-none"
        centerContent={(
          <>
            <Chip
              value={isJoined ? "Joined" : "Not joined"}
              color={isJoined ? "green" : accent.color}
              variant="ghost"
              className="rounded-full"
              icon={<HiUserPlus className="h-3.5 w-3.5" />}
            />
            <Chip
              value={`${totalCount.toLocaleString()} posts`}
              color={accent.color}
              variant="ghost"
              className="rounded-full"
              icon={<HiCheckCircle className="h-3.5 w-3.5" />}
            />
          </>
        )}
        rightContent={(
          <Link href="/pages/home" className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${accent.link}`}>
            <HiArrowLeft aria-hidden="true" />
            Back to Home
          </Link>
        )}
      />

      <div className="mx-auto w-full max-w-none space-y-4 px-6 py-8 sm:px-10 lg:px-16">

        <Card className={`rounded-2xl border bg-white shadow-none dark:bg-slate-900 ${accent.section}`}>
          <CardBody className="space-y-3 p-5">
            <Typography variant="h3" className={accent.title}>
              {communityName}
            </Typography>
            <Typography className="text-slate-700 dark:text-slate-200">
              Community feed with authored posts.
            </Typography>

            {communityTags.length > 0 ? (
              <div className="flex flex-wrap gap-2 pt-2">
                {communityTags.map((tag) => (
                  <Chip
                    key={`community-tag-${tag}`}
                    value={`#${tag}`}
                    size="sm"
                    variant="ghost"
                    color={accent.color}
                    className="rounded-full"
                  />
                ))}
              </div>
            ) : null}

            <div className="pt-2">
              <Input
                          variant="standard"

                label="Search posts in this community"
                value={searchQuery}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  setSearchQuery(event.target.value)
                }
                crossOrigin={undefined}
                color={accent.color}
              />
            </div>
          </CardBody>
        </Card>

        <Card className={`rounded-2xl border bg-white shadow-none dark:bg-slate-900 ${accent.section}`}>
          <CardBody className="space-y-4 p-5">
            {!isJoined ? (
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 dark:border-blue-800/80 dark:bg-blue-900/20">
                <Typography variant="small" className="text-blue-gray-800 dark:text-slate-200">
                  You need to join {communityName} before posting.
                </Typography>
                <div className="pt-2">
                  <Button size="sm" color={accent.color} onClick={handleJoinCommunity}>
                    Join Community
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/70">
                  <Typography variant="small" className="text-slate-700 dark:text-slate-300">
                    You joined {communityName}. You can leave this community from here.
                  </Typography>
                  <Button
                    size="sm"
                    variant="outlined"
                    color="red"
                    onClick={handleLeaveCommunity}
                  >
                    Leave Community
                  </Button>
                </div>

                <PostComposer
                  heading={`Create Post in ${communityName}`}
                  title={postTitle}
                  content={postContent}
                  onTitleChange={setPostTitle}
                  onContentChange={setPostContent}
                  onSubmit={handleCreatePost}
                  disabled={postComposerDisabled}
                  buttonLabel="Post to Community"
                  color={accent.color}
                  contentLabel="What's on your mind?"
                  contentRows={4}
                  helperText="Share an update with this community."
                  extraSection={(
                    <TagsPicker
                      label="Post tags"
                      value={postTags}
                      onChange={setPostTags}
                      suggestedTags={availableTags}
                      disabled={!isJoined}
                      color={accent.color}
                    />
                  )}
                />
              </div>
            )}
          </CardBody>
        </Card>

        {filteredFeedItems.length === 0 ? (
          <Card className="border border-dashed border-slate-300 shadow-none dark:border-slate-700 dark:bg-slate-900">
            <CardBody className="p-5">
              <Typography className="text-slate-700 dark:text-slate-200">
                No posts found in this community yet.
              </Typography>
            </CardBody>
          </Card>
        ) : (
          <div className="space-y-3">
            {visibleFeedItems.map((item) => (
              <Card key={item.id} className="border border-slate-200 shadow-none dark:border-slate-700 dark:bg-slate-900">
                <CardBody className="space-y-3 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <Typography variant="h6" className="text-blue-gray-900 dark:text-slate-100">
                      {item.title}
                    </Typography>
                    <Typography variant="small" className="shrink-0 text-slate-700 dark:text-slate-300">
                      {item.createdAt}
                    </Typography>
                  </div>
                  <Typography className="text-slate-800 dark:text-slate-200">{item.content}</Typography>
                  {Array.isArray(item.tags) && item.tags.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {item.tags.map((tag) => (
                        <Chip
                          key={`${item.id}-tag-${tag}`}
                          value={`#${tag}`}
                          size="sm"
                          variant="ghost"
                          color={accent.color}
                          className="rounded-full"
                        />
                      ))}
                    </div>
                  ) : null}
                  <div className="flex items-center gap-2 border-t border-slate-200 pt-2 dark:border-slate-700">
                    <Link href={`/pages/post/${encodeURIComponent(String(item.id))}`}>
                      <Button size="sm" variant="outlined" color={accent.color} className="rounded-lg">
                        Open post
                      </Button>
                    </Link>
                    <Button size="sm" variant="text" color={accent.color} className="rounded-lg">
                      Upvote
                    </Button>
                    {isJoined ? (
                      <Link href={`/pages/post/${encodeURIComponent(String(item.id))}`}>
                        <Button
                          size="sm"
                          variant="text"
                          color={accent.color}
                          className="rounded-lg"
                        >
                          Comment
                        </Button>
                      </Link>
                    ) : (
                      <Button
                        size="sm"
                        variant="text"
                        color={accent.color}
                        className="rounded-lg"
                        disabled
                      >
                        Join to Comment
                      </Button>
                    )}
                    <Button size="sm" variant="text" color={accent.color} className="rounded-lg">
                      Share
                    </Button>
                  </div>
                </CardBody>
              </Card>
            ))}

            {visibleCount < filteredFeedItems.length ? (
              <div className="flex justify-center pt-2">
                <Button
                  variant="outlined"
                  color={accent.color}
                  className="rounded-lg"
                  onClick={() => setVisibleCount((prev) => prev + FEED_LOAD_STEP)}
                >
                  Load more posts
                </Button>
              </div>
            ) : null}
          </div>
        )}
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

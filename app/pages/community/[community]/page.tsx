"use client";

import type { ChangeEvent, FormEvent } from "react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button, Card, CardBody, Chip, Input, Typography } from "@/app/_types/mtw";
import { HiArrowLeft, HiCheckCircle, HiUserPlus } from "react-icons/hi2";
import AppNavbar from "@/app/_components/AppNavbar";
import PostComposer from "@/app/_components/PostComposer";
import TagsPicker from "@/app/_components/TagsPicker";
import { isAuthenticated } from "@/app/_utils/auth";
import { attachTagsToTarget, dedupeTagNames } from "@/app/_utils/tags";

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

  const persistJoinedCommunities = async (nextJoined: string[]) => {
    await fetch("/api/user-profile", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ joinedCommunities: nextJoined }),
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

  useEffect(() => {
    setVisibleCount(INITIAL_FEED_RENDER_COUNT);
  }, [communityName, searchQuery]);

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
      createdAt: string;
    };

    await attachTagsToTarget({
      targetType: "Post",
      targetId: created.id,
      tags: postTags,
    });

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
    await persistJoinedCommunities(nextJoined);
  };

  const handleLeaveCommunity = async () => {
    if (!isJoined) return;

    const nextJoined = joinedCommunities.filter((item) => item !== normalizedCommunityName);
    setJoinedCommunities(nextJoined);
    await persistJoinedCommunities(nextJoined);
  };

  return (
    <main className="min-h-screen bg-slate-50">
      <AppNavbar
        subtitle={`Community • ${communityName}`}
        maxWidthClassName="max-w-5xl"
        centerContent={(
          <>
            <Chip
              value={isJoined ? "Joined" : "Not joined"}
              color={isJoined ? "green" : "blue-gray"}
              variant="ghost"
              className="rounded-full"
              icon={<HiUserPlus className="h-3.5 w-3.5" />}
            />
            <Chip
              value={`${totalCount.toLocaleString()} posts`}
              color="blue-gray"
              variant="ghost"
              className="rounded-full"
              icon={<HiCheckCircle className="h-3.5 w-3.5" />}
            />
          </>
        )}
        rightContent={(
          <Link href="/pages/home" className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-blue-gray-700 hover:bg-slate-100">
            <HiArrowLeft aria-hidden="true" />
            Back to Home
          </Link>
        )}
      />

      <div className="mx-auto w-full max-w-5xl space-y-4 px-6 py-8 sm:px-10 lg:px-16">

        <Card className="rounded-2xl border border-slate-200 bg-white shadow-none">
          <CardBody className="space-y-2">
            <Typography variant="h3" className="text-blue-gray-900">
              {communityName}
            </Typography>
            <Typography className="text-slate-600">
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
                    color="blue"
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
                color="blue"
              />
            </div>
          </CardBody>
        </Card>

        <Card className="rounded-2xl border border-slate-200 bg-white shadow-none">
          <CardBody className="space-y-4">
            {!isJoined ? (
              <div className="rounded-xl border border-blue-100 bg-blue-50 p-3">
                <Typography variant="small" className="text-blue-gray-800">
                  You need to join {communityName} before posting.
                </Typography>
                <div className="pt-2">
                  <Button size="sm" color="blue" onClick={handleJoinCommunity}>
                    Join Community
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <Typography variant="small" className="text-slate-700">
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
                  color="blue"
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
                      color="blue"
                    />
                  )}
                />
              </div>
            )}
          </CardBody>
        </Card>

        {filteredFeedItems.length === 0 ? (
          <Card className="border border-dashed border-slate-300 shadow-none">
            <CardBody>
              <Typography className="text-slate-600">
                No posts found in this community yet.
              </Typography>
            </CardBody>
          </Card>
        ) : (
          <div className="space-y-3">
            {visibleFeedItems.map((item) => (
              <Card key={item.id} className="border border-slate-200 shadow-none">
                <CardBody className="space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <Typography variant="h6" className="text-blue-gray-900">
                      {item.title}
                    </Typography>
                    <Typography variant="small" className="shrink-0 text-slate-500">
                      {item.createdAt}
                    </Typography>
                  </div>
                  <Typography className="text-slate-700">{item.content}</Typography>
                  {Array.isArray(item.tags) && item.tags.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {item.tags.map((tag) => (
                        <Chip
                          key={`${item.id}-tag-${tag}`}
                          value={`#${tag}`}
                          size="sm"
                          variant="ghost"
                          color="blue"
                          className="rounded-full"
                        />
                      ))}
                    </div>
                  ) : null}
                  <div className="flex items-center gap-2 border-t border-slate-200 pt-2">
                    <Link href={`/pages/post/${encodeURIComponent(String(item.id))}`}>
                      <Button size="sm" variant="outlined" color="blue-gray" className="rounded-lg">
                        Open post
                      </Button>
                    </Link>
                    <Button size="sm" variant="text" color="blue-gray" className="rounded-lg">
                      Upvote
                    </Button>
                    {isJoined ? (
                      <Link href={`/pages/post/${encodeURIComponent(String(item.id))}`}>
                        <Button
                          size="sm"
                          variant="text"
                          color="blue-gray"
                          className="rounded-lg"
                        >
                          Comment
                        </Button>
                      </Link>
                    ) : (
                      <Button
                        size="sm"
                        variant="text"
                        color="blue-gray"
                        className="rounded-lg"
                        disabled
                      >
                        Join to Comment
                      </Button>
                    )}
                    <Button size="sm" variant="text" color="blue-gray" className="rounded-lg">
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
                  color="blue-gray"
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
    </main>
  );
}

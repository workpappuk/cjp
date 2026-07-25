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
import { isAuthenticated } from "@/app/_utils/auth";

const POSTS_KEY = "threadforge-posts";
const JOINED_COMMUNITIES_KEY = "threadforge-joined-communities";
const COMMUNITY_POST_COUNTS_KEY = "threadforge-community-post-counts";
const SYNTHETIC_RENDER_LIMIT = 150;
const INITIAL_FEED_RENDER_COUNT = 30;
const FEED_LOAD_STEP = 30;

type PostItem = {
  id: string | number;
  title: string;
  content: string;
  communities?: string[];
  createdAt: string;
  synthetic?: boolean;
};

export default function CommunityPage() {
  const router = useRouter();
  const { status } = useSession();
  const params = useParams();
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [postTitle, setPostTitle] = useState("");
  const [postContent, setPostContent] = useState("");
  const [joinedCommunities, setJoinedCommunities] = useState<string[]>([]);
  const [communityPostCounts, setCommunityPostCounts] = useState<Record<string, number>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(INITIAL_FEED_RENDER_COUNT);

  const communityName = useMemo(() => {
    const raw = Array.isArray(params.community)
      ? params.community[0]
      : params.community;
    return decodeURIComponent(raw || "");
  }, [params.community]);

  useEffect(() => {
    if (status === "loading") {
      return;
    }

    if (status === "unauthenticated" && !isAuthenticated()) {
      router.replace("/");
      return;
    }

    const savedPosts = window.localStorage.getItem(POSTS_KEY);
    if (savedPosts) {
      try {
        const parsedPosts = JSON.parse(savedPosts);
        if (Array.isArray(parsedPosts)) {
          setPosts(parsedPosts);
        }
      } catch {
        setPosts([]);
      }
    }

    const savedJoinedCommunities = window.localStorage.getItem(
      JOINED_COMMUNITIES_KEY,
    );
    if (savedJoinedCommunities) {
      try {
        const parsedJoined = JSON.parse(savedJoinedCommunities);
        if (Array.isArray(parsedJoined)) {
          setJoinedCommunities(parsedJoined);
        }
      } catch {
        setJoinedCommunities([]);
      }
    }

    const savedCommunityPostCounts = window.localStorage.getItem(
      COMMUNITY_POST_COUNTS_KEY,
    );
    if (savedCommunityPostCounts) {
      try {
        const parsedCounts = JSON.parse(savedCommunityPostCounts);
        if (parsedCounts && typeof parsedCounts === "object") {
          setCommunityPostCounts(parsedCounts);
        }
      } catch {
        setCommunityPostCounts({});
      }
    }
  }, [router, status]);

  const authoredPosts = useMemo(() => {
    return posts.filter(
      (post) =>
        Array.isArray(post.communities) &&
        post.communities.includes(communityName),
    );
  }, [posts, communityName]);

  const syntheticCount = communityPostCounts[communityName] ?? 0;
  const totalCount = authoredPosts.length + syntheticCount;
  const isJoined = joinedCommunities.includes(communityName);
  const postComposerDisabled =
    !isJoined || postTitle.trim().length === 0 || postContent.trim().length === 0;

  const syntheticSamples = useMemo(() => {
    const count = Math.min(SYNTHETIC_RENDER_LIMIT, syntheticCount);
    return Array.from({ length: count }, (_, index) => ({
      id: `synthetic-${communityName}-${index + 1}`,
      title: `Trending in ${communityName} #${index + 1}`,
      content:
        "Seeded preview post for high-volume consumer experience in this community.",
      createdAt: `${index + 1}m ago`,
      synthetic: true,
    }));
  }, [communityName, syntheticCount]);

  const feedItems = useMemo(() => {
    const authored = authoredPosts.map((post) => ({
      id: post.id,
      title: post.title,
      content: post.content,
      createdAt: post.createdAt,
      synthetic: false,
    }));

    return [...authored, ...syntheticSamples].slice(0, SYNTHETIC_RENDER_LIMIT);
  }, [authoredPosts, syntheticSamples]);

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

  const handleCreatePost = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isJoined || postComposerDisabled) return;

    const newPost = {
      id: Date.now(),
      title: postTitle.trim(),
      content: postContent.trim(),
      communities: [communityName],
      createdAt: new Date().toLocaleString(),
    };

    const nextPosts = [newPost, ...posts];
    setPosts(nextPosts);
    window.localStorage.setItem(POSTS_KEY, JSON.stringify(nextPosts));
    setPostTitle("");
    setPostContent("");
  };

  const handleJoinCommunity = () => {
    if (isJoined) return;

    const nextJoined = [...joinedCommunities, communityName];
    setJoinedCommunities(nextJoined);
    window.localStorage.setItem(
      JOINED_COMMUNITIES_KEY,
      JSON.stringify(nextJoined),
    );
  };

  const handleLeaveCommunity = () => {
    if (!isJoined) return;

    const nextJoined = joinedCommunities.filter((item) => item !== communityName);
    setJoinedCommunities(nextJoined);
    window.localStorage.setItem(
      JOINED_COMMUNITIES_KEY,
      JSON.stringify(nextJoined),
    );
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
              Community feed preview with authored posts and seeded high-volume consumer content.
            </Typography>
            <div className="pt-2">
              <Input
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
                  {item.synthetic ? (
                    <Typography variant="small" className="text-slate-500">
                      Seeded preview item
                    </Typography>
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

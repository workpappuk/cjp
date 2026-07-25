"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Card,
  CardBody,
  Chip,
  Typography,
} from "@material-tailwind/react";
import { HiArrowLeft, HiChatBubbleBottomCenterText } from "react-icons/hi2";
import AppNavbar from "../../../components/AppNavbar";
import CommentComposer from "../../../components/CommentComposer";

const AUTH_KEY = "threadforge-auth";
const POSTS_KEY = "threadforge-posts";
const COMMENTS_KEY = "threadforge-post-comments";
const JOINED_COMMUNITIES_KEY = "threadforge-joined-communities";
const SEEDED_COMMENTS_PER_POST = 100;
const MAX_NESTED_DEPTH = 3;
const COMMENT_MESSAGE_POOL = [
  "Great take. This should spark a useful discussion.",
  "I tested this approach and it worked well for me.",
  "Can you share a bit more detail on your setup?",
  "Interesting perspective, especially for newcomers.",
  "I agree with most points, but there is one trade-off.",
  "This is exactly what our team was debating today.",
  "Thanks for posting this. Saving it for later.",
  "The examples make this much easier to understand.",
  "I would also compare this against alternative options.",
  "Solid summary. Looking forward to follow-up updates.",
];

function readJSON(key, fallback) {
  const raw = window.localStorage.getItem(key);
  if (!raw) return fallback;

  try {
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(key, value) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

function createSeededNumberGenerator(seedText) {
  let seed = 7;
  for (let i = 0; i < seedText.length; i += 1) {
    seed = (seed * 31 + seedText.charCodeAt(i)) % 2147483647;
  }

  if (seed <= 0) seed += 2147483646;

  return () => {
    seed = (seed * 48271) % 2147483647;
    return seed / 2147483647;
  };
}

function randomMessage(nextRandom) {
  const index = Math.floor(nextRandom() * COMMENT_MESSAGE_POOL.length);
  return COMMENT_MESSAGE_POOL[index] ?? COMMENT_MESSAGE_POOL[0];
}

function buildNestedReplies({ parentId, depth, maxDepth, nextRandom }) {
  if (depth >= maxDepth) return [];

  const replyCount = Math.floor(nextRandom() * 3);
  return Array.from({ length: replyCount }, (_, replyIndex) => {
    const id = `${parentId}-r${depth}-${replyIndex + 1}`;

    return {
      id,
      text: randomMessage(nextRandom),
      createdAt: `${Math.floor(nextRandom() * 59) + 1}m ago`,
      replies: buildNestedReplies({
        parentId: id,
        depth: depth + 1,
        maxDepth,
        nextRandom,
      }),
    };
  });
}

function buildSeededComments(postId, count = SEEDED_COMMENTS_PER_POST) {
  const nextRandom = createSeededNumberGenerator(postId);

  return Array.from({ length: count }, (_, index) => {
    const id = `${postId}-c${index + 1}`;

    return {
      id,
      text: randomMessage(nextRandom),
      createdAt: `${Math.floor(nextRandom() * 120) + 1}m ago`,
      replies: buildNestedReplies({
        parentId: id,
        depth: 1,
        maxDepth: MAX_NESTED_DEPTH,
        nextRandom,
      }),
    };
  });
}

function countComments(comments) {
  return comments.reduce((total, comment) => {
    const nested = Array.isArray(comment.replies)
      ? countComments(comment.replies)
      : 0;
    return total + 1 + nested;
  }, 0);
}

function CommentThread({ comments, depth = 0 }) {
  return (
    <div className="space-y-2">
      {comments.map((comment) => (
        <div key={comment.id} style={{ marginLeft: `${depth * 16}px` }}>
          <Card className="border border-slate-200 shadow-none">
            <CardBody className="space-y-1">
              <Typography className="text-slate-700">{comment.text}</Typography>
              <Typography variant="small" className="text-slate-500">
                {comment.createdAt}
              </Typography>
            </CardBody>
          </Card>

          {Array.isArray(comment.replies) && comment.replies.length > 0 ? (
            <div className="mt-2 border-l border-slate-200 pl-2">
              <CommentThread comments={comment.replies} depth={depth + 1} />
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function buildSyntheticPost(postId) {
  if (!postId.startsWith("synthetic-")) return null;

  const parts = postId.split("-");
  if (parts.length < 3) return null;

  const rank = Number(parts[parts.length - 1]) || 1;
  const community = parts.slice(1, parts.length - 1).join("-");

  return {
    id: postId,
    title: `Trending in ${community} #${rank}`,
    content:
      "This is a seeded high-volume preview post representing active community traffic.",
    createdAt: `${rank}m ago`,
    communities: [community],
    synthetic: true,
  };
}

export default function PostDetailPage() {
  const router = useRouter();
  const params = useParams();
  const [posts, setPosts] = useState([]);
  const [commentsByPost, setCommentsByPost] = useState({});
  const [joinedCommunities, setJoinedCommunities] = useState([]);
  const [commentText, setCommentText] = useState("");

  const postId = useMemo(() => {
    const raw = Array.isArray(params.postId) ? params.postId[0] : params.postId;
    return decodeURIComponent(raw || "");
  }, [params.postId]);

  useEffect(() => {
    if (window.localStorage.getItem(AUTH_KEY) !== "google") {
      router.replace("/");
      return;
    }

    const parsedPosts = readJSON(POSTS_KEY, []);
    setPosts(Array.isArray(parsedPosts) ? parsedPosts : []);

    const parsedComments = readJSON(COMMENTS_KEY, {});
    setCommentsByPost(
      parsedComments && typeof parsedComments === "object" ? parsedComments : {},
    );

    const parsedJoined = readJSON(JOINED_COMMUNITIES_KEY, []);
    setJoinedCommunities(Array.isArray(parsedJoined) ? parsedJoined : []);
  }, [router]);

  const post = useMemo(() => {
    const found = posts.find((item) => String(item.id) === postId);
    if (found) return { ...found, synthetic: false };
    return buildSyntheticPost(postId);
  }, [posts, postId]);

  const comments = useMemo(() => {
    const saved = commentsByPost[postId];
    if (Array.isArray(saved) && saved.length > 0) {
      return saved;
    }
    return [];
  }, [commentsByPost, postId]);

  const totalCommentCount = useMemo(() => countComments(comments), [comments]);

  const canComment = useMemo(() => {
    if (!post || !Array.isArray(post.communities) || post.communities.length === 0) {
      return false;
    }

    return post.communities.some((community) => joinedCommunities.includes(community));
  }, [post, joinedCommunities]);

  const communityToJoinForComments = useMemo(() => {
    if (!post || !Array.isArray(post.communities) || post.communities.length === 0) {
      return "";
    }

    return post.communities.find((community) => !joinedCommunities.includes(community)) || "";
  }, [post, joinedCommunities]);

  useEffect(() => {
    if (!postId || !post) return;

    const existing = commentsByPost[postId];
    if (Array.isArray(existing) && existing.length > 0) {
      return;
    }

    const seededComments = buildSeededComments(postId);
    const nextCommentsByPost = {
      ...commentsByPost,
      [postId]: seededComments,
    };

    setCommentsByPost(nextCommentsByPost);
    writeJSON(COMMENTS_KEY, nextCommentsByPost);
  }, [commentsByPost, post, postId]);

  const handleAddComment = (event) => {
    event.preventDefault();
    if (!canComment) return;

    const text = commentText.trim();
    if (!text) return;

    const nextComment = {
      id: `${postId}-${Date.now()}`,
      text,
      createdAt: new Date().toLocaleString(),
      replies: [],
    };

    const existing = Array.isArray(commentsByPost[postId]) ? commentsByPost[postId] : [];
    const nextCommentsByPost = {
      ...commentsByPost,
      [postId]: [nextComment, ...existing],
    };

    setCommentsByPost(nextCommentsByPost);
    writeJSON(COMMENTS_KEY, nextCommentsByPost);
    setCommentText("");
  };

  const handleJoinForComments = () => {
    const targetCommunity = communityToJoinForComments;
    if (!targetCommunity) return;

    const nextJoined = [...joinedCommunities, targetCommunity];
    setJoinedCommunities(nextJoined);
    writeJSON(JOINED_COMMUNITIES_KEY, nextJoined);
  };

  if (!post) {
    return (
      <main className="min-h-screen bg-slate-50">
        <AppNavbar
          subtitle="Post discussion"
          maxWidthClassName="max-w-4xl"
          rightContent={(
            <Link
              href="/home"
              className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-blue-gray-700 hover:bg-slate-100"
            >
              <HiArrowLeft aria-hidden="true" />
              Back to Home
            </Link>
          )}
        />

        <div className="mx-auto w-full max-w-4xl space-y-4 px-6 py-8 sm:px-10 lg:px-16">

          <Card className="border border-dashed border-slate-300 shadow-none">
            <CardBody>
              <Typography className="text-slate-600">Post not found.</Typography>
            </CardBody>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <AppNavbar
        subtitle="Post discussion"
        maxWidthClassName="max-w-4xl"
        rightContent={(
          <Link
            href="/home"
            className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-blue-gray-700 hover:bg-slate-100"
          >
            <HiArrowLeft aria-hidden="true" />
            Back to Home
          </Link>
        )}
      />

      <div className="mx-auto w-full max-w-4xl space-y-4 px-6 py-8 sm:px-10 lg:px-16">

        <Card className="border border-slate-200 shadow-none">
          <CardBody className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <Typography variant="h4" className="text-blue-gray-900">
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
                    href={`/home/community/${encodeURIComponent(community)}`}
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

            <Typography className="leading-8 text-slate-700">{post.content}</Typography>
          </CardBody>
        </Card>

        <Card className="border border-slate-200 shadow-none">
          <CardBody className="space-y-4">
            <Typography variant="h5" className="inline-flex items-center gap-2 text-blue-gray-900">
              <HiChatBubbleBottomCenterText aria-hidden="true" />
              Comments ({totalCommentCount})
            </Typography>

            <CommentComposer
              commentText={commentText}
              onCommentTextChange={setCommentText}
              onSubmit={handleAddComment}
              canComment={canComment}
              submitDisabled={commentText.trim().length === 0}
              joinPrompt="Join one of this post's communities to comment."
              joinButtonLabel={
                communityToJoinForComments
                  ? `Join ${communityToJoinForComments}`
                  : ""
              }
              onJoin={communityToJoinForComments ? handleJoinForComments : undefined}
              color="blue"
            />

            {comments.length === 0 ? (
              <Typography className="text-slate-600">No comments yet.</Typography>
            ) : (
              <CommentThread comments={comments} />
            )}
          </CardBody>
        </Card>
      </div>
    </main>
  );
}

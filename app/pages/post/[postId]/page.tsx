"use client";

import type { FormEvent } from "react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Card, CardBody, Chip, Typography } from "@/app/_types/mtw";
import { HiArrowLeft, HiChatBubbleBottomCenterText } from "react-icons/hi2";
import AppNavbar from "@/app/_components/AppNavbar";
import CommentComposer from "@/app/_components/CommentComposer";
import { isAuthenticated } from "@/app/_utils/auth";

type PostItem = {
  id: string | number;
  title: string;
  content: string;
  communities?: string[];
  createdAt: string;
};

type CommentItem = {
  id: string;
  text: string;
  createdAt: string;
  replies: CommentItem[];
};

type CommentThreadProps = {
  comments: CommentItem[];
  depth?: number;
};

type UserProfileResponse = {
  joinedCommunities?: string[];
};

function formatDisplayDate(input: string | Date) {
  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) return String(input);
  return parsed.toLocaleString();
}

function countComments(comments: CommentItem[]): number {
  return comments.reduce((total, comment) => {
    const nested = Array.isArray(comment.replies)
      ? countComments(comment.replies)
      : 0;
    return total + 1 + nested;
  }, 0);
}

function CommentThread({ comments, depth = 0 }: CommentThreadProps) {
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

export default function PostDetailPage() {
  const router = useRouter();
  const { status } = useSession();
  const params = useParams();
  const [post, setPost] = useState<PostItem | null>(null);
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [joinedCommunities, setJoinedCommunities] = useState<string[]>([]);
  const [commentText, setCommentText] = useState("");

  const persistJoinedCommunities = async (nextJoined: string[]) => {
    await fetch("/api/user-profile", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ joinedCommunities: nextJoined }),
    });
  };

  const postId = useMemo(() => {
    const raw = Array.isArray(params.postId) ? params.postId[0] : params.postId;
    return decodeURIComponent(raw || "");
  }, [params.postId]);

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
        const [postRes, commentsRes, profileRes] = await Promise.all([
          fetch(`/api/posts/${encodeURIComponent(postId)}`, { cache: "no-store" }),
          fetch(`/api/posts/${encodeURIComponent(postId)}/comments`, { cache: "no-store" }),
          fetch("/api/user-profile", { cache: "no-store" }),
        ]);

        if (!isMounted) {
          return;
        }

        if (postRes.ok) {
          const parsedPost = (await postRes.json()) as {
            id: string;
            title: string;
            content: string;
            communities?: string[];
            createdAt: string;
          };

          setPost({
            id: parsedPost.id,
            title: parsedPost.title,
            content: parsedPost.content,
            communities: parsedPost.communities,
            createdAt: formatDisplayDate(parsedPost.createdAt),
          });
        } else {
          setPost(null);
        }

        if (commentsRes.ok) {
          const parsedComments = (await commentsRes.json()) as Array<{
            id: string;
            text: string;
            createdAt: string;
          }>;

          setComments(
            Array.isArray(parsedComments)
              ? parsedComments.map((comment) => ({
                  id: comment.id,
                  text: comment.text,
                  createdAt: formatDisplayDate(comment.createdAt),
                  replies: [],
                }))
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
      } catch {
        if (!isMounted) {
          return;
        }

        setPost(null);
        setComments([]);
        setJoinedCommunities([]);
      }
    };

    void hydrateFromApi();

    return () => {
      isMounted = false;
    };
  }, [postId, router, status]);

  const totalCommentCount = useMemo(() => countComments(comments), [comments]);

  const canComment = useMemo(() => {
    if (!post || !Array.isArray(post.communities) || post.communities.length === 0) {
      return false;
    }

    return post.communities.some((community) =>
      joinedCommunities.includes(community.toLowerCase()),
    );
  }, [post, joinedCommunities]);

  const communityToJoinForComments = useMemo(() => {
    if (!post || !Array.isArray(post.communities) || post.communities.length === 0) {
      return "";
    }

    return (
      post.communities.find(
        (community) => !joinedCommunities.includes(community.toLowerCase()),
      ) || ""
    );
  }, [post, joinedCommunities]);

  const handleAddComment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canComment) return;

    const text = commentText.trim();
    if (!text) return;

    const response = await fetch(`/api/posts/${encodeURIComponent(postId)}/comments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      return;
    }

    const created = (await response.json()) as {
      id: string;
      text: string;
      createdAt: string;
    };

    const nextComment = {
      id: created.id,
      text: created.text,
      createdAt: formatDisplayDate(created.createdAt),
      replies: [],
    };

    setComments((prev) => [nextComment, ...prev]);
    setCommentText("");
  };

  const handleJoinForComments = async () => {
    const targetCommunity = communityToJoinForComments;
    if (!targetCommunity) return;

    const nextJoined = [...joinedCommunities, targetCommunity.toLowerCase()];
    setJoinedCommunities(nextJoined);
    await persistJoinedCommunities(nextJoined);
  };

  if (!post) {
    return (
      <main className="min-h-screen bg-slate-50">
        <AppNavbar
          subtitle="Post discussion"
          maxWidthClassName="max-w-4xl"
          rightContent={(
            <Link
              href="/pages/home"
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
            href="/pages/home"
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

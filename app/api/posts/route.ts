import { NextResponse } from "next/server";
import { connectToDatabase } from "@/app/_lib/mongoose";
import { PostModel } from "@/app/_lib/models/Post";
import { checkRateLimit } from "@/app/_lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const communities = searchParams
      .getAll("community")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);

    const query =
      communities.length > 0 ? { communities: { $in: communities } } : {};

    const posts = await PostModel.find(query)
      .sort({ createdAt: -1 })
      .limit(500)
      .lean();

    return NextResponse.json(
      posts.map((post) => ({
        id: String(post._id),
        title: post.title,
        content: post.content,
        communities: post.communities,
        createdAt: post.createdAt,
        updatedAt: post.updatedAt,
      })),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch posts";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const rateLimit = await checkRateLimit({
    scope: "posts:create",
    request,
    limit: 30,
    windowMs: 60_000,
  });

  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        error: "Too many requests. Please try again later.",
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(rateLimit.retryAfterSeconds),
        },
      },
    );
  }

  try {
    await connectToDatabase();

    const payload = (await request.json()) as {
      title?: string;
      content?: string;
      communities?: string[];
    };

    const title = payload?.title?.trim() ?? "";
    const content = payload?.content?.trim() ?? "";
    const communities = Array.isArray(payload?.communities)
      ? payload.communities
          .map((item) => item.trim().toLowerCase())
          .filter(Boolean)
      : [];

    if (!title || !content) {
      return NextResponse.json(
        { error: "Title and content are required." },
        { status: 400 },
      );
    }

    const created = await PostModel.create({ title, content, communities });

    return NextResponse.json(
      {
        id: String(created._id),
        title: created.title,
        content: created.content,
        communities: created.communities,
        createdAt: created.createdAt,
        updatedAt: created.updatedAt,
      },
      { status: 201 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create post";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

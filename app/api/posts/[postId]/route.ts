import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { connectToDatabase } from "@/app/_lib/mongoose";
import { PostModel } from "@/app/_lib/models/Post";
import { getApiErrorMessage, logApiError } from "@/app/_lib/api-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ParamsContext = {
  params: {
    postId: string;
  };
};

export async function GET(_request: Request, { params }: ParamsContext) {
  try {
    await connectToDatabase();

    if (!mongoose.Types.ObjectId.isValid(params.postId)) {
      return NextResponse.json({ error: "Invalid post id." }, { status: 400 });
    }

    const post = await PostModel.findById(params.postId).lean();
    if (!post) {
      return NextResponse.json({ error: "Post not found." }, { status: 404 });
    }

    return NextResponse.json({
      id: String(post._id),
      title: post.title,
      content: post.content,
      communities: post.communities,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
    });
  } catch (error) {
    logApiError({
      route: "/api/posts/[postId]",
      method: "GET",
      error,
      context: { postId: params.postId },
    });
    const message = getApiErrorMessage(error, "Failed to fetch post");
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

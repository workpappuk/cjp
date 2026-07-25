import { NextResponse } from "next/server";
import { connectToDatabase } from "@/app/_lib/mongoose";
import { CommunityModel } from "@/app/_lib/models/Community";
import { checkRateLimit } from "@/app/_lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await connectToDatabase();

    const communities = await CommunityModel.find({})
      .sort({ name: 1 })
      .lean();

    return NextResponse.json(
      communities.map((community) => ({
        id: String(community._id),
        name: community.name,
        createdAt: community.createdAt,
        updatedAt: community.updatedAt,
      })),
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch communities";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const rateLimit = await checkRateLimit({
    scope: "communities:create",
    request,
    limit: 10,
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

    const payload = (await request.json()) as { name?: string };
    const normalizedName = payload?.name?.trim().toLowerCase() ?? "";

    if (normalizedName.length < 3) {
      return NextResponse.json(
        { error: "Community name must be at least 3 characters." },
        { status: 400 },
      );
    }

    const existing = await CommunityModel.findOne({ name: normalizedName }).lean();
    if (existing) {
      return NextResponse.json(
        { error: "Community already exists." },
        { status: 409 },
      );
    }

    const created = await CommunityModel.create({ name: normalizedName });

    return NextResponse.json(
      {
        id: String(created._id),
        name: created.name,
        createdAt: created.createdAt,
        updatedAt: created.updatedAt,
      },
      { status: 201 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create community";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

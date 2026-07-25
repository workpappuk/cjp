import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/_lib/auth";
import { connectToDatabase } from "@/app/_lib/mongoose";
import { UserProfileModel } from "@/app/_lib/models/UserProfile";
import { checkRateLimit } from "@/app/_lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function isValidImageUrl(value: string) {
  if (!value) return true;
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol);
  } catch {
    return false;
  }
}

async function requireSession() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.trim() ?? "";

  if (!email) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  return {
    session,
    email: normalizeEmail(email),
  };
}

export async function GET() {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;

  try {
    await connectToDatabase();

    const profile = await UserProfileModel.findOneAndUpdate(
      { email: auth.email },
      {
        $setOnInsert: {
          email: auth.email,
          name: auth.session?.user?.name ?? "",
          image: auth.session?.user?.image ?? "",
          provider: auth.session?.provider ?? "google",
          joinedCommunities: [],
        },
        $set: {
          lastLoginAt: new Date(),
          provider: auth.session?.provider ?? "google",
        },
      },
      {
        upsert: true,
        new: true,
      },
    ).lean();

    return NextResponse.json({
      id: String(profile?._id),
      email: profile?.email ?? auth.email,
      name: profile?.name ?? "",
      image: profile?.image ?? "",
      provider: profile?.provider ?? "google",
      bio: profile?.bio ?? "",
      joinedCommunities: profile?.joinedCommunities ?? [],
      createdAt: profile?.createdAt,
      updatedAt: profile?.updatedAt,
      lastLoginAt: profile?.lastLoginAt,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load user profile";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const rateLimit = await checkRateLimit({
    scope: "profile:update",
    request,
    limit: 20,
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

  const auth = await requireSession();
  if ("error" in auth) return auth.error;

  try {
    await connectToDatabase();

    const payload = (await request.json()) as {
      name?: string;
      image?: string;
      bio?: string;
      joinedCommunities?: string[];
    };

    const nextName = payload?.name?.trim() ?? "";
    const nextImage = payload?.image?.trim() ?? "";
    const nextBio = payload?.bio?.trim() ?? "";
    const nextJoinedCommunities = Array.isArray(payload?.joinedCommunities)
      ? payload.joinedCommunities
          .map((item) => item.trim().toLowerCase())
          .filter(Boolean)
      : undefined;

    const nextSet: Record<string, unknown> = {
      name: nextName,
      image: nextImage,
      bio: nextBio,
      lastLoginAt: new Date(),
      provider: auth.session?.provider ?? "google",
    };

    if (Array.isArray(nextJoinedCommunities)) {
      nextSet.joinedCommunities = nextJoinedCommunities;
    }

    if (nextName.length > 120) {
      return NextResponse.json(
        { error: "Name must be 120 characters or fewer." },
        { status: 400 },
      );
    }

    if (nextBio.length > 500) {
      return NextResponse.json(
        { error: "Bio must be 500 characters or fewer." },
        { status: 400 },
      );
    }

    if (!isValidImageUrl(nextImage)) {
      return NextResponse.json(
        { error: "Image must be a valid http(s) URL." },
        { status: 400 },
      );
    }

    const profile = await UserProfileModel.findOneAndUpdate(
      { email: auth.email },
      {
        $setOnInsert: {
          email: auth.email,
          provider: auth.session?.provider ?? "google",
          joinedCommunities: [],
        },
        $set: nextSet,
      },
      {
        upsert: true,
        new: true,
      },
    ).lean();

    return NextResponse.json({
      id: String(profile?._id),
      email: profile?.email ?? auth.email,
      name: profile?.name ?? "",
      image: profile?.image ?? "",
      provider: profile?.provider ?? "google",
      bio: profile?.bio ?? "",
      joinedCommunities: profile?.joinedCommunities ?? [],
      createdAt: profile?.createdAt,
      updatedAt: profile?.updatedAt,
      lastLoginAt: profile?.lastLoginAt,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update user profile";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

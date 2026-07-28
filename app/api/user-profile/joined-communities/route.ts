import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Types } from "mongoose";
import { authOptions } from "@/app/_lib/auth";
import { connectToDatabase } from "@/app/_lib/mongoose";
import { UserProfileModel } from "@/app/_lib/models/UserProfile";
import {
  getApiErrorMessage,
  getOrCreateRequestId,
  logApiError,
} from "@/app/_lib/api-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

type CursorValue = {
  name: string;
  id: string;
};

type JoinedCommunityRef = Types.ObjectId | string | null | undefined;

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function parseLimit(raw: string | null) {
  const parsed = Number(raw ?? DEFAULT_LIMIT);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_LIMIT;
  }

  const bounded = Math.max(1, Math.min(MAX_LIMIT, Math.floor(parsed)));
  return bounded;
}

function parseCursor(raw: string | null): CursorValue | null {
  if (!raw) {
    return null;
  }

  try {
    const decoded = Buffer.from(raw, "base64url").toString("utf8");
    const parsed = JSON.parse(decoded) as { name?: string; id?: string };

    const name = (parsed.name ?? "").trim().toLowerCase();
    const id = (parsed.id ?? "").trim();

    if (!name || !Types.ObjectId.isValid(id)) {
      return null;
    }

    return { name, id };
  } catch {
    return null;
  }
}

function encodeCursor(value: CursorValue) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

export async function GET(request: Request) {
  const requestId = getOrCreateRequestId(request);

  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.trim() ?? "";

  if (!email) {
    return NextResponse.json(
      { error: "Unauthorized", requestId },
      {
        status: 401,
        headers: {
          "x-request-id": requestId,
        },
      },
    );
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search")?.trim().toLowerCase() ?? "";
  const limit = parseLimit(searchParams.get("limit"));
  const cursor = parseCursor(searchParams.get("cursor"));

  try {
    await connectToDatabase();

    const profile = await UserProfileModel.findOne(
      { email: normalizeEmail(email) },
      { joinedCommunities: 1 },
    ).lean();

    const joinedIds = Array.isArray(profile?.joinedCommunities)
      ? profile.joinedCommunities
          .map((value: JoinedCommunityRef) => {
            if (value instanceof Types.ObjectId) {
              return value;
            }

            if (typeof value === "string" && Types.ObjectId.isValid(value)) {
              return new Types.ObjectId(value);
            }

            return null;
          })
            .filter((value: Types.ObjectId | null): value is Types.ObjectId => value !== null)
      : [];

    if (joinedIds.length === 0) {
      return NextResponse.json(
        {
          requestId,
          items: [],
          nextCursor: null,
        },
        {
          headers: {
            "x-request-id": requestId,
          },
        },
      );
    }

    const matchConditions: Record<string, unknown> = {
      _id: { $in: joinedIds },
      recordStatus: { $ne: "deleted" },
    };

    if (search) {
      matchConditions.name = { $regex: search, $options: "i" };
    }

    const cursorObjectId = cursor ? new Types.ObjectId(cursor.id) : null;
    if (cursor && cursorObjectId) {
      matchConditions.$or = [
        { name: { $gt: cursor.name } },
        { name: cursor.name, _id: { $gt: cursorObjectId } },
      ];
    }

    const communities = await UserProfileModel.db
      .collection("communities")
      .find(matchConditions, { projection: { _id: 1, name: 1 } })
      .sort({ name: 1, _id: 1 })
      .limit(limit + 1)
      .toArray();

    const hasMore = communities.length > limit;
    const sliced = hasMore ? communities.slice(0, limit) : communities;

    const nextCursor = hasMore
      ? encodeCursor({
          name: String(sliced[sliced.length - 1]?.name ?? "").toLowerCase(),
          id: String(sliced[sliced.length - 1]?._id ?? ""),
        })
      : null;

    return NextResponse.json(
      {
        requestId,
        items: sliced.map((community) => ({
          id: String(community._id),
          name: String(community.name ?? "").toLowerCase(),
        })),
        nextCursor,
      },
      {
        headers: {
          "x-request-id": requestId,
        },
      },
    );
  } catch (error) {
    logApiError({
      route: "/api/user-profile/joined-communities",
      method: "GET",
      error,
      requestId,
      context: {
        email,
        search,
        limit,
      },
    });

    const message = getApiErrorMessage(error, "Failed to load joined communities");
    return NextResponse.json(
      { error: message, requestId },
      {
        status: 500,
        headers: {
          "x-request-id": requestId,
        },
      },
    );
  }
}

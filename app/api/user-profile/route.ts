import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/_lib/auth";
import { connectToDatabase } from "@/app/_lib/mongoose";
import { UserProfileModel } from "@/app/_lib/models/UserProfile";
import { CommunityModel } from "@/app/_lib/models/Community";
import { checkRateLimit } from "@/app/_lib/rate-limit";
import { Types } from "mongoose";
import {
  getApiErrorMessage,
  getOrCreateRequestId,
  logApiError,
} from "@/app/_lib/api-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LAST_LOGIN_UPDATE_MIN_INTERVAL_MS = 1 * 60 * 1000;

type PersistedProfile = {
  _id: Types.ObjectId | string;
  email?: string;
  name?: string;
  image?: string;
  provider?: string;
  isAdmin?: boolean;
  bio?: string;
  createdBy?: Types.ObjectId | string | null;
  lastUpdatedBy?: Types.ObjectId | string | null;
  joinedCommunities?: JoinedCommunityValue[];
  createdAt?: Date;
  updatedAt?: Date;
  lastLoginAt?: Date;
};

type JoinedCommunityValue =
  | string
  | { _id?: Types.ObjectId | string; name?: string }
  | null
  | undefined;

type ProfileUpdateSet = {
  name: string;
  image: string;
  bio: string;
  lastLoginAt: Date;
  provider: string;
  lastUpdatedBy?: Types.ObjectId;
  joinedCommunities?: Types.ObjectId[];
};

type ProfileSetOnInsert = {
  email: string;
  joinedCommunities?: Types.ObjectId[];
};

type AuditUpdateSet = {
  createdBy?: Types.ObjectId;
  lastUpdatedBy?: Types.ObjectId;
};

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

function isDuplicateKeyError(error: { code?: number } | Error | null | undefined) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: number }).code === 11000
  );
}

async function resolveJoinedCommunityIds(input: string[]) {
  const normalized = [...new Set(input.map((item) => item.trim()).filter(Boolean))];
  if (normalized.length === 0) {
    return [] as Types.ObjectId[];
  }

  const idCandidates = normalized.filter((item) => Types.ObjectId.isValid(item));
  const nameCandidates = normalized
    .filter((item) => !Types.ObjectId.isValid(item))
    .map((item) => item.toLowerCase());

  const [byId, byName] = await Promise.all([
    idCandidates.length > 0
      ? CommunityModel.find({ _id: { $in: idCandidates } }, { _id: 1 }).lean()
      : Promise.resolve([]),
    nameCandidates.length > 0
      ? CommunityModel.find({ name: { $in: nameCandidates } }, { _id: 1 }).lean()
      : Promise.resolve([]),
  ]);

  const uniqueIds = new Set<string>();
  for (const community of [...byId, ...byName]) {
    uniqueIds.add(String(community._id));
  }

  return [...uniqueIds].map((id) => new Types.ObjectId(id));
}

function toObjectId(value: Types.ObjectId | string | null | undefined) {
  if (!value) return null;
  if (value instanceof Types.ObjectId) {
    return value;
  }
  if (!Types.ObjectId.isValid(value)) {
    return null;
  }
  return new Types.ObjectId(value);
}

async function ensureProfileAuditIds(
  profile: PersistedProfile | null,
  preferredUpdaterId: Types.ObjectId | null,
) {
  if (!profile) {
    return profile;
  }

  const profileId = toObjectId(profile._id);
  if (!profileId) {
    return profile;
  }

  const createdById = toObjectId(profile.createdBy);
  const updatedById = toObjectId(profile.lastUpdatedBy);

  const auditSet: AuditUpdateSet = {};
  if (!createdById) {
    auditSet.createdBy = profileId;
  }
  if (!updatedById) {
    auditSet.lastUpdatedBy = preferredUpdaterId ?? profileId;
  }

  if (!auditSet.createdBy && !auditSet.lastUpdatedBy) {
    return profile;
  }

  await UserProfileModel.updateOne({ _id: profileId }, { $set: auditSet });

  const refreshed = await UserProfileModel.findById(profileId)
    .populate("joinedCommunities", "name")
    .lean();

  return refreshed as PersistedProfile | null;
}

async function collapseDuplicateProfilesByEmail(email: string) {
  const profiles = await UserProfileModel.find({ email })
    .sort({ updatedAt: -1, createdAt: -1, _id: -1 })
    .lean();

  if (profiles.length <= 1) {
    return;
  }

  const keeper = profiles[0];
  if (!keeper) {
    return;
  }

  const staleIds = profiles
    .slice(1)
    .map((profile) => toObjectId(profile._id))
    .filter((id): id is Types.ObjectId => Boolean(id));

  if (staleIds.length > 0) {
    await UserProfileModel.deleteMany({ _id: { $in: staleIds } });
  }
}

function toProfileResponse(profile: PersistedProfile | null | undefined, fallbackEmail: string) {
  const joinedCommunityNames = Array.isArray(profile?.joinedCommunities)
    ? profile.joinedCommunities
        .map((item) => {
          if (!item) return "";
          if (typeof item === "string") {
            return item.trim().toLowerCase();
          }
          return (item.name ?? "").trim().toLowerCase();
        })
        .filter(Boolean)
    : [];

  return {
    id: String(profile?._id ?? ""),
    email: profile?.email ?? fallbackEmail,
    name: profile?.name ?? "",
    image: profile?.image ?? "",
    provider: profile?.provider ?? "google",
    isAdmin: Boolean(profile?.isAdmin),
    bio: profile?.bio ?? "",
    createdBy: profile?.createdBy ? String(profile.createdBy) : "",
    lastUpdatedBy: profile?.lastUpdatedBy ? String(profile.lastUpdatedBy) : "",
    joinedCommunities: joinedCommunityNames,
    createdAt: profile?.createdAt,
    updatedAt: profile?.updatedAt,
    lastLoginAt: profile?.lastLoginAt,
  };
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

export async function GET(request: Request) {
  const requestId = getOrCreateRequestId(request);

  const auth = await requireSession();
  if ("error" in auth) {
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

  try {
    await connectToDatabase();
    await collapseDuplicateProfilesByEmail(auth.email);

    try {
      await UserProfileModel.updateOne(
        { email: auth.email },
        {
          $setOnInsert: {
            email: auth.email,
            name: auth.session?.user?.name ?? "",
            image: auth.session?.user?.image ?? "",
            joinedCommunities: [],
            lastLoginAt: new Date(),
          },
          $set: {
            provider: auth.session?.provider ?? "google",
          },
        },
        { upsert: true },
      );
    } catch (error) {
      // A concurrent request may win the upsert race; read the existing document below.
      if (!isDuplicateKeyError(error as { code?: number } | Error | null | undefined)) {
        throw error;
      }
    }

    // Avoid writing login heartbeat on every profile read; only refresh every few minutes.
    await UserProfileModel.updateOne(
      {
        email: auth.email,
        lastLoginAt: { $lt: new Date(Date.now() - LAST_LOGIN_UPDATE_MIN_INTERVAL_MS) },
      },
      {
        $set: { lastLoginAt: new Date() },
      },
    );

    let profile = await UserProfileModel.findOne({ email: auth.email })
      .populate("joinedCommunities", "name")
      .lean();

    if (profile && Array.isArray(profile.joinedCommunities) && profile.joinedCommunities.length > 0) {
      const hasLegacyNames = profile.joinedCommunities.some(
        (item: JoinedCommunityValue) =>
          typeof item === "string",
      );
      if (hasLegacyNames) {
        const legacyNames = profile.joinedCommunities
          .filter(
            (item: JoinedCommunityValue): item is string =>
              typeof item === "string",
          )
          .map((item: string) => item.trim())
          .filter(Boolean);
        const migratedIds = await resolveJoinedCommunityIds(legacyNames);
        await UserProfileModel.updateOne(
          { email: auth.email },
          {
            $set: {
              joinedCommunities: migratedIds,
            },
          },
        );
        profile = await UserProfileModel.findOne({ email: auth.email })
          .populate("joinedCommunities", "name")
          .lean();
      }
    }

    profile = await ensureProfileAuditIds(profile as PersistedProfile | null, null);

    return NextResponse.json(
      {
        requestId,
        ...toProfileResponse(profile, auth.email),
      },
      {
        headers: {
          "x-request-id": requestId,
        },
      },
    );
  } catch (error) {
    logApiError({
      route: "/api/user-profile",
      method: "GET",
      error,
      requestId,
      context: { email: auth.email },
    });
    const message = getApiErrorMessage(error, "Failed to load user profile");
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

export async function PUT(request: Request) {
  const requestId = getOrCreateRequestId(request);

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
        requestId,
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(rateLimit.retryAfterSeconds),
          "x-request-id": requestId,
        },
      },
    );
  }

  const auth = await requireSession();
  if ("error" in auth) {
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

  try {
    await connectToDatabase();
    await collapseDuplicateProfilesByEmail(auth.email);

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
          .map((item) => item.trim())
          .filter(Boolean)
      : undefined;

    const nextJoinedCommunityIds = Array.isArray(nextJoinedCommunities)
      ? await resolveJoinedCommunityIds(nextJoinedCommunities)
      : undefined;

    const actorProfile = await UserProfileModel.findOne(
      { email: auth.email },
      { _id: 1 },
    ).lean();
    const actorProfileId = toObjectId(
      actorProfile && "_id" in actorProfile ? String(actorProfile._id) : null,
    );

    const nextSet: ProfileUpdateSet = {
      name: nextName,
      image: nextImage,
      bio: nextBio,
      lastLoginAt: new Date(),
      provider: auth.session?.provider ?? "google",
    };

    if (actorProfileId) {
      nextSet.lastUpdatedBy = actorProfileId;
    }

    if (Array.isArray(nextJoinedCommunityIds)) {
      nextSet.joinedCommunities = nextJoinedCommunityIds;
    }

    const setOnInsert: ProfileSetOnInsert = {
      email: auth.email,
    };

    if (!Array.isArray(nextJoinedCommunityIds)) {
      setOnInsert.joinedCommunities = [];
    }

    if (nextName.length > 120) {
      return NextResponse.json(
        { error: "Name must be 120 characters or fewer.", requestId },
        {
          status: 400,
          headers: {
            "x-request-id": requestId,
          },
        },
      );
    }

    if (nextBio.length > 500) {
      return NextResponse.json(
        { error: "Bio must be 500 characters or fewer.", requestId },
        {
          status: 400,
          headers: {
            "x-request-id": requestId,
          },
        },
      );
    }

    if (!isValidImageUrl(nextImage)) {
      return NextResponse.json(
        { error: "Image must be a valid http(s) URL.", requestId },
        {
          status: 400,
          headers: {
            "x-request-id": requestId,
          },
        },
      );
    }

    let profile: PersistedProfile | null = null;

    try {
      profile = await UserProfileModel.findOneAndUpdate(
        { email: auth.email },
        {
          $setOnInsert: setOnInsert,
          $set: nextSet,
        },
        {
          upsert: true,
          returnDocument: "after",
        },
      )
        .populate("joinedCommunities", "name")
        .lean();
    } catch (error) {
      if (!isDuplicateKeyError(error as { code?: number } | Error | null | undefined)) {
        throw error;
      }

      await UserProfileModel.updateOne(
        { email: auth.email },
        { $set: nextSet },
      );
      profile = await UserProfileModel.findOne({ email: auth.email })
        .populate("joinedCommunities", "name")
        .lean();
    }

    if (profile && Array.isArray(profile.joinedCommunities) && profile.joinedCommunities.length > 0) {
      const hasLegacyNames = profile.joinedCommunities.some(
        (item: JoinedCommunityValue) =>
          typeof item === "string",
      );
      if (hasLegacyNames) {
        const legacyNames = profile.joinedCommunities
          .filter(
            (item: JoinedCommunityValue): item is string =>
              typeof item === "string",
          )
          .map((item: string) => item.trim())
          .filter(Boolean);
        const migratedIds = await resolveJoinedCommunityIds(legacyNames);
        await UserProfileModel.updateOne(
          { email: auth.email },
          {
            $set: {
              joinedCommunities: migratedIds,
            },
          },
        );
        profile = await UserProfileModel.findOne({ email: auth.email })
          .populate("joinedCommunities", "name")
          .lean();
      }
    }

    profile = await ensureProfileAuditIds(
      profile as PersistedProfile | null,
      actorProfileId,
    );

    return NextResponse.json(
      {
        requestId,
        ...toProfileResponse(profile, auth.email),
      },
      {
        headers: {
          "x-request-id": requestId,
        },
      },
    );
  } catch (error) {
    logApiError({
      route: "/api/user-profile",
      method: "PUT",
      error,
      requestId,
      context: { email: auth.email },
    });
    const message = getApiErrorMessage(error, "Failed to update user profile");
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

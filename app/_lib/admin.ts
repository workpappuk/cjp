import { getServerSession } from "next-auth";
import { Types } from "mongoose";
import { authOptions } from "@/app/_lib/auth";
import { UserProfileModel } from "@/app/_lib/models/UserProfile";

export type SessionActor = {
  email: string;
  profileId: Types.ObjectId | null;
  isAdmin: boolean;
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function toObjectId(value: Types.ObjectId | string | null | undefined) {
  if (!value) {
    return null;
  }

  if (value instanceof Types.ObjectId) {
    return value;
  }

  if (!Types.ObjectId.isValid(value)) {
    return null;
  }

  return new Types.ObjectId(value);
}

export async function getSessionActor(): Promise<SessionActor | null> {
  const session = await getServerSession(authOptions);
  const rawEmail = session?.user?.email ?? "";
  const email = normalizeEmail(rawEmail);

  if (!email) {
    return null;
  }

  const profile = await UserProfileModel.findOne({ email }, { _id: 1, isAdmin: 1 })
    .sort({ updatedAt: -1, createdAt: -1, _id: -1 })
    .lean();

  return {
    email,
    profileId: toObjectId(profile?._id),
    isAdmin: Boolean(profile?.isAdmin),
  };
}

export async function getSessionActorProfileId() {
  const actor = await getSessionActor();
  return actor?.profileId ?? null;
}

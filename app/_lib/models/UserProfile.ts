import "server-only";
import { Schema, model, models, type InferSchemaType } from "mongoose";
import { applyModelDeltaAuditPlugin } from "@/app/_lib/audit";

const userProfileSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 320,
    },
    name: {
      type: String,
      trim: true,
      default: "",
      maxlength: 120,
    },
    image: {
      type: String,
      trim: true,
      default: "",
      maxlength: 2048,
    },
    provider: {
      type: String,
      trim: true,
      default: "google",
      maxlength: 40,
    },
    isAdmin: {
      type: Boolean,
      default: false,
    },
    recordStatus: {
      type: String,
      enum: ["active", "deleted", "archived", "flagged"],
      default: "active",
      index: true,
    },
    bio: {
      type: String,
      trim: true,
      default: "",
      maxlength: 500,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "UserProfile",
      default: null,
    },
    lastUpdatedBy: {
      type: Schema.Types.ObjectId,
      ref: "UserProfile",
      default: null,
    },
    joinedCommunities: {
      type: [{ type: Schema.Types.ObjectId, ref: "Community" }],
      default: [],
    },
    lastLoginAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    versionKey: "__v",
    optimisticConcurrency: true,
  },
);

userProfileSchema.plugin(applyModelDeltaAuditPlugin, {
  source: "user-profile",
  ignorePaths: ["lastLoginAt"],
});

export type UserProfileDocument = InferSchemaType<typeof userProfileSchema>;

if (
  models.UserProfile &&
  (!models.UserProfile.schema.path("__v") ||
    !models.UserProfile.schema.path("isAdmin") ||
    !models.UserProfile.schema.path("recordStatus"))
) {
  delete models.UserProfile;
}

export const UserProfileModel =
  models.UserProfile || model("UserProfile", userProfileSchema);

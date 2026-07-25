import "server-only";
import { Schema, model, models, type InferSchemaType } from "mongoose";

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
    bio: {
      type: String,
      trim: true,
      default: "",
      maxlength: 500,
    },
    joinedCommunities: {
      type: [String],
      default: [],
    },
    lastLoginAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

export type UserProfileDocument = InferSchemaType<typeof userProfileSchema>;

export const UserProfileModel =
  models.UserProfile || model("UserProfile", userProfileSchema);

import "server-only";
import { Schema, model, models, type InferSchemaType } from "mongoose";

const communitySchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      minlength: 3,
      maxlength: 64,
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
    tags: {
      type: [{ type: Schema.Types.ObjectId, ref: "Tag" }],
      default: [],
    },
    moderationStatus: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "approved",
      index: true,
    },
    approvedAt: {
      type: Date,
      default: null,
    },
    approvedBy: {
      type: Schema.Types.ObjectId,
      ref: "UserProfile",
      default: null,
    },
    recordStatus: {
      type: String,
      enum: ["active", "deleted", "archived", "flagged"],
      default: "active",
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

communitySchema.index({ tags: 1 });
communitySchema.index({ moderationStatus: 1, createdAt: -1 });
communitySchema.index({ recordStatus: 1, createdAt: -1 });

export type CommunityDocument = InferSchemaType<typeof communitySchema>;

// Hot-reload safety: if an older cached model lacks `tags`, rebuild it.
if (
  models.Community &&
  (!models.Community.schema.path("tags") ||
    !models.Community.schema.path("moderationStatus") ||
    !models.Community.schema.path("recordStatus"))
) {
  delete models.Community;
}

export const CommunityModel =
  models.Community || model("Community", communitySchema);

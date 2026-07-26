import "server-only";
import { Schema, model, models, type InferSchemaType } from "mongoose";

const postSchema = new Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 200,
    },
    content: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 10000,
    },
    communities: {
      type: [{ type: Schema.Types.ObjectId, ref: "Community" }],
      default: [],
    },
    tags: {
      type: [{ type: Schema.Types.ObjectId, ref: "Tag" }],
      default: [],
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

postSchema.index({ createdAt: -1 });
postSchema.index({ communities: 1 });
postSchema.index({ tags: 1 });
postSchema.index({ moderationStatus: 1, createdAt: -1 });
postSchema.index({ recordStatus: 1, createdAt: -1 });

export type PostDocument = InferSchemaType<typeof postSchema>;

// Hot-reload safety: if an older cached model lacks `tags`, rebuild it.
if (
  models.Post &&
  (!models.Post.schema.path("tags") ||
    !models.Post.schema.path("moderationStatus") ||
    !models.Post.schema.path("recordStatus"))
) {
  delete models.Post;
}

export const PostModel = models.Post || model("Post", postSchema);

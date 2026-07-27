import "server-only";
import { Schema, model, models, type InferSchemaType } from "mongoose";
import { applyModelDeltaAuditPlugin } from "@/app/_lib/audit";

const commentSchema = new Schema(
  {
    targetType: {
      type: String,
      enum: ["Post", "Community"],
      required: true,
      index: true,
    },
    targetId: {
      type: Schema.Types.ObjectId,
      refPath: "targetType",
      required: true,
      index: true,
    },
    text: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 5000,
    },
    parentCommentId: {
      type: Schema.Types.ObjectId,
      ref: "Comment",
      default: null,
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
    versionKey: "__v",
    optimisticConcurrency: true,
  },
);

commentSchema.index({ targetType: 1, targetId: 1, createdAt: -1 });
commentSchema.index({ moderationStatus: 1, createdAt: -1 });
commentSchema.index({ recordStatus: 1, createdAt: -1 });
commentSchema.plugin(applyModelDeltaAuditPlugin, { source: "comments" });

export type CommentDocument = InferSchemaType<typeof commentSchema>;

if (
  models.Comment &&
  (!models.Comment.schema.path("__v") ||
    !models.Comment.schema.path("moderationStatus") ||
    !models.Comment.schema.path("recordStatus"))
) {
  delete models.Comment;
}

export const CommentModel =
  models.Comment || model("Comment", commentSchema);

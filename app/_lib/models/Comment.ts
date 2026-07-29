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
      default: "",
      trim: true,
      maxlength: 5000,
    },
    imageUrls: {
      type: [String],
      default: [],
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

commentSchema.pre("validate", function () {
  const rawText = typeof this.text === "string" ? this.text.trim() : "";
  const hasText = rawText.length > 0;

  const hasImages = Array.isArray(this.imageUrls)
    ? this.imageUrls.some((value) => typeof value === "string" && value.trim().length > 0)
    : false;

  if (!hasText && !hasImages) {
    this.invalidate("text", "Comment text or at least one image is required.");
  }

  if (!hasText) {
    this.text = "";
  }
});

commentSchema.plugin(applyModelDeltaAuditPlugin, { source: "comments" });

export type CommentDocument = InferSchemaType<typeof commentSchema>;

if (
  models.Comment &&
  (!models.Comment.schema.path("imageUrls") ||
    !models.Comment.schema.path("__v") ||
    !models.Comment.schema.path("moderationStatus") ||
    !models.Comment.schema.path("recordStatus"))
) {
  delete models.Comment;
}

export const CommentModel =
  models.Comment || model("Comment", commentSchema);

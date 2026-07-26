import "server-only";
import { Schema, model, models, type InferSchemaType } from "mongoose";

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
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

commentSchema.index({ targetType: 1, targetId: 1, createdAt: -1 });

export type CommentDocument = InferSchemaType<typeof commentSchema>;

export const CommentModel =
  models.Comment || model("Comment", commentSchema);

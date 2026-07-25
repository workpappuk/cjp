import "server-only";
import { Schema, model, models, type InferSchemaType } from "mongoose";

const commentSchema = new Schema(
  {
    postId: {
      type: Schema.Types.ObjectId,
      ref: "Post",
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
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

commentSchema.index({ postId: 1, createdAt: -1 });

export type CommentDocument = InferSchemaType<typeof commentSchema>;

export const CommentModel =
  models.Comment || model("Comment", commentSchema);

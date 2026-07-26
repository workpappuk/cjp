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
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

postSchema.index({ createdAt: -1 });
postSchema.index({ communities: 1 });
postSchema.index({ tags: 1 });

export type PostDocument = InferSchemaType<typeof postSchema>;

export const PostModel = models.Post || model("Post", postSchema);

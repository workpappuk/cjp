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
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

postSchema.index({ createdAt: -1 });
postSchema.index({ communities: 1 });

export type PostDocument = InferSchemaType<typeof postSchema>;

export const PostModel = models.Post || model("Post", postSchema);

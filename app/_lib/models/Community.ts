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
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

export type CommunityDocument = InferSchemaType<typeof communitySchema>;

export const CommunityModel =
  models.Community || model("Community", communitySchema);

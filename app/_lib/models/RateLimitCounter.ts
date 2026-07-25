import "server-only";
import { Schema, model, models, type InferSchemaType } from "mongoose";

const rateLimitCounterSchema = new Schema(
  {
    scope: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    clientId: {
      type: String,
      required: true,
      trim: true,
      maxlength: 256,
    },
    bucket: {
      type: Number,
      required: true,
      index: true,
    },
    count: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
  },
  {
    versionKey: false,
    timestamps: false,
    collection: "rate_limit_counters",
  },
);

rateLimitCounterSchema.index(
  { scope: 1, clientId: 1, bucket: 1 },
  { unique: true },
);

rateLimitCounterSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0 },
);

export type RateLimitCounterDocument = InferSchemaType<
  typeof rateLimitCounterSchema
>;

export const RateLimitCounterModel =
  models.RateLimitCounter || model("RateLimitCounter", rateLimitCounterSchema);

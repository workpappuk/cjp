import "server-only";
import { Schema, model, models, type InferSchemaType } from "mongoose";
import { applyModelDeltaAuditPlugin } from "@/app/_lib/audit";

const voteSchema = new Schema(
  {
    targetType: {
      type: String,
      enum: ["Post", "Community", "Comment"],
      required: true,
      index: true,
    },
    targetId: {
      type: Schema.Types.ObjectId,
      refPath: "targetType",
      required: true,
      index: true,
    },
    actionType: {
      type: String,
      enum: ["upvote", "downvote", "like", "dislike"], // restrict to allowed values
      required: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "UserProfile",
      required: true,
    },
    lastUpdatedBy: {
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

// ✅ Compound unique index scoped to active votes
voteSchema.index(
  { createdBy: 1, actionType: 1, targetId: 1, targetType: 1, recordStatus: 1 },
  { unique: true, partialFilterExpression: { recordStatus: "active" } }
);

voteSchema.plugin(applyModelDeltaAuditPlugin, { source: "votes" });


export const VoteModel =
  models.Vote || model("Vote", voteSchema);

import "server-only";
import { Schema, model, models, type InferSchemaType } from "mongoose";

const tagSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 64,
      match: [/^\S+$/, "Tag must be a single word with no spaces."],
    },
    normalizedName: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      minlength: 1,
      maxlength: 64,
      match: [/^\S+$/, "Tag must be a single word with no spaces."],
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
    isActive: {
      type: Boolean,
      default: true,
      index: true,
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

tagSchema.index({ normalizedName: 1 }, { unique: true });
tagSchema.index({ recordStatus: 1, createdAt: -1 });

// Keep normalizedName in sync for uniqueness/filtering.
tagSchema.pre("validate", function syncNormalizedName() {
  if (typeof this.name === "string") {
    this.normalizedName = this.name.trim().toLowerCase();
  }
});

export type TagDocument = InferSchemaType<typeof tagSchema>;

if (models.Tag && !models.Tag.schema.path("recordStatus")) {
  delete models.Tag;
}

export const TagModel =
  models.Tag || model("Tag", tagSchema);

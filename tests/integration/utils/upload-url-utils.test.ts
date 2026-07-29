/** @vitest-environment node */

import { describe, expect, it } from "vitest";
import {
  sanitizeScopedUploadUrl,
  sanitizeScopedUploadUrls,
} from "@/app/_lib/upload-url";

describe("upload-url utils", () => {
  it("sanitizeScopedUploadUrl returns empty string for invalid inputs", () => {
    expect(sanitizeScopedUploadUrl(undefined, "post")).toBe("");
    expect(sanitizeScopedUploadUrl("", "post")).toBe("");
    expect(sanitizeScopedUploadUrl("/uploads/comment/2026/07/a.jpg", "post")).toBe("");
  });

  it("sanitizeScopedUploadUrl keeps valid scoped upload path", () => {
    expect(sanitizeScopedUploadUrl(" /uploads/post/2026/07/a.jpg ", "post")).toBe(
      "/uploads/post/2026/07/a.jpg",
    );
  });

  it("sanitizeScopedUploadUrls dedupes, filters by scope, and caps results", () => {
    const input = [
      "/uploads/comment/1.jpg",
      "/uploads/comment/1.jpg",
      "/uploads/comment/2.jpg",
      "/uploads/post/3.jpg",
      123,
      null,
      "/uploads/comment/4.jpg",
      "/uploads/comment/5.jpg",
      "/uploads/comment/6.jpg",
      "/uploads/comment/7.jpg",
    ];

    expect(sanitizeScopedUploadUrls(input, "comment", 3)).toEqual([
      "/uploads/comment/1.jpg",
      "/uploads/comment/2.jpg",
      "/uploads/comment/4.jpg",
    ]);
  });
});

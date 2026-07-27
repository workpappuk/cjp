import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  attachTagsToTarget,
  dedupeTagNames,
  normalizeTagName,
} from "@/app/_utils/tags";

const apiFetchWithConflictRetryMock = vi.hoisted(() => vi.fn());

vi.mock("@/app/_utils/api", () => ({
  apiFetchWithConflictRetry: apiFetchWithConflictRetryMock,
}));

describe("tags utils", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("normalizes tag name", () => {
    expect(normalizeTagName("  ReAct  ")).toBe("react");
  });

  it("dedupes and normalizes tag names", () => {
    const result = dedupeTagNames([" React ", "react", "NEXT", "next", ""]);
    expect(result).toEqual(["react", "next"]);
  });

  it("returns no retry when no tags", async () => {
    const result = await attachTagsToTarget({
      targetType: "Post",
      targetId: "id-1",
      tags: ["", "   "],
    });

    expect(result).toEqual({ didRetry: false });
    expect(apiFetchWithConflictRetryMock).not.toHaveBeenCalled();
  });

  it("posts deduped tags and reports retry status", async () => {
    apiFetchWithConflictRetryMock
      .mockResolvedValueOnce({ didRetry: false, response: new Response(null, { status: 201 }) })
      .mockResolvedValueOnce({ didRetry: true, response: new Response(null, { status: 201 }) });

    const result = await attachTagsToTarget({
      targetType: "Community",
      targetId: "community-1",
      tags: ["React", "react", "Next"],
    });

    expect(apiFetchWithConflictRetryMock).toHaveBeenCalledTimes(2);
    expect(apiFetchWithConflictRetryMock).toHaveBeenNthCalledWith(
      1,
      "/api/tags",
      expect.objectContaining({ method: "POST" }),
      { retries: 1 },
    );
    expect(result).toEqual({ didRetry: true });
  });
});

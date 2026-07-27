import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  apiFetch,
  apiFetchWithConflictRetry,
  updateJoinedCommunitiesWithConflictRetry,
} from "@/app/_utils/api";

const withAuthFetchInitMock = vi.hoisted(() => vi.fn((init?: RequestInit) => init ?? {}));

vi.mock("@/app/_utils/auth", () => ({
  withAuthFetchInit: withAuthFetchInitMock,
}));

describe("api utility helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("apiFetch delegates to fetch with auth init", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await apiFetch("/api/demo", { method: "GET" });

    expect(withAuthFetchInitMock).toHaveBeenCalledWith({ method: "GET" });
    expect(fetchMock).toHaveBeenCalledWith("/api/demo", { method: "GET" });
  });

  it("apiFetchWithConflictRetry retries on 409 and calls onConflict", async () => {
    const conflict = new Response(null, { status: 409 });
    const success = new Response(null, { status: 200 });
    const onConflict = vi.fn();

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(conflict)
      .mockResolvedValueOnce(success);
    vi.stubGlobal("fetch", fetchMock);

    const result = await apiFetchWithConflictRetry("/api/retry", { method: "PUT" }, { retries: 1, onConflict });

    expect(result.response.status).toBe(200);
    expect(result.didRetry).toBe(true);
    expect(onConflict).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("apiFetchWithConflictRetry does not retry non-409 responses", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 500 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await apiFetchWithConflictRetry("/api/fail", { method: "GET" }, { retries: 2 });

    expect(result.response.status).toBe(500);
    expect(result.didRetry).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("apiFetchWithConflictRetry uses default retries when options are omitted", async () => {
    const conflict = new Response(null, { status: 409 });
    const success = new Response(null, { status: 200 });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(conflict)
      .mockResolvedValueOnce(success);
    vi.stubGlobal("fetch", fetchMock);

    const result = await apiFetchWithConflictRetry("/api/default", { method: "PATCH" });

    expect(result.response.status).toBe(200);
    expect(result.didRetry).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("apiFetchWithConflictRetry honors zero retries", async () => {
    const conflict = new Response(null, { status: 409 });
    const fetchMock = vi.fn().mockResolvedValue(conflict);
    vi.stubGlobal("fetch", fetchMock);

    const result = await apiFetchWithConflictRetry("/api/no-retry", { method: "PUT" }, { retries: 0 });

    expect(result.response.status).toBe(409);
    expect(result.didRetry).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("updateJoinedCommunitiesWithConflictRetry returns first success", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await updateJoinedCommunitiesWithConflictRetry({
      nextJoinedCommunities: ["General", "general", "Tech"],
      retries: 1,
    });

    expect(result.response.status).toBe(200);
    expect(result.didRetry).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("updateJoinedCommunitiesWithConflictRetry merges latest on conflict", async () => {
    const conflict = new Response(JSON.stringify({ error: "conflict" }), { status: 409 });
    const latest = new Response(JSON.stringify({ joinedCommunities: ["general", "news"] }), { status: 200 });
    const success = new Response(JSON.stringify({ ok: true }), { status: 200 });

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(conflict)
      .mockResolvedValueOnce(latest)
      .mockResolvedValueOnce(success);
    vi.stubGlobal("fetch", fetchMock);

    const result = await updateJoinedCommunitiesWithConflictRetry({
      nextJoinedCommunities: ["tech"],
      retries: 1,
      mergeOnConflict: (latestJoined, intended) => [...latestJoined, ...intended],
    });

    expect(result.response.status).toBe(200);
    expect(result.didRetry).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(3);

    const finalPutInit = fetchMock.mock.calls[2]?.[1] as RequestInit;
    expect(finalPutInit.method).toBe("PUT");
    expect(String(finalPutInit.body)).toContain("general");
    expect(String(finalPutInit.body)).toContain("news");
    expect(String(finalPutInit.body)).toContain("tech");
  });

  it("updateJoinedCommunitiesWithConflictRetry exits when latest fetch fails", async () => {
    const conflict = new Response(JSON.stringify({ error: "conflict" }), { status: 409 });
    const latestFail = new Response(JSON.stringify({ error: "down" }), { status: 500 });

    const fetchMock = vi.fn().mockResolvedValueOnce(conflict).mockResolvedValueOnce(latestFail);
    vi.stubGlobal("fetch", fetchMock);

    const result = await updateJoinedCommunitiesWithConflictRetry({
      nextJoinedCommunities: ["tech"],
      retries: 1,
    });

    expect(result.response.status).toBe(409);
    expect(result.didRetry).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("updateJoinedCommunitiesWithConflictRetry uses default merge behavior", async () => {
    const conflict = new Response(JSON.stringify({ error: "conflict" }), { status: 409 });
    const latest = new Response(JSON.stringify({ joinedCommunities: ["general"] }), { status: 200 });
    const success = new Response(JSON.stringify({ ok: true }), { status: 200 });

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(conflict)
      .mockResolvedValueOnce(latest)
      .mockResolvedValueOnce(success);
    vi.stubGlobal("fetch", fetchMock);

    const result = await updateJoinedCommunitiesWithConflictRetry({
      nextJoinedCommunities: ["tech"],
      retries: 1,
    });

    expect(result.response.status).toBe(200);
    expect(result.didRetry).toBe(true);

    const finalPutInit = fetchMock.mock.calls[2]?.[1] as RequestInit;
    expect(String(finalPutInit.body)).toContain("general");
    expect(String(finalPutInit.body)).toContain("tech");
  });

  it("updateJoinedCommunitiesWithConflictRetry honors zero retries", async () => {
    const conflict = new Response(JSON.stringify({ error: "conflict" }), { status: 409 });
    const fetchMock = vi.fn().mockResolvedValueOnce(conflict);
    vi.stubGlobal("fetch", fetchMock);

    const result = await updateJoinedCommunitiesWithConflictRetry({
      nextJoinedCommunities: ["tech"],
      retries: 0,
    });

    expect(result.response.status).toBe(409);
    expect(result.didRetry).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

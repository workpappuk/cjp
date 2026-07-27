import { withAuthFetchInit } from "@/app/_utils/auth";

export async function apiFetch(input: RequestInfo | URL, init?: RequestInit) {
  return fetch(input, withAuthFetchInit(init));
}

type ConflictRetryOptions = {
  retries?: number;
  onConflict?: () => Promise<void> | void;
};

export type ConflictRetryResult = {
  response: Response;
  didRetry: boolean;
};

type UserProfilePayload = {
  joinedCommunities?: string[];
};

function normalizeJoinedCommunities(values: string[]) {
  return [...new Set(values.map((value) => value.trim().toLowerCase()).filter(Boolean))];
}

export async function apiFetchWithConflictRetry(
  input: RequestInfo | URL,
  init?: RequestInit,
  options?: ConflictRetryOptions,
): Promise<ConflictRetryResult> {
  const retries = Math.max(0, options?.retries ?? 1);
  let attempt = 0;
  let didRetry = false;

  while (true) {
    const response = await apiFetch(input, init);

    if (response.status !== 409 || attempt >= retries) {
      return { response, didRetry };
    }

    attempt += 1;
    didRetry = true;
    await options?.onConflict?.();
  }
}

export async function updateJoinedCommunitiesWithConflictRetry(options: {
  nextJoinedCommunities: string[];
  retries?: number;
  mergeOnConflict?: (latest: string[], intended: string[]) => string[];
}): Promise<ConflictRetryResult> {
  const retries = Math.max(0, options.retries ?? 1);
  let attempt = 0;
  let didRetry = false;
  let intended = normalizeJoinedCommunities(options.nextJoinedCommunities);

  while (true) {
    const response = await apiFetch("/api/user-profile", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ joinedCommunities: intended }),
    });

    if (response.status !== 409 || attempt >= retries) {
      return { response, didRetry };
    }

    attempt += 1;
    didRetry = true;

    const latestResponse = await apiFetch("/api/user-profile", { cache: "no-store" });
    if (!latestResponse.ok) {
      return { response, didRetry };
    }

    const latestPayload = (await latestResponse.json()) as UserProfilePayload;
    const latestJoined = normalizeJoinedCommunities(latestPayload.joinedCommunities ?? []);

    intended = normalizeJoinedCommunities(
      options.mergeOnConflict
        ? options.mergeOnConflict(latestJoined, intended)
        : [...latestJoined, ...intended],
    );
  }
}

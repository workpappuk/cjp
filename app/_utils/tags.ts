import { apiFetchWithConflictRetry } from "@/app/_utils/api";

export type TagTargetType = "Post" | "Community";

export function normalizeTagName(name: string) {
  return name.trim().toLowerCase();
}

export function dedupeTagNames(tags: string[]) {
  const unique = new Set<string>();

  for (const tag of tags) {
    const normalized = normalizeTagName(tag);
    if (normalized) {
      unique.add(normalized);
    }
  }

  return [...unique];
}

export async function attachTagsToTarget(options: {
  targetType: TagTargetType;
  targetId: string;
  tags: string[];
}) {
  const names = dedupeTagNames(options.tags);

  if (names.length === 0) {
    return { didRetry: false };
  }

  const results = await Promise.allSettled(
    names.map((name) =>
      apiFetchWithConflictRetry(
        "/api/tags",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name,
            targetType: options.targetType,
            targetId: options.targetId,
          }),
        },
        { retries: 1 },
      ),
    ),
  );

  const didRetry = results.some(
    (result) => result.status === "fulfilled" && result.value.didRetry,
  );

  return { didRetry };
}
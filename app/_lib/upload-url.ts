import "server-only";

import type { UploadScope } from "@/app/_types/uploads";

export const MAX_SCOPED_IMAGE_URLS = 6;

export function sanitizeScopedUploadUrl(value: unknown, scope: UploadScope) {
  if (typeof value !== "string") {
    return "";
  }

  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 2048) {
    return "";
  }

  return trimmed.startsWith(`/uploads/${scope}/`) ? trimmed : "";
}

export function sanitizeScopedUploadUrls(
  input: unknown,
  scope: UploadScope,
  maxCount = MAX_SCOPED_IMAGE_URLS,
) {
  if (!Array.isArray(input)) {
    return [] as string[];
  }

  const deduped = new Set<string>();

  for (const value of input) {
    const normalized = sanitizeScopedUploadUrl(value, scope);
    if (!normalized) {
      continue;
    }

    deduped.add(normalized);
    if (deduped.size >= maxCount) {
      break;
    }
  }

  return [...deduped];
}

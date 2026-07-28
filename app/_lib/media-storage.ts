import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, readdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { UPLOAD_SCOPES, type UploadScope } from "@/app/_types/uploads";

const UPLOADS_ROOT_DIR = path.join(process.cwd(), "public", "uploads");

export const MAX_IMAGE_UPLOAD_BYTES = 5 * 1024 * 1024;
export const MAX_IMAGE_UPLOAD_COUNT = 6;

const MIME_EXTENSION_MAP: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

async function walkDirectory(rootDir: string): Promise<string[]> {
  const entries = await readdir(rootDir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const entryPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkDirectory(entryPath)));
      continue;
    }

    if (entry.isFile()) {
      files.push(entryPath);
    }
  }

  return files;
}

function normalizeFileName(input: string) {
  return input.toLowerCase().replace(/[^a-z0-9-_]+/g, "-").replace(/^-+|-+$/g, "");
}

export function isSupportedUploadScope(value: string): value is UploadScope {
  return (UPLOAD_SCOPES as readonly string[]).includes(value);
}

export function isSupportedImageMimeType(value: string) {
  return Boolean(MIME_EXTENSION_MAP[value]);
}

export async function storeUploadedImage(params: {
  file: File;
  scope: UploadScope;
}) {
  const { file, scope } = params;

  if (!isSupportedImageMimeType(file.type)) {
    throw new Error("Unsupported image type.");
  }

  if (file.size > MAX_IMAGE_UPLOAD_BYTES) {
    throw new Error("Image exceeds size limit.");
  }

  const extension = MIME_EXTENSION_MAP[file.type];
  const originalBase = normalizeFileName(path.parse(file.name).name) || "image";
  const now = new Date();
  const year = String(now.getUTCFullYear());
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const fileName = `${Date.now()}-${randomUUID()}-${originalBase}.${extension}`;

  const relativeDir = path.posix.join("uploads", scope, year, month);
  const diskDir = path.join(UPLOADS_ROOT_DIR, scope, year, month);
  const relativeFilePath = path.posix.join(relativeDir, fileName);
  const diskFilePath = path.join(diskDir, fileName);

  await mkdir(diskDir, { recursive: true });
  const bytes = Buffer.from(await file.arrayBuffer());
  await writeFile(diskFilePath, bytes);

  return {
    url: `/${relativeFilePath}`,
    size: file.size,
    mimeType: file.type,
  };
}

export async function listStoredUploadUrls(scope: UploadScope) {
  const scopeRoot = path.join(UPLOADS_ROOT_DIR, scope);

  try {
    const files = await walkDirectory(scopeRoot);
    return files
      .map((filePath) => path.relative(path.join(process.cwd(), "public"), filePath))
      .map((relativePath) => `/${relativePath.split(path.sep).join("/")}`)
      .filter((value) => value.startsWith(`/uploads/${scope}/`));
  } catch (error) {
    const code = (error as NodeJS.ErrnoException)?.code;
    if (code === "ENOENT") {
      return [] as string[];
    }
    throw error;
  }
}

export async function deleteStoredUploadUrl(url: string) {
  const normalized = url.trim();
  if (!normalized.startsWith("/uploads/")) {
    return false;
  }

  const relativePath = normalized.slice(1);
  const diskPath = path.join(process.cwd(), "public", relativePath);

  try {
    await unlink(diskPath);
    return true;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException)?.code;
    if (code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

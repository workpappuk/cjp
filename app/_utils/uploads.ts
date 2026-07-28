import type { UploadScope } from "@/app/_types/uploads";

type UploadResponse = {
  files?: Array<{
    url?: string;
  }>;
  error?: string;
};

export async function uploadImageFiles(params: {
  scope: UploadScope;
  files: File[];
}) {
  const { scope, files } = params;
  if (files.length === 0) {
    return [] as string[];
  }

  const formData = new FormData();
  formData.set("scope", scope);
  for (const file of files) {
    formData.append("files", file);
  }

  const response = await fetch("/api/uploads", {
    method: "POST",
    body: formData,
  });

  const payload = (await response.json()) as UploadResponse;

  if (!response.ok) {
    throw new Error(payload.error ?? "Failed to upload image.");
  }

  return Array.isArray(payload.files)
    ? payload.files
        .map((item) => item.url?.trim() ?? "")
        .filter(Boolean)
    : [];
}

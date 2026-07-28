"use client";

import type { ChangeEvent } from "react";
import { useMemo, useState } from "react";
import { HiPhoto, HiXMark } from "react-icons/hi2";
import { Button, Chip, Spinner, Typography } from "@/app/_types/mtw";
import type { UploadScope } from "@/app/_types/uploads";
import { uploadImageFiles } from "@/app/_utils/uploads";

type ImageUploadFieldProps = {
  value: string[];
  onChange: (next: string[]) => void;
  scope: UploadScope;
  disabled?: boolean;
  color?: string;
  label?: string;
  helperText?: string;
  maxImages?: number;
};

export default function ImageUploadField({
  value,
  onChange,
  scope,
  disabled = false,
  color = "blue",
  label = "Images",
  helperText = "Upload jpg, png, webp, or gif files up to 5MB each.",
  maxImages = 6,
}: ImageUploadFieldProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [pendingDeleteUrl, setPendingDeleteUrl] = useState<string | null>(null);

  const canUpload = useMemo(() => {
    return !disabled && !isUploading && value.length < maxImages;
  }, [disabled, isUploading, maxImages, value.length]);

  const handleFilesSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const incoming = Array.from(event.target.files ?? []);
    event.target.value = "";

    if (incoming.length === 0) {
      return;
    }

    const availableSlots = Math.max(maxImages - value.length, 0);
    if (availableSlots <= 0) {
      setErrorMessage(`You can upload up to ${maxImages} images.`);
      return;
    }

    const candidateFiles = incoming.slice(0, availableSlots);
    setErrorMessage("");
    setIsUploading(true);

    try {
      const uploadedUrls = await uploadImageFiles({
        scope,
        files: candidateFiles,
      });
      onChange([...value, ...uploadedUrls]);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to upload image.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveClick = (url: string) => {
    if (pendingDeleteUrl !== url) {
      setPendingDeleteUrl(url);
      return;
    }

    onChange(value.filter((item) => item !== url));
    setPendingDeleteUrl(null);
  };

  const handleCancelRemove = () => {
    setPendingDeleteUrl(null);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Typography variant="small" className="font-medium text-slate-700 dark:text-slate-300">
          {label}
        </Typography>
        <Chip
          value={`${value.length}/${maxImages}`}
          size="sm"
          variant="ghost"
          color={color}
          className="rounded-full"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="inline-flex">
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            multiple
            onChange={handleFilesSelected}
            className="hidden"
            disabled={!canUpload}
          />
          <span
            className={`inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition ${
              canUpload
                ? "border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                : "cursor-not-allowed border-slate-200 text-slate-400 dark:border-slate-700 dark:text-slate-500"
            }`}
          >
            {isUploading ? <Spinner className="h-4 w-4" /> : <HiPhoto className="h-4 w-4" />}
            {isUploading ? "Uploading..." : "Add images"}
          </span>
        </label>

        <Typography variant="small" className="text-slate-500 dark:text-slate-400">
          {helperText}
        </Typography>
      </div>

      {errorMessage ? (
        <Typography variant="small" className="text-red-600 dark:text-red-400">
          {errorMessage}
        </Typography>
      ) : null}

      {value.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {value.map((url, index) => (
            <div key={url} className="overflow-hidden rounded-xl border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800">
              <img
                src={url}
                alt={`Uploaded preview ${index + 1}`}
                className="h-28 w-full object-cover"
                loading="lazy"
              />

              <div className="flex items-center justify-between gap-2 border-t border-slate-200 bg-white px-2 py-1.5 dark:border-slate-700 dark:bg-slate-900">
                <Typography variant="small" className="text-xs text-slate-600 dark:text-slate-300">
                  Image {index + 1}
                </Typography>

                <div className="inline-flex items-center gap-1">
                  {pendingDeleteUrl === url ? (
                    <Button
                      size="sm"
                      variant="text"
                      color="blue-gray"
                      className="inline-flex min-w-0 items-center rounded-md px-2 py-1 text-xs normal-case"
                      onClick={handleCancelRemove}
                      aria-label={`Cancel removing image ${index + 1}`}
                    >
                      Cancel
                    </Button>
                  ) : null}

                  <Button
                    size="sm"
                    variant="text"
                    color="red"
                    className="inline-flex min-w-0 items-center gap-1 rounded-md px-2 py-1 text-xs normal-case"
                    onClick={() => handleRemoveClick(url)}
                    aria-label={
                      pendingDeleteUrl === url
                        ? `Confirm removing image ${index + 1}`
                        : `Remove image ${index + 1}`
                    }
                  >
                    <HiXMark className="h-3.5 w-3.5" />
                    {pendingDeleteUrl === url ? "Confirm" : "Remove"}
                  </Button>
                </div>
              </div>

              {pendingDeleteUrl === url ? (
                <div className="border-t border-red-200 bg-red-50 px-2 py-1 dark:border-red-900/50 dark:bg-red-900/20">
                  <Typography variant="small" className="text-xs text-red-700 dark:text-red-300">
                    Tap confirm to delete this image.
                  </Typography>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

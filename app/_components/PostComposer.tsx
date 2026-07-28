"use client";

import type { ChangeEvent, FormEvent, ReactNode } from "react";
import { Button, Input, Typography } from "@/app/_types/mtw";
import ImageUploadField from "@/app/_components/ImageUploadField";
import type { UploadScope } from "@/app/_types/uploads";

type PostComposerProps = {
  heading?: string;
  title: string;
  content: string;
  onTitleChange: (value: string) => void;
  onContentChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  disabled: boolean;
  buttonLabel?: string;
  helperText?: string;
  color?: string;
  contentLabel?: string;
  contentPlaceholder?: string;
  contentRows?: number;
  imageUrls?: string[];
  onImageUrlsChange?: (next: string[]) => void;
  imageUploadScope?: UploadScope;
  imageUploadMax?: number;
  imageUploadDisabled?: boolean;
  extraSection?: ReactNode;
};

export default function PostComposer({
  heading,
  title,
  content,
  onTitleChange,
  onContentChange,
  onSubmit,
  disabled,
  buttonLabel = "Publish Post",
  helperText,
  color = "blue",
  contentLabel = "Post content",
  contentPlaceholder = "Share your thoughts with the community...",
  contentRows = 5,
  imageUrls = [],
  onImageUrlsChange,
  imageUploadScope = "post",
  imageUploadMax = 6,
  imageUploadDisabled = false,
  extraSection,
}: PostComposerProps) {
  return (
    <div className="space-y-4">
      {heading ? (
        <Typography variant="h5" className="text-blue-gray-900 dark:text-slate-100">
          {heading}
        </Typography>
      ) : null}

      <form className="space-y-4" onSubmit={onSubmit}>
        <Input
          variant="standard"

          label="Post title"
          value={title}
          onChange={(event: ChangeEvent<HTMLInputElement>) => onTitleChange(event.target.value)}
          crossOrigin={undefined}
          color={color}
        />

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
            {contentLabel}
          </label>
          <textarea
            className="w-full rounded-xl border border-slate-300 bg-white p-3 text-sm text-slate-800 outline-none focus:border-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-slate-500"
            rows={contentRows}
            placeholder={contentPlaceholder}
            value={content}
            onChange={(event: ChangeEvent<HTMLTextAreaElement>) => onContentChange(event.target.value)}
          />
        </div>

        {onImageUrlsChange ? (
          <ImageUploadField
            value={imageUrls}
            onChange={onImageUrlsChange}
            scope={imageUploadScope}
            maxImages={imageUploadMax}
            color={color}
            disabled={imageUploadDisabled}
            label="Post images"
          />
        ) : null}

        {extraSection}

        {helperText ? (
          <Typography variant="small" className="text-slate-500 dark:text-slate-400">
            {helperText}
          </Typography>
        ) : null}

        <Button color={color} type="submit" disabled={disabled}>
          {buttonLabel}
        </Button>
      </form>
    </div>
  );
}

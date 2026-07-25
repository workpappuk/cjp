"use client";

import type { ChangeEvent, FormEvent } from "react";
import { Button, Input, Typography } from "@/app/_types/mtw";

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
}: PostComposerProps) {
  return (
    <div className="space-y-4">
      {heading ? (
        <Typography variant="h5" className="text-blue-gray-900">
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
          <label className="mb-2 block text-sm font-medium text-slate-700">
            {contentLabel}
          </label>
          <textarea
            className="w-full rounded-xl border border-slate-300 bg-white p-3 text-sm text-slate-800 outline-none focus:border-slate-400"
            rows={contentRows}
            placeholder={contentPlaceholder}
            value={content}
            onChange={(event: ChangeEvent<HTMLTextAreaElement>) => onContentChange(event.target.value)}
          />
        </div>

        {helperText ? (
          <Typography variant="small" className="text-slate-500">
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

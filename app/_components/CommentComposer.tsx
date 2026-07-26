"use client";

import type { ChangeEvent, FormEvent } from "react";
import { Button, Input, Typography } from "@/app/_types/mtw";

type CommentComposerProps = {
  commentText: string;
  onCommentTextChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  canComment: boolean;
  submitDisabled: boolean;
  joinPrompt?: string;
  joinButtonLabel?: string;
  onJoin?: () => void;
  color?: string;
};

function getPromptClasses(color: string) {
  if (color === "green") {
    return "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800/80 dark:bg-emerald-900/20 dark:text-emerald-200";
  }

  if (color === "orange") {
    return "border-orange-200 bg-orange-50 text-orange-900 dark:border-orange-800/80 dark:bg-orange-900/20 dark:text-orange-200";
  }

  return "border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-800/80 dark:bg-blue-900/20 dark:text-blue-200";
}

export default function CommentComposer({
  commentText,
  onCommentTextChange,
  onSubmit,
  canComment,
  submitDisabled,
  joinPrompt,
  joinButtonLabel,
  onJoin,
  color = "blue",
}: CommentComposerProps) {
  const promptClasses = getPromptClasses(color);

  return (
    <form className="space-y-3" onSubmit={onSubmit}>
      <Input
        label="Add a comment"
        value={commentText}
        onChange={(event: ChangeEvent<HTMLInputElement>) =>
          onCommentTextChange(event.target.value)
        }
        variant="standard"
        color={color}
        disabled={!canComment}
      />

      {!canComment && joinPrompt ? (
        <div className={`space-y-2 rounded-xl border p-3 ${promptClasses}`}>
          <Typography variant="small" className="text-current">
            {joinPrompt}
          </Typography>

          {onJoin && joinButtonLabel ? (
            <Button size="sm" color={color} type="button" onClick={onJoin}>
              {joinButtonLabel}
            </Button>
          ) : null}
        </div>
      ) : null}

      <Button type="submit" color={color} disabled={!canComment || submitDisabled}>
        Post Comment
      </Button>
    </form>
  );
}

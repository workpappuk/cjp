"use client";

import { Button, Input, Typography } from "@material-tailwind/react";

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
}) {
  return (
    <form className="space-y-3" onSubmit={onSubmit}>
      <Input
        label="Add a comment"
        value={commentText}
        onChange={(event) => onCommentTextChange(event.target.value)}
        crossOrigin={undefined}
        color={color}
        disabled={!canComment}
      />

      {!canComment && joinPrompt ? (
        <div className="space-y-2 rounded-xl border border-blue-100 bg-blue-50 p-3">
          <Typography variant="small" className="text-blue-gray-800">
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

import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { FormEvent } from "react";
import CommentComposer from "@/app/_components/CommentComposer";
import { renderWithProviders } from "@/tests/utils/test-helpers";

describe("CommentComposer integration", () => {
  it("posts comment when enabled", async () => {
    const user = userEvent.setup();
    const onCommentTextChange = vi.fn();
    const onSubmit = vi.fn((event: FormEvent<HTMLFormElement>) => event.preventDefault());

    renderWithProviders(
      <CommentComposer
        commentText=""
        onCommentTextChange={onCommentTextChange}
        onSubmit={onSubmit}
        canComment
        submitDisabled={false}
      />,
    );

    await user.type(screen.getByLabelText(/add a comment/i), "Hello");
    expect(onCommentTextChange).toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: /post comment/i }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("shows join prompt and join action when commenting is blocked", async () => {
    const user = userEvent.setup();
    const onJoin = vi.fn();

    renderWithProviders(
      <CommentComposer
        commentText=""
        onCommentTextChange={vi.fn()}
        onSubmit={vi.fn()}
        canComment={false}
        submitDisabled={false}
        joinPrompt="Join this community to comment"
        joinButtonLabel="Join now"
        onJoin={onJoin}
      />,
    );

    expect(screen.getByText(/join this community to comment/i)).toBeVisible();
    const joinButton = screen.getByRole("button", { name: /join now/i });
    expect(joinButton).toBeVisible();

    await user.click(joinButton);
    expect(onJoin).toHaveBeenCalledTimes(1);

    expect(screen.getByRole("button", { name: /post comment/i })).toBeDisabled();
  });
});

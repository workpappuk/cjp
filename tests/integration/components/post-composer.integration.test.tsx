import { useState, type FormEvent } from "react";
import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import PostComposer from "@/app/_components/PostComposer";
import { server } from "@/tests/mocks/server";
import { routerMock } from "@/tests/mocks/router";
import { renderWithProviders, waitForLoading } from "@/tests/utils/test-helpers";

function Harness() {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notice, setNotice] = useState("");

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setNotice("");

    try {
      const response = await fetch("https://external.example.com/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: "prod-basic", title, content }),
      });

      if (!response.ok) {
        setNotice("Failed to submit");
        return;
      }

      setNotice("Submitted");
      routerMock.push("/pages/home");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <PostComposer
        heading="Create Post"
        title={title}
        content={content}
        onTitleChange={setTitle}
        onContentChange={setContent}
        onSubmit={onSubmit}
        disabled={isSubmitting}
      />
      <p>{notice}</p>
    </div>
  );
}

describe("PostComposer integration", () => {
  it("submits form, calls API, and routes on success", async () => {
    const user = userEvent.setup();
    renderWithProviders(<Harness />);

    await user.type(screen.getByLabelText(/post title/i), "Integration Title");
    await user.type(
      screen.getByPlaceholderText(/share your thoughts with the community/i),
      "Integration Content",
    );
    await user.click(screen.getByRole("button", { name: /publish post/i }));

    await waitForLoading(() => {
      expect(screen.getByText("Submitted")).toBeVisible();
      expect(routerMock.push).toHaveBeenCalledWith("/pages/home");
    });
  });

  it("shows error state when API fails", async () => {
    server.use(
      http.post("https://external.example.com/orders", () => {
        return HttpResponse.json({ error: "failure" }, { status: 500 });
      }),
    );

    const user = userEvent.setup();
    renderWithProviders(<Harness />);

    await user.type(screen.getByLabelText(/post title/i), "Integration Title");
    await user.type(
      screen.getByPlaceholderText(/share your thoughts with the community/i),
      "Integration Content",
    );
    await user.click(screen.getByRole("button", { name: /publish post/i }));

    await waitForLoading(() => {
      expect(screen.getByText("Failed to submit")).toBeVisible();
    });
  });
});

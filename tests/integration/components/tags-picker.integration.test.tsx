import { useState } from "react";
import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import TagsPicker from "@/app/_components/TagsPicker";
import { renderWithProviders, waitForLoading } from "@/tests/utils/test-helpers";
import { server } from "@/tests/mocks/server";

function Harness(props: { suggestedTags?: string[]; maxTags?: number }) {
  const [tags, setTags] = useState<string[]>([]);
  return (
    <TagsPicker
      value={tags}
      onChange={setTags}
      suggestedTags={props.suggestedTags}
      maxTags={props.maxTags}
      placeholder="Add a tag"
    />
  );
}

describe("TagsPicker integration", () => {
  it("adds and removes tags", async () => {
    const user = userEvent.setup();
    renderWithProviders(<Harness />);

    const input = screen.getByLabelText(/add a tag/i);
    await user.type(input, "React");
    await user.keyboard("{Enter}");

    expect(screen.getByRole("button", { name: /#react ×/i })).toBeVisible();

    await user.click(screen.getByRole("button", { name: /#react ×/i }));
    expect(screen.queryByRole("button", { name: /#react ×/i })).toBeNull();
  });

  it("shows validation for invalid tag format", async () => {
    const user = userEvent.setup();
    renderWithProviders(<Harness />);

    await user.type(screen.getByLabelText(/add a tag/i), "two words");
    await user.click(screen.getByRole("button", { name: /add/i }));

    expect(screen.getByText(/one word and 64 characters or fewer/i)).toBeVisible();
  });

  it("uses remote suggestions and adds suggestion click", async () => {
    server.use(
      http.get("/api/tags", ({ request }) => {
        const url = new URL(request.url);
        if (url.searchParams.get("search") === "rea") {
          return HttpResponse.json([{ name: "react" }, { name: "reason" }]);
        }
        return HttpResponse.json([]);
      }),
    );

    const user = userEvent.setup();
    renderWithProviders(<Harness suggestedTags={["redux"]} />);

    await user.type(screen.getByLabelText(/add a tag/i), "rea");

    await waitForLoading(() => {
      expect(screen.getByRole("button", { name: /\+ #react/i })).toBeVisible();
    });

    await user.click(screen.getByRole("button", { name: /\+ #react/i }));
    expect(screen.getByRole("button", { name: /#react ×/i })).toBeVisible();
  });

  it("enforces max tag limit", async () => {
    const user = userEvent.setup();
    renderWithProviders(<Harness maxTags={1} />);

    const input = screen.getByLabelText(/add a tag/i);
    await user.type(input, "one");
    await user.keyboard("{Enter}");

    await user.type(input, "two");
    await user.keyboard("{Enter}");

    expect(screen.getByText(/up to 1 tags/i)).toBeVisible();
  });
});

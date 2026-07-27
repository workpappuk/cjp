import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AppToast from "@/app/_components/AppToast";
import { renderWithProviders } from "@/tests/utils/test-helpers";

describe("AppToast integration", () => {
  it("does not render when closed", () => {
    renderWithProviders(
      <AppToast open={false} message="Saved" onClose={vi.fn()} />,
    );

    expect(screen.queryByText("Saved")).toBeNull();
  });

  it("renders message and allows manual close", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    renderWithProviders(
      <AppToast open message="Saved successfully" onClose={onClose} />,
    );

    expect(screen.getByText("Saved successfully")).toBeVisible();

    const closeButton = screen.getAllByRole("button")[0];
    await user.click(closeButton);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("auto-closes after timeout", () => {
    vi.useFakeTimers();
    const onClose = vi.fn();

    renderWithProviders(
      <AppToast open message="Auto close" onClose={onClose} autoHideMs={1200} />,
    );

    vi.advanceTimersByTime(1199);
    expect(onClose).toHaveBeenCalledTimes(0);

    vi.advanceTimersByTime(1);
    expect(onClose).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });
});

import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderWithProviders, waitForLoading } from "@/tests/utils/test-helpers";
import GoogleTopRightSignIn from "@/app/_components/GoogleTopRightSignIn";

const useSessionMock = vi.hoisted(() => vi.fn());
const signInMock = vi.hoisted(() => vi.fn());
const initializeMock = vi.hoisted(() => vi.fn());
const renderButtonMock = vi.hoisted(() => vi.fn());
const promptMock = vi.hoisted(() => vi.fn());

vi.mock("next-auth/react", async () => {
  const actual = await vi.importActual<typeof import("next-auth/react")>("next-auth/react");
  return {
    ...actual,
    useSession: useSessionMock,
    signIn: signInMock,
  };
});

vi.mock("next/script", () => ({
  default: ({ onLoad }: { onLoad?: () => void }) => {
    onLoad?.();
    return null;
  },
}));

describe("GoogleTopRightSignIn integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID = "google-client-id";
    window.google = {
      accounts: {
        id: {
          initialize: initializeMock,
          renderButton: renderButtonMock,
          prompt: promptMock,
        },
      },
    };
  });

  it("does not render for authenticated users", () => {
    useSessionMock.mockReturnValue({ status: "authenticated" });

    const { container } = renderWithProviders(<GoogleTopRightSignIn />);
    expect(container).toBeEmptyDOMElement();
  });

  it("initializes google one-tap when unauthenticated", async () => {
    useSessionMock.mockReturnValue({ status: "unauthenticated" });

    renderWithProviders(<GoogleTopRightSignIn />);

    await waitForLoading(() => {
      expect(initializeMock).toHaveBeenCalledTimes(1);
      expect(renderButtonMock).toHaveBeenCalledTimes(1);
      expect(promptMock).toHaveBeenCalledTimes(1);
    });
  });

  it("calls signIn when google credential callback returns token", async () => {
    useSessionMock.mockReturnValue({ status: "unauthenticated" });

    renderWithProviders(<GoogleTopRightSignIn />);

    await waitForLoading(() => {
      expect(initializeMock).toHaveBeenCalledTimes(1);
    });

    const initializeArgs = initializeMock.mock.calls[0]?.[0] as {
      callback: (payload: { credential?: string }) => Promise<void>;
    };

    await initializeArgs.callback({ credential: "credential-token" });

    expect(signInMock).toHaveBeenCalledWith("google-one-tap", {
      credential: "credential-token",
      callbackUrl: "/pages/home",
    });
  });
});

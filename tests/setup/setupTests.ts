import "@testing-library/jest-dom/vitest";
import React from "react";
import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, vi } from "vitest";
import { server } from "@/tests/mocks/server";
import { routerMock } from "@/tests/mocks/router";

vi.mock("next/navigation", () => ({
  useRouter: () => routerMock,
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

if (typeof window !== "undefined" && !window.matchMedia) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

vi.mock("@/app/_types/mtw", () => {
  const Input = (props: Record<string, unknown>) => {
    const { label, ...rest } = props;
    return React.createElement("input", {
      "aria-label": label,
      ...rest,
    });
  };

  const Button = (props: Record<string, unknown>) => {
    const { type, ...rest } = props;
    return React.createElement("button", {
      type: (type as string) ?? "button",
      ...rest,
    });
  };

  const Alert = (props: Record<string, unknown>) => {
    const { children, ...rest } = props;
    return React.createElement("div", { ...rest, children });
  };

  const IconButton = (props: Record<string, unknown>) => {
    const { type, ...rest } = props;
    return React.createElement("button", {
      type: (type as string) ?? "button",
      ...rest,
    });
  };

  const Typography = (props: Record<string, unknown>) =>
    React.createElement("div", { children: props.children });

  const Card = (props: Record<string, unknown>) =>
    React.createElement("div", { children: props.children });

  const CardBody = (props: Record<string, unknown>) =>
    React.createElement("div", { children: props.children });

  const Chip = (props: Record<string, unknown>) =>
    React.createElement("div", { children: props.children });

  const Spinner = () => React.createElement("div", { children: "Loading" });

  return {
    Input,
    Button,
    Alert,
    IconButton,
    Typography,
    Card,
    CardBody,
    Chip,
    Spinner,
  };
});

beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" });
});

afterEach(() => {
  cleanup();
  server.resetHandlers();
  vi.clearAllMocks();
});

afterAll(() => {
  server.close();
});

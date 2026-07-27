"use client";

import { useEffect } from "react";
import { Alert, IconButton, Typography } from "@/app/_types/mtw";
import { HiXMark } from "react-icons/hi2";

export type AppToastTone = "success" | "warning" | "error" | "info";

type AppToastProps = {
  open: boolean;
  message: string;
  tone?: AppToastTone;
  onClose: () => void;
  autoHideMs?: number;
};

function toneToColor(tone: AppToastTone) {
  if (tone === "success") return "green" as const;
  if (tone === "warning") return "amber" as const;
  if (tone === "error") return "red" as const;
  return "blue" as const;
}

export default function AppToast({
  open,
  message,
  tone = "info",
  onClose,
  autoHideMs = 3500,
}: AppToastProps) {
  useEffect(() => {
    if (!open) {
      return;
    }

    const timeout = window.setTimeout(() => {
      onClose();
    }, autoHideMs);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [autoHideMs, onClose, open]);

  if (!open || !message) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 w-full max-w-sm px-3 sm:px-0">
      <Alert
        color={toneToColor(tone)}
        variant="gradient"
        className="pointer-events-auto flex items-start justify-between gap-3 shadow-xl"
      >
        <Typography className="text-sm font-medium text-white">{message}</Typography>
        <IconButton
          size="sm"
          variant="text"
          color="white"
          onClick={onClose}
          className="-mr-2 -mt-2"
        >
          <HiXMark className="h-4 w-4" />
        </IconButton>
      </Alert>
    </div>
  );
}

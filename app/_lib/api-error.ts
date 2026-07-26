import "server-only";
import { randomUUID } from "crypto";

type ApiErrorLogParams = {
  route: string;
  method: string;
  error: unknown;
  requestId?: string;
  context?: Record<string, unknown>;
};

export function getOrCreateRequestId(request: Request) {
  const existing = request.headers.get("x-request-id")?.trim();
  if (existing) return existing;
  return randomUUID();
}

export function getApiErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

export function logApiError(params: ApiErrorLogParams) {
  const err =
    params.error instanceof Error
      ? params.error
      : new Error(String(params.error));

  console.error("[api-error]", {
    timestamp: new Date().toISOString(),
    requestId: params.requestId ?? "",
    route: params.route,
    method: params.method,
    message: err.message,
    stack: err.stack,
    context: params.context ?? {},
  });
}

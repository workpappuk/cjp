import "server-only";

type ApiErrorLogParams = {
  route: string;
  method: string;
  error: unknown;
  context?: Record<string, unknown>;
};

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
    route: params.route,
    method: params.method,
    message: err.message,
    stack: err.stack,
    context: params.context ?? {},
  });
}

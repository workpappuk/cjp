import "server-only";
import { connectToDatabase } from "@/app/_lib/mongoose";
import { RateLimitCounterModel } from "@/app/_lib/models/RateLimitCounter";

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

const globalRateLimitState = globalThis as typeof globalThis & {
  __threadforgeRateLimitIndexReady?: boolean;
  __threadforgeRateLimitIndexPromise?: Promise<void>;
};

async function ensureRateLimitIndexes() {
  if (globalRateLimitState.__threadforgeRateLimitIndexReady) {
    return;
  }

  if (!globalRateLimitState.__threadforgeRateLimitIndexPromise) {
    globalRateLimitState.__threadforgeRateLimitIndexPromise = (async () => {
      await connectToDatabase();
      await RateLimitCounterModel.createIndexes();
      globalRateLimitState.__threadforgeRateLimitIndexReady = true;
    })();
  }

  try {
    await globalRateLimitState.__threadforgeRateLimitIndexPromise;
  } finally {
    if (globalRateLimitState.__threadforgeRateLimitIndexReady) {
      globalRateLimitState.__threadforgeRateLimitIndexPromise = undefined;
    }
  }
}

export function getRequestClientId(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) return first;
  }

  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  return "anonymous";
}

export async function checkRateLimit(params: {
  scope: string;
  request: Request;
  limit: number;
  windowMs: number;
}) : Promise<RateLimitResult> {
  await ensureRateLimitIndexes();

  const now = Date.now();
  const bucket = Math.floor(now / params.windowMs);
  const resetAtMs = (bucket + 1) * params.windowMs;
  const retryAfterSeconds = Math.max(1, Math.ceil((resetAtMs - now) / 1000));

  const clientId = getRequestClientId(params.request);
  const updatedDoc = await RateLimitCounterModel.findOneAndUpdate(
    {
      scope: params.scope,
      clientId,
      bucket,
    },
    {
      $setOnInsert: {
        scope: params.scope,
        clientId,
        bucket,
        expiresAt: new Date(resetAtMs + params.windowMs),
      },
      $inc: {
        count: 1,
      },
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
      lean: true,
    },
  );

  const currentCount = updatedDoc?.count ?? 0;

  if (currentCount > params.limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds,
    };
  }

  return {
    allowed: true,
    remaining: Math.max(0, params.limit - currentCount),
    retryAfterSeconds,
  };
}

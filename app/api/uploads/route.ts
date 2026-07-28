import { NextResponse } from "next/server";
import { getSessionActor } from "@/app/_lib/admin";
import { checkRateLimit } from "@/app/_lib/rate-limit";
import {
  getApiErrorMessage,
  getOrCreateRequestId,
  logApiError,
} from "@/app/_lib/api-error";
import {
  MAX_IMAGE_UPLOAD_COUNT,
  isSupportedUploadScope,
  isSupportedImageMimeType,
  storeUploadedImage,
} from "@/app/_lib/media-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const requestId = getOrCreateRequestId(request);

  const rateLimit = await checkRateLimit({
    scope: "uploads:create",
    request,
    limit: 30,
    windowMs: 60_000,
  });

  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        error: "Too many requests. Please try again later.",
        requestId,
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(rateLimit.retryAfterSeconds),
          "x-request-id": requestId,
        },
      },
    );
  }

  try {
    const actor = await getSessionActor();
    if (!actor?.email) {
      return NextResponse.json(
        { error: "Unauthorized.", requestId },
        {
          status: 401,
          headers: {
            "x-request-id": requestId,
          },
        },
      );
    }

    const formData = await request.formData();
    const rawScope = String(formData.get("scope") ?? "post").trim().toLowerCase();

    if (!isSupportedUploadScope(rawScope)) {
      return NextResponse.json(
        { error: "Invalid upload scope.", requestId },
        {
          status: 400,
          headers: {
            "x-request-id": requestId,
          },
        },
      );
    }

    const files = formData
      .getAll("files")
      .filter((value): value is File => value instanceof File);

    if (files.length === 0) {
      return NextResponse.json(
        { error: "At least one image is required.", requestId },
        {
          status: 400,
          headers: {
            "x-request-id": requestId,
          },
        },
      );
    }

    if (files.length > MAX_IMAGE_UPLOAD_COUNT) {
      return NextResponse.json(
        { error: `A maximum of ${MAX_IMAGE_UPLOAD_COUNT} images can be uploaded at once.`, requestId },
        {
          status: 400,
          headers: {
            "x-request-id": requestId,
          },
        },
      );
    }

    if (!files.every((file) => isSupportedImageMimeType(file.type))) {
      return NextResponse.json(
        { error: "Only jpg, png, webp, and gif images are supported.", requestId },
        {
          status: 400,
          headers: {
            "x-request-id": requestId,
          },
        },
      );
    }

    const uploads = await Promise.all(
      files.map((file) => storeUploadedImage({ file, scope: rawScope })),
    );

    return NextResponse.json(
      {
        requestId,
        files: uploads,
      },
      {
        status: 201,
        headers: {
          "x-request-id": requestId,
        },
      },
    );
  } catch (error) {
    logApiError({
      route: "/api/uploads",
      method: "POST",
      error,
      requestId,
    });

    const message = getApiErrorMessage(error, "Failed to upload image");
    return NextResponse.json(
      { error: message, requestId },
      {
        status: 500,
        headers: {
          "x-request-id": requestId,
        },
      },
    );
  }
}

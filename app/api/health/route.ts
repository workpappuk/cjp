import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/app/_lib/mongoose";
import {
  getApiErrorMessage,
  getOrCreateRequestId,
  logApiError,
} from "@/app/_lib/api-error";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = getOrCreateRequestId(request);

  try {
    await connectToDatabase();

    return NextResponse.json(
      {
        ok: true,
        requestId,
        message: "MongoDB connection is healthy",
        state: mongoose.connection.readyState,
        timestamp: new Date().toISOString(),
      },
      {
        status: 200,
        headers: {
          "x-request-id": requestId,
        },
      },
    );
  } catch (error) {
    logApiError({
      route: "/api/health",
      method: "GET",
      error,
      requestId,
    });
    const message = getApiErrorMessage(error, "Unknown database error");

    return NextResponse.json(
      {
        ok: false,
        requestId,
        message: "MongoDB connection failed",
        error: message,
        timestamp: new Date().toISOString(),
      },
      {
        status: 500,
        headers: {
          "x-request-id": requestId,
        },
      },
    );
  }
}

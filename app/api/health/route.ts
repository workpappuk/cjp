import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/app/_lib/mongoose";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await connectToDatabase();

    return NextResponse.json(
      {
        ok: true,
        message: "MongoDB connection is healthy",
        state: mongoose.connection.readyState,
        timestamp: new Date().toISOString(),
      },
      { status: 200 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown database error";

    return NextResponse.json(
      {
        ok: false,
        message: "MongoDB connection failed",
        error: message,
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    );
  }
}

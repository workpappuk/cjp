import { connectToDatabase } from "@/app/_lib/mongoose";

let hasConnectedOnStartup = false;

export async function registerMongoOnStartup() {
  if (hasConnectedOnStartup) {
    return;
  }

  try {
    await connectToDatabase();
    hasConnectedOnStartup = true;
    console.log("[startup] MongoDB connected");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.warn(`[startup] MongoDB unavailable: ${message}`);
  }
}

await registerMongoOnStartup();

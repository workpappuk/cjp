export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./app/_lib/instrumentation-node");
  }
}

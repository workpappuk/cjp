import { afterAll } from "vitest";
import { cleanupDatabase } from "@/tests/setup/setupDb";

afterAll(async () => {
  await cleanupDatabase();
});

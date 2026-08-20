import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    // Local only. In the container the path comes from DATA_DIR.
    url: "./data/ballpark.db",
  },
});

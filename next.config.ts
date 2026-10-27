import type { NextConfig } from "next";

// Database drivers load their own files at runtime, so Next.js leaves them
// as plain Node packages instead of bundling them (PROJECT_PLAN.md §20).
const config: NextConfig = {
  serverExternalPackages: ["@electric-sql/pglite", "pg"],
};
export default config;

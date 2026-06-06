/**
 * env.ts — fail-fast guard for required environment variables (F001).
 *
 * WHY: previously `process.env.ACCESS_TOKEN` (and others) were read silently;
 * if a clone-per-client deploy missed an env, the server booted and looked
 * healthy ("FruitSnacks Server is working!" at GET /) but every auth + every
 * upload was broken at runtime. This module validates at boot so misconfigured
 * deploys fail visibly in Coolify health checks instead of looking up but
 * broken.
 */

const REQUIRED = [
  "MONGO_URI",
  "ACCESS_TOKEN",
  "S3_REGION",
  "S3_ENDPOINT",
  "S3_ACCESS_KEY",
  "S3_SECRET_KEY",
  "S3_BUCKET",
  "S3_PUBLIC_URL",
] as const;

const OPTIONAL_WITH_WARN = [
  "PORT",
  "PATHAO_BASE_URL",
  "PATHAO_CLIENT_ID",
  "PATHAO_CLIENT_SECRET",
  "STEADFAST_CLIENT_ID",
  "STEADFAST_CLIENT_PASSWORD",
  "FRAUDBD_API_KEY",
] as const;

export const validateEnv = (): void => {
  const missing = REQUIRED.filter(
    (k) => !process.env[k] || !process.env[k]!.trim(),
  );
  if (missing.length) {
    console.error("\n[FC] ❌ Missing required environment variables:");
    missing.forEach((k) => console.error(`     - ${k}`));
    console.error("\n[FC] Check your .env file. Server will not start.\n");
    process.exit(1);
  }

  const warns = OPTIONAL_WITH_WARN.filter((k) => !process.env[k]);
  if (warns.length) {
    console.warn(
      `[FC] ⚠️  Optional env vars not set: ${warns.join(", ")} — related features will be disabled.`,
    );
  }
};

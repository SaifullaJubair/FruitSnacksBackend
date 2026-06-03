/**
 * logger.ts — pino-based structured logger (F005 infra, partial F005 fix).
 *
 * WHY: backend used scattered `console.log`/`console.error` with no level, no
 * request ID, no JSON format. That's fine in dev but hard to filter in Coolify
 * logs and impossible to plug into Sentry/Datadog later. pino gives us:
 *   - JSON output in prod (parseable, searchable)
 *   - pretty colored output in dev
 *   - levels (trace/debug/info/warn/error/fatal)
 *   - per-request child loggers via pino-http (auto request ID)
 *
 * Migration: this session wires the infra + replaces console.* in index.ts.
 * Module-level console.* calls migrate gradually as the audit pass visits each
 * module. New code should import `logger` from here.
 */

import pino from "pino";

const isProd = process.env.NODE_ENV === "production";

export const logger = pino({
  level: process.env.LOG_LEVEL || (isProd ? "info" : "debug"),
  transport: !isProd
    ? {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "HH:MM:ss.l",
          ignore: "pid,hostname",
        },
      }
    : undefined,
  // Production: include service name in every log line for multi-app filtering
  base: isProd ? { service: "fruitsnacks-backend" } : undefined,
});

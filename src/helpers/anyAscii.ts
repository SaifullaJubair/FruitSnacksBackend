/**
 * CJS-safe wrapper around the ESM-only `any-ascii` package.
 *
 * WHY: the backend compiles to CommonJS (`tsconfig module: commonjs`). A static
 * `import anyAscii from "any-ascii"` becomes `require("any-ascii")` in the emitted
 * JS, and any-ascii (v0.3.x) is ESM-only (`type: module`, no CJS entry) → Node 22
 * throws ERR_REQUIRE_ESM at load and crash-loops the container in production.
 * (ts-node-dev --transpile-only hid this in dev.)
 *
 * Node CAN load ESM from CJS via dynamic `import()` — but that's async, while our
 * call sites (slugify, generateAxisCode, buildSku) are sync and deep inside
 * controllers. So we eager-load the module ONCE at process start and cache the
 * function, exposing a synchronous `anyAscii()` that uses the cached impl.
 *
 * `warmAnyAscii()` is awaited during server bootstrap (server.ts) so the module
 * is ready well before any product create/slug/SKU path runs. If a call somehow
 * lands before warm-up completes, we fall back to stripping non-ASCII (safe: the
 * downstream code already handles empty/ASCII-only output) and the real
 * transliteration kicks in once loaded.
 */

type AnyAsciiFn = (input: string) => string;

let impl: AnyAsciiFn | null = null;
let warming: Promise<void> | null = null;

export const warmAnyAscii = async (): Promise<void> => {
  if (impl) return;
  if (!warming) {
    warming = (async () => {
      // IMPORTANT: with tsconfig `module: commonjs`, a normal `await import(...)`
      // is DOWN-COMPILED by tsc to `Promise.resolve().then(() => require(...))`,
      // which re-introduces the very ERR_REQUIRE_ESM we are avoiding. We hide the
      // dynamic import behind a `new Function` so tsc cannot rewrite it — this
      // keeps it a real native ESM `import()` at runtime (Node 22).
      // eslint-disable-next-line @typescript-eslint/no-implied-eval
      const nativeImport = new Function("s", "return import(s);") as (
        s: string,
      ) => Promise<any>;
      const mod: any = await nativeImport("any-ascii");
      impl = (mod.default || mod) as AnyAsciiFn;
    })();
  }
  await warming;
};

// Kick off loading as soon as this module is required, so even without an
// explicit warm-up the impl is usually ready by the time it's first called.
void warmAnyAscii();

/**
 * Synchronous transliteration. Returns the any-ascii result once the module is
 * loaded; before that (a brief window at startup) falls back to ASCII-only.
 */
const anyAscii: AnyAsciiFn = (input: string): string => {
  if (impl) return impl(input || "");
  // Fallback until the ESM module finishes loading — keep only ASCII chars.
  return (input || "").replace(/[^\x00-\x7F]/g, "");
};

export default anyAscii;

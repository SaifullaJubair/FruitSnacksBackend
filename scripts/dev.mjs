// Dev launcher — forces NODE_ENV=development before starting ts-node-dev.
//
// WHY: this machine has NODE_ENV=production set globally (see the V2 dev-setup
// memory). With that, the auth cookie code picks secure:true + sameSite:none,
// which the browser DROPS over http://localhost → login silently never sets a
// cookie → getMe is always 401. Forcing development here makes the cookie
// dev-friendly (secure:false + sameSite:lax) without depending on cross-env
// (which doesn't install cleanly here) or the shell's env.
import { spawn } from "node:child_process";

const child = spawn(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["ts-node-dev", "--respawn", "--transpile-only", "src/index.ts"],
  {
    stdio: "inherit",
    env: { ...process.env, NODE_ENV: "development" },
    shell: process.platform === "win32",
  },
);

child.on("exit", (code) => process.exit(code ?? 0));

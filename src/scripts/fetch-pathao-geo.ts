/**
 * fetch-pathao-geo.ts — pull Pathao's own city + zone list ONCE, into a
 * checked-in JSON file.
 *
 * ## Why this exists
 *
 * `bd-geo.json` carries the government's administrative list: 8 divisions, 64
 * districts, 494 upazilas. Correct, but it is not how the country's biggest
 * cities are actually addressed. City-corporation districts (Dhaka,
 * Chattogram, Khulna, Rajshahi) have no upazila row for the city itself —
 * Dhaka district lists Dhamrai, Dohar, Keraniganj, Nawabganj and Savar, and
 * nothing for Gulshan, Dhanmondi or Mirpur. Most real orders go to an address
 * the government list cannot express.
 *
 * Pathao's zone list can express them, because it is built for delivery
 * rather than administration. So we take it — once — and keep it.
 *
 * ## The credentials
 *
 * Reading this list needs a merchant token; Pathao publishes no anonymous
 * endpoint. That is a one-time cost, not a runtime one: after this script has
 * run, the data lives in our own collection and the checkout needs no courier
 * credentials ever again. That is the whole point of the geo module.
 *
 * Pass them via .env (same PATHAO_* vars courier.config.ts falls back to).
 * NOTHING is written to disk except city/zone names and ids. In particular
 * `PATHAO_STORE_ID` is neither read nor needed — a store id is what lets a
 * caller SEND a parcel (and settle money for it), and this script only ever
 * reads a public list.
 *
 * ⚠️ Confirm `PATHAO_SANDBOX` / which base URL is being hit BEFORE trusting
 * the output as the production zone list — Pathao's sandbox and live zone
 * tables are not guaranteed to be identical (flagged by 2026-10-26 edge
 * audit). This clone should pull against LIVE credentials for the data that
 * actually ships to production.
 *
 *   npx ts-node --transpile-only src/scripts/fetch-pathao-geo.ts
 *
 * Output: src/data/geo/pathao-geo.json
 */
import axios from "axios";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
dotenv.config();

const OUT = path.join(__dirname, "..", "data", "geo", "pathao-geo.json");

const log = (...a: any[]) => console.log("[fetch-pathao-geo]", ...a);

/** Pathao rate-limits; a short pause between the 60-odd city calls. */
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function run() {
  // courier.config.ts builds the live URL the same way; sandbox is a
  // separate explicit host, never guessed.
  const sandbox = (process.env.PATHAO_SANDBOX || "").trim() === "true";
  const base = (
    sandbox
      ? "https://courier-api-sandbox.pathao.com/aladdin/api/v1"
      : process.env.PATHAO_BASE_URL?.trim() ||
        "https://api-hermes.pathao.com/aladdin/api/v1"
  )
    .trim()
    .replace(/\/+$/, "");
  const creds = {
    client_id: (process.env.PATHAO_CLIENT_ID || "").trim(),
    client_secret: (process.env.PATHAO_CLIENT_SECRET || "").trim(),
    username: (process.env.PATHAO_CLIENT_EMAIL || "").trim(),
    password: (process.env.PATHAO_CLIENT_PASSWORD || "").trim(),
  };

  const missing = Object.entries(creds)
    .filter(([, v]) => !v)
    .map(([k]) => k);
  if (missing.length) {
    console.error(
      `Missing: ${missing.join(", ")}. This script needs a merchant token to ` +
        `read the list — Pathao has no anonymous endpoint. It never sends a ` +
        `parcel and never reads PATHAO_STORE_ID.`,
    );
    process.exit(1);
  }

  log(`base: ${base} ${sandbox ? "(SANDBOX)" : "(LIVE)"}`);
  const tokenRes = await axios.post(`${base}/issue-token`, {
    ...creds,
    grant_type: "password",
  });
  const token = tokenRes.data?.access_token;
  if (!token) throw new Error("no access_token in response");
  log("token acquired");

  const auth = { headers: { Authorization: `Bearer ${token}` } };

  const cityRes = await axios.get(`${base}/city-list`, auth);
  const cities = cityRes.data?.data?.data ?? [];
  log(`cities: ${cities.length}`);

  const out: any = {
    _source: "Pathao city-list / zone-list API",
    _generated: new Date().toISOString().slice(0, 10),
    _environment: sandbox ? "sandbox" : "live",
    _note:
      "Delivery geography as Pathao addresses it. Complements bd-geo.json, " +
      "which carries the government's administrative list but has no row for " +
      "the city-corporation districts' own city areas.",
    cities: [],
  };

  // Resume: Pathao rate-limits hard (429 after ~20 cities at 150ms), and a
  // half-finished file is worse than none — it looks complete. Re-running
  // picks up the cities already fetched and asks only for the rest.
  if (fs.existsSync(OUT)) {
    try {
      const prev = JSON.parse(fs.readFileSync(OUT, "utf8"));
      out.cities = (prev.cities ?? []).filter((c: any) => c.zones?.length);
      if (out.cities.length) log(`resuming — ${out.cities.length} cities already fetched`);
    } catch {
      /* a corrupt partial file is simply ignored and refetched */
    }
  }
  const done = new Set(out.cities.map((c: any) => c.city_id));

  for (const c of cities) {
    if (done.has(c.city_id)) continue;

    // Retry with backoff rather than failing the whole run: a 429 partway
    // through is the expected case, not an exception.
    let zones: any[] | null = null;
    for (let attempt = 0; attempt < 6 && zones === null; attempt++) {
      try {
        const zoneRes = await axios.get(
          `${base}/cities/${c.city_id}/zone-list`,
          auth,
        );
        zones = zoneRes.data?.data?.data ?? [];
      } catch (e: any) {
        if (e.response?.status !== 429) throw e;
        const wait = 20000 * (attempt + 1);
        log(`  rate-limited on ${c.city_name}; waiting ${wait / 1000}s`);
        await sleep(wait);
      }
    }
    if (zones === null) {
      log(`  giving up on ${c.city_name} for now — re-run to continue`);
      break;
    }
    out.cities.push({
      city_id: c.city_id,
      city_name: String(c.city_name || "").trim(),
      zones: zones.map((z: any) => ({
        zone_id: z.zone_id,
        // Pathao's own data carries trailing spaces ("Bandarban "). Trim at
        // the boundary so it never enters our collection.
        zone_name: String(z.zone_name || "").trim(),
      })),
    });
    log(`  ${c.city_name}: ${zones.length} zones`);
    // Flush each time: an interrupted run must not lose what it already has.
    fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
    await sleep(1200);
  }

  const totalZones = out.cities.reduce(
    (n: number, c: any) => n + c.zones.length,
    0,
  );
  fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
  log(`\nwrote ${OUT}`);
  log(`${out.cities.length} cities · ${totalZones} zones`);
}

run().catch((e) => {
  console.error(e.response?.data ?? e.message ?? e);
  process.exit(1);
});

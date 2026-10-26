/**
 * seed-pathao-zones.ts — merge Pathao's delivery geography into `geo_locations`.
 *
 * ## What this fixes
 *
 * The government list (bd-geo.json) is administratively correct and
 * operationally incomplete. City-corporation districts have no upazila row for
 * the city itself — Dhaka district lists Dhamrai, Dohar, Keraniganj,
 * Nawabganj and Savar, and nothing for Gulshan, Dhanmondi or Mirpur. Measured
 * against Pathao, who address the same district with hundreds of zones, that
 * is where nearly every real order goes.
 *
 * So Pathao's zones are added as a THIRD level under each district, carrying
 * their `zone_id` with them. Two things fall out of that:
 *
 *   - the address a customer picks can finally name a Dhaka neighbourhood;
 *   - `courier_refs.pathao` is filled in AT SEED TIME, because the row came
 *     from Pathao. No manual admin mapping is needed for Pathao after this.
 *
 * The official upazilas are NOT removed. They are kept for display de-dup at
 * read time only (see geo.services.ts `dedupeForPicker`) — never deleted by
 * this script, because the two lists answer different questions and a seed
 * should always be safely re-runnable.
 *
 * ## Matching
 *
 * Most Pathao cities match a district on a normalised name. The rest are
 * spelling variants, listed explicitly rather than fuzzy-matched: a fuzzy
 * match that is wrong puts a whole district's zones under the wrong parent,
 * and nothing downstream would notice until a parcel went to the wrong end of
 * the country. Each maps to exactly one district.
 *
 * Comilla/Cumilla is worth the warning: the government dataset carries the
 * pre-2018 spelling while Pathao uses the current official one — without this
 * alias Cumilla's zones are silently skipped, and a skipped city looks
 * identical to a city with no zones.
 *
 * Idempotent, like seed-geo-bd.ts: matched on `code`, so re-running neither
 * duplicates rows nor overwrites an admin's edits.
 *
 *   npx ts-node --transpile-only src/scripts/seed-pathao-zones.ts --dry
 *   npx ts-node --transpile-only src/scripts/seed-pathao-zones.ts --apply
 */
import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();
import fs from "fs";
import path from "path";

import GeoLocationModel from "../app/geo/geo.model";

const APPLY = process.argv.includes("--apply");
const log = (...a: any[]) => console.log("[seed-pathao-zones]", ...a);

/**
 * Pathao's spelling → ours, for cities that do not match on normalisation.
 *
 * Written out rather than fuzzy-matched: a fuzzy match that is wrong puts a
 * whole district's zones under the wrong parent, and nothing downstream would
 * notice until a parcel went to the wrong end of the country.
 */
const CITY_ALIASES: Record<string, string> = {
  "b. baria": "Brahmanbaria",
  bogra: "Bogura",
  chittagong: "Chattogram",
  cumilla: "Comilla",
  gopalgonj: "Gopalganj",
  jhalokathi: "Jhalakathi",
  jhenidah: "Jhenaidah",
  khagrachari: "Khagrachhari",
  munsiganj: "Munshiganj",
  narshingdi: "Narsingdi",
  netrakona: "Netrokona",
};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");

async function run() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error("Missing MONGO_URI in .env");
    process.exit(1);
  }
  await mongoose.connect(uri);
  log("Connected to MongoDB");
  log(APPLY ? "APPLY (will write)" : "DRY RUN (no writes)");

  const pathaoFile = path.join(__dirname, "..", "data", "geo", "pathao-geo.json");
  if (!fs.existsSync(pathaoFile)) {
    console.error(
      `Missing ${pathaoFile} — run fetch-pathao-geo.ts first to pull Pathao's ` +
        `zone list (needs live Pathao credentials in .env).`,
    );
    process.exit(1);
  }
  const pathao = JSON.parse(fs.readFileSync(pathaoFile, "utf8"));

  const districts = await GeoLocationModel.find({ type: "district" }).lean();
  const byNorm = new Map<string, any>(
    districts.map((d: any) => [norm(d.name_en), d]),
  );

  const stats = { created: 0, updated: 0, unchanged: 0, skippedCities: 0, skippedZones: 0 };

  for (const city of pathao.cities) {
    const target =
      byNorm.get(norm(city.city_name)) ??
      byNorm.get(norm(CITY_ALIASES[city.city_name.toLowerCase()] ?? ""));

    if (!target) {
      log(`  ⚠ no district for Pathao city "${city.city_name}" — skipped`);
      stats.skippedCities++;
      continue;
    }

    // The district itself gets Pathao's city_id, so a district-level address
    // can still be dispatched even when no zone was chosen.
    if (APPLY) {
      await GeoLocationModel.updateOne(
        { _id: target._id },
        { $set: { "courier_refs.pathao.city_id": city.city_id } },
      );
    }

    const geo_path = [...(target.geo_path ?? []), target._id];

    for (const z of city.zones) {
      const code = `pathao-zone-${z.zone_id}`;
      const existing: any = await GeoLocationModel.findOne({ code }).lean();

      if (!existing) {
        // A Pathao zone can share its exact name with a sibling government
        // upazila under the same district (e.g. "Bagerhat Sadar" exists in
        // both bd-geo.json and Pathao's own list) — the scoped
        // (parent_id, name_en) unique index on geo.model.ts correctly
        // refuses the duplicate. This is not a data error: dedupeForPicker
        // in geo.services.ts already collapses the display for exactly this
        // case, Pathao's row simply isn't needed as a SEPARATE row here —
        // the government row already serves that name under that parent.
        // Checked up front (not just caught) so a dry run reports the same
        // outcome --apply will actually produce.
        const nameCollision = await GeoLocationModel.findOne({
          parent_id: target._id,
          name_en: z.zone_name,
        }).lean();
        if (nameCollision) {
          stats.skippedZones++;
          log(
            `    ⚠ zone "${z.zone_name}" collides by name with a sibling under ${target.name_en} — skipped (already servable, see dedupeForPicker)`,
          );
        } else {
          stats.created++;
          if (APPLY) {
            try {
              await GeoLocationModel.create({
                code,
                name_en: z.zone_name,
                // Pathao publishes no Bangla name. Falling back to the
                // English one keeps the field populated and honest — better
                // than an empty string the UI would render as a blank
                // option.
                name_bn: z.zone_name,
                type: "upazila",
                parent_id: target._id,
                geo_path,
                depth: geo_path.length,
                source: "pathao",
                courier_refs: {
                  pathao: { city_id: city.city_id, zone_id: z.zone_id },
                },
              });
            } catch (e: any) {
              // Race against the up-front check above (another process
              // inserted the same name between the findOne and the create) —
              // vanishingly unlikely for a one-time seed run, but correct to
              // not crash the whole run over it.
              if (e?.code === 11000) {
                stats.created--;
                stats.skippedZones++;
                log(`    ⚠ zone "${z.zone_name}" collided at write time — skipped`);
              } else {
                throw e;
              }
            }
          }
        }
      } else {
        // Only ever repair structure + the courier id. Names are the admin's.
        const needsFix =
          String(existing.parent_id) !== String(target._id) ||
          existing.courier_refs?.pathao?.zone_id !== z.zone_id ||
          existing.courier_refs?.pathao?.city_id !== city.city_id;
        if (needsFix) {
          stats.updated++;
          if (APPLY) {
            await GeoLocationModel.updateOne(
              { _id: existing._id },
              {
                $set: {
                  parent_id: target._id,
                  geo_path,
                  depth: geo_path.length,
                  "courier_refs.pathao.city_id": city.city_id,
                  "courier_refs.pathao.zone_id": z.zone_id,
                },
              },
            );
          }
        } else {
          stats.unchanged++;
        }
      }
    }
    log(`  ${city.city_name} → ${target.name_en}: ${city.zones.length} zones`);
  }

  log(
    `\ncreated ${stats.created} · repaired ${stats.updated} · unchanged ${stats.unchanged} · zones skipped (name collision) ${stats.skippedZones} · cities skipped ${stats.skippedCities}`,
  );
  if (APPLY) {
    log(`collection now holds ${await GeoLocationModel.countDocuments()} locations`);
  } else {
    log("nothing written — re-run with --apply");
  }

  await mongoose.disconnect();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});

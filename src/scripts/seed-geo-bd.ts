/**
 * seed-geo-bd.ts — load Bangladesh's 8 divisions, 64 districts and 494
 * upazilas into `geo_locations`.
 *
 * Source: https://github.com/nuhil/bangladesh-geocode (MIT), the most-used
 * public transcription of the government lists, checked into `src/data/geo/`
 * rather than fetched — no network, no API key needed to seed. That is the
 * whole point of the module (see geo.interface.ts).
 *
 * IDEMPOTENT. Matching is on `code`, never on the name, so:
 *   - re-running does not duplicate anything;
 *   - an admin's rename ("Comilla" → "Cumilla") SURVIVES a re-run;
 *   - courier mappings are never touched — they are the admin's work, and a
 *     seed that clobbered them would undo hours of it.
 *
 *   npx ts-node --transpile-only src/scripts/seed-geo-bd.ts --dry
 *   npx ts-node --transpile-only src/scripts/seed-geo-bd.ts --apply
 */
import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

import fs from "fs";
import path from "path";

import GeoLocationModel from "../app/geo/geo.model";
import type { GeoSeedFile } from "../app/geo/geo.interface";

// Read rather than `import` the JSON: resolved relative to this file, so it
// works under ts-node from src/ and from dist/ once the data folder ships
// alongside.
const DATA = path.join(__dirname, "..", "data", "geo", "bd-geo.json");
const geoData: GeoSeedFile = JSON.parse(fs.readFileSync(DATA, "utf8"));

const APPLY = process.argv.includes("--apply");
const log = (...a: any[]) => console.log("[seed-geo-bd]", ...a);

async function run() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error("Missing MONGO_URI in .env");
    process.exit(1);
  }
  await mongoose.connect(uri);
  log("Connected to MongoDB");
  log(APPLY ? "APPLY (will write)" : "DRY RUN (no writes)");

  const stats = { created: 0, updated: 0, unchanged: 0 };

  /**
   * Upsert one node and return its _id, so children can be linked to it.
   *
   * Only `name_en`, `name_bn` and the tree pointers are ever written. Anything
   * the admin owns — courier_refs, is_active, postal_code — is left exactly as
   * found, on insert as well as update.
   */
  const upsert = async (
    code: string,
    name_en: string,
    name_bn: string,
    type: "division" | "district" | "upazila",
    parent: { _id: mongoose.Types.ObjectId; geo_path: any[] } | null,
  ) => {
    const geo_path = parent ? [...parent.geo_path, parent._id] : [];
    const depth = geo_path.length;
    const existing: any = await GeoLocationModel.findOne({ code }).lean();

    if (!existing) {
      stats.created++;
      if (!APPLY) {
        // Dry run still needs an id to hang children off, or the whole tree
        // below this node reports nothing.
        return { _id: new mongoose.Types.ObjectId(), geo_path };
      }
      const doc = await GeoLocationModel.create({
        code,
        name_en,
        name_bn,
        type,
        parent_id: parent?._id ?? null,
        geo_path,
        depth,
      });
      return { _id: doc._id as mongoose.Types.ObjectId, geo_path };
    }

    // Re-parenting is the only structural repair a re-run performs; names are
    // left to the admin once the row exists.
    const samePath =
      (existing.geo_path ?? []).length === geo_path.length &&
      (existing.geo_path ?? []).every(
        (id: any, i: number) => String(id) === String(geo_path[i]),
      );
    const needsFix =
      String(existing.parent_id ?? "") !== String(parent?._id ?? "") ||
      !samePath ||
      existing.depth !== depth ||
      existing.type !== type;

    if (needsFix) {
      stats.updated++;
      if (APPLY) {
        await GeoLocationModel.updateOne(
          { _id: existing._id },
          { $set: { parent_id: parent?._id ?? null, geo_path, depth, type } },
        );
      }
    } else {
      stats.unchanged++;
    }
    return { _id: existing._id, geo_path };
  };

  const divisionIds = new Map<string, any>();
  const districtIds = new Map<string, any>();

  for (const d of geoData.divisions) {
    divisionIds.set(
      d.code,
      await upsert(d.code, d.name_en, d.name_bn, "division", null),
    );
  }
  log(`divisions: ${geoData.divisions.length}`);

  for (const d of geoData.districts) {
    const parent = divisionIds.get(d.division);
    if (!parent) {
      log(`  ⚠ district ${d.code} has no division ${d.division} — skipped`);
      continue;
    }
    districtIds.set(
      d.code,
      await upsert(d.code, d.name_en, d.name_bn, "district", parent),
    );
  }
  log(`districts: ${geoData.districts.length}`);

  for (const u of geoData.upazilas) {
    const parent = districtIds.get(u.district);
    if (!parent) {
      log(`  ⚠ upazila ${u.code} has no district ${u.district} — skipped`);
      continue;
    }
    await upsert(u.code, u.name_en, u.name_bn, "upazila", parent);
  }
  log(`upazilas: ${geoData.upazilas.length}`);

  log(
    `\ncreated ${stats.created} · re-linked ${stats.updated} · unchanged ${stats.unchanged}`,
  );
  if (APPLY) {
    const total = await GeoLocationModel.countDocuments();
    log(`collection now holds ${total} locations`);
  } else {
    log("nothing written — re-run with --apply");
  }

  await mongoose.disconnect();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});

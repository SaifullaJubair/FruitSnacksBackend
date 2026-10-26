import { Types } from "mongoose";

/**
 * geo.interface.ts — Bangladesh's administrative geography, ours to own.
 *
 * ## Why this module exists
 *
 * Before it, the ONLY structured form of a delivery address in this codebase
 * was `order.pathao_city_id` / `pathao_zone_id` — a courier's internal numbers,
 * fetched LIVE from Pathao's API on every checkout page load (see
 * `setting.controllers.ts`'s `getZoneData`). Three consequences, all real:
 *
 *   1. A shop using only Steadfast still needed Pathao credentials, because the
 *      checkout's city/zone dropdown called Pathao's lookup API. Steadfast's own
 *      create-order payload takes a plain address string and no ids at all
 *      (see steadfast.service.ts) — so the dependency was pure accident.
 *   2. Checkout itself went down whenever Pathao's API did — proven live
 *      2026-10-24, when a stale cached OAuth token made every zone-list call
 *      return HTTP 200 with no data, and only a server restart recovered it.
 *   3. Historical orders were only as durable as one vendor's id space.
 *
 * ## The rule
 *
 * **Our geography is the truth. A courier id is an optional translation of it.**
 *
 * Checkout reads this collection and needs no courier credentials whatsoever.
 * Courier ids are consulted only at the moment a parcel is dispatched, and only
 * by the courier that actually needs them:
 *
 *   | Courier    | Address form it accepts        | Mapping needed |
 *   |------------|--------------------------------|----------------|
 *   | Steadfast  | one free-text address string   | none           |
 *   | Pathao     | recipient_city/zone (numeric)  | ids            |
 *
 * (This clone only integrates Pathao + Steadfast today — see courier.config.ts
 * — so RedX/Paperfly/eCourier rows from the ecommerce-core reference design are
 * not modeled here. The `courier_refs` shape leaves room to add them later
 * without a migration, the same way ecommerce-core does.)
 *
 * ## Depth stops at upazila, deliberately
 *
 * Unions exist (~4,500 of them) but no courier this clone integrates addresses
 * them by id. Carrying 4,500 rows with no consumer would be upkeep with no
 * payoff. The tree is self-referencing and depth-agnostic, so unions could be
 * added later without a schema change.
 *
 * ## Uniqueness — deliberately NOT a bare unique index
 *
 * `category.model.ts` has `category_slug: { unique: true }` globally. Bangladesh
 * admin-geography names are NOT globally unique — "Dhaka" is both a division
 * name and a district name, and several upazila names repeat across different
 * districts (multiple "Kotwali", for instance). A bare unique index on `code`
 * is safe only because `code` is a synthetic seed identifier ("dist-1"), never
 * the display name — see geo.model.ts for the actual index.
 */

/** Administrative level. Ordered: a division contains districts, and so on. */
export type GeoType = "division" | "district" | "upazila";

/**
 * Per-courier translation of one location.
 *
 * EVERY field is optional, and an absent entry is not an error — it means this
 * courier does not need one (Steadfast), or nobody has mapped this location for
 * it yet. An unmapped location must never block checkout; it only makes that
 * one courier unavailable for that address.
 */
export interface IGeoCourierRefs {
  /** Pathao needs numeric ids for both levels. */
  pathao?: {
    city_id?: number;
    zone_id?: number;
  };
}

export interface IGeoLocationInterface {
  _id?: Types.ObjectId;

  name_en: string;
  name_bn: string;
  type: GeoType;

  /**
   * Stable seed identifier ("dist-1"), unique and never reused.
   *
   * The seed is re-runnable, and it matches on this rather than on the name —
   * so renaming "Comilla" to "Cumilla" in the admin survives the next seed run
   * instead of being reverted or duplicated.
   */
  code: string;

  /** Self-referencing tree, mirroring category.model.ts's proven shape. */
  parent_id?: Types.ObjectId | null;
  /** Ordered ancestor ids (root → … → immediate parent). */
  geo_path?: Types.ObjectId[];
  depth?: number;

  /**
   * Where this row came from.
   *
   * `government` — the administrative list (bd-geo.json). These names are what
   * a name-matching courier would match on.
   * `pathao` — a Pathao delivery zone, added because the official list has no
   * row for the city-corporation districts' own city areas (Dhaka district:
   * a handful of government upazilas vs Pathao's 300+ zones). Carries its own
   * zone_id.
   *
   * Both can live side by side under the same district — they answer different
   * questions, and collapsing them would lose coverage for one courier or the
   * other. See geo.services.ts's `dedupeForPicker` for how the checkout picker
   * collapses the overlap for DISPLAY without deleting either row.
   */
  source?: "government" | "pathao";

  /** Postal code, where one applies. Optional: not every level has one. */
  postal_code?: string;

  courier_refs?: IGeoCourierRefs;

  /**
   * Off switch for a location the shop does not serve. Delivery is refused
   * there, but past orders keep rendering — which is why this is a flag and
   * never a delete.
   */
  is_active?: boolean;

  createdAt?: Date;
  updatedAt?: Date;
}

/** Fields `searchTerm` scans. Add new text fields here or search won't see them. */
export const geoSearchableField = ["name_en", "name_bn", "code", "postal_code"];

/**
 * Shape of `src/data/geo/bd-geo.json`, the checked-in seed.
 *
 * Declared here rather than inferred from the file, because the seed reads it
 * with `readFileSync` + `JSON.parse` and would otherwise be handling `any` at
 * exactly the point where a malformed row turns into hundreds of silently
 * mis-parented locations.
 */
export interface GeoSeedFile {
  _source: string;
  _generated: string;
  divisions: { code: string; name_en: string; name_bn: string }[];
  districts: {
    code: string;
    division: string;
    name_en: string;
    name_bn: string;
  }[];
  upazilas: {
    code: string;
    district: string;
    name_en: string;
    name_bn: string;
  }[];
}

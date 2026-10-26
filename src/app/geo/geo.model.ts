import { Schema, model } from "mongoose";
import { IGeoLocationInterface } from "./geo.interface";

/**
 * geo_locations — see geo.interface.ts for why this collection exists at all.
 *
 * Shape is lifted from category.model.ts on purpose: the same self-referencing
 * `parent_id` + `path[]` + `depth` trio, already proven here for infinite-depth
 * trees, subtree queries and breadcrumbs.
 */
const geoCourierRefsSchema = new Schema(
  {
    pathao: {
      city_id: { type: Number },
      zone_id: { type: Number },
    },
  },
  { _id: false },
);

export const geoLocationSchema = new Schema<IGeoLocationInterface>(
  {
    name_en: { type: String, required: true, trim: true, maxlength: 100 },
    name_bn: { type: String, required: true, trim: true, maxlength: 100 },

    type: {
      type: String,
      required: true,
      enum: ["division", "district", "upazila"],
      index: true,
    },

    // Stable across re-seeds; the seed matches on this, never on the name, so
    // an admin's rename is not undone by the next run. Safe to be globally
    // unique BECAUSE it is a synthetic seed id, never the display name.
    code: { type: String, required: true, unique: true, index: true },

    // ── Nested tree (self-referencing, infinite depth) ──
    parent_id: {
      type: Schema.Types.ObjectId,
      ref: "geo_locations",
      default: null,
      index: true,
    },
    // Ordered ancestor ids (root → … → immediate parent). One indexed query
    // `{ geo_path: nodeId }` returns a whole subtree.
    geo_path: [
      {
        type: Schema.Types.ObjectId,
        ref: "geo_locations",
      },
    ],
    depth: { type: Number, default: 0, index: true },

    source: {
      type: String,
      enum: ["government", "pathao"],
      default: "government",
      index: true,
    },

    postal_code: { type: String, maxlength: 20 },

    courier_refs: { type: geoCourierRefsSchema, default: () => ({}) },

    // A location the shop does not deliver to. Never delete one — orders point
    // at it by name/id, and history must keep rendering.
    is_active: { type: Boolean, default: true, index: true },
  },
  { timestamps: true },
);

// The checkout's own query: "children of X, in name order". Without this it is
// a collection scan on every dropdown open, hundreds of rows deep at the
// upazila level.
geoLocationSchema.index({ parent_id: 1, is_active: 1, name_en: 1 });

// Admin list filtered by level.
geoLocationSchema.index({ type: 1, is_active: 1, name_en: 1 });

// Free-text search across both languages.
geoLocationSchema.index({ name_en: "text", name_bn: "text" });

// ⚠️ DELIBERATELY NOT a bare unique index on name_en/name_bn — Bangladesh
// admin-geography names are not globally unique ("Dhaka" is both a division
// and a district name; several upazila names repeat across different
// districts). Scoped to siblings only: no two children of the SAME parent may
// share a name, which is the only collision that would actually be a bug.
geoLocationSchema.index(
  { parent_id: 1, name_en: 1 },
  { unique: true, partialFilterExpression: { parent_id: { $type: "objectId" } } },
);

// Mapping screens ask "which locations still have no id for this courier?" —
// sparse because the overwhelming majority of rows have no pathao entry at all
// and should not sit in the index.
geoLocationSchema.index(
  { "courier_refs.pathao.city_id": 1 },
  { sparse: true },
);

const GeoLocationModel = model<IGeoLocationInterface>(
  "geo_locations",
  geoLocationSchema,
);

export default GeoLocationModel;

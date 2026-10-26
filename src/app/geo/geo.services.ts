import { Types } from "mongoose";

import ApiError from "../../errors/ApiError";
import {
  IGeoLocationInterface,
  GeoType,
  geoSearchableField,
} from "./geo.interface";
import GeoLocationModel from "./geo.model";

/**
 * The projection the PUBLIC checkout gets. Courier ids are NOT in it.
 *
 * ⚠️ `geo_path` belongs here even though the checkout never displays it: the
 * breadcrumb builds itself from that array. Dropping it from the projection
 * would not error — `node.geo_path` would simply read `undefined` and the
 * breadcrumb would silently return the leaf alone ("Gazipur Sadar" instead of
 * "Dhaka › Gazipur › Gazipur Sadar"). This codebase has hit that exact class of
 * bug before (see allow-list memory notes) — a projection drops a field with no
 * error, and the symptom shows up somewhere else entirely. Before removing a
 * field from this list, find every caller that reads it.
 */
const PUBLIC_FIELDS =
  "_id name_en name_bn type code parent_id geo_path depth postal_code is_active source";

/**
 * The ADMIN projection: everything the public one has, plus the courier
 * mappings the mapping screen edits.
 */
const ADMIN_FIELDS = `${PUBLIC_FIELDS} courier_refs`;

/**
 * Children of one node — the checkout's cascading dropdown.
 *
 * `parent` null returns the divisions (the roots). Inactive locations are
 * omitted: a shop that does not deliver somewhere should not offer it.
 *
 * 🔴 This is the endpoint that makes the whole module worth building: it hits
 * our own collection, so it needs NO courier credentials. The dropdown it feeds
 * used to call Pathao's API live on every request — which meant checkout itself
 * went down whenever Pathao's API did (seen live 2026-10-24).
 */
export const findGeoChildrenServices = async (
  parent?: string | null,
  includeInactive = false,
): Promise<IGeoLocationInterface[]> => {
  const parent_id =
    parent && Types.ObjectId.isValid(parent) ? new Types.ObjectId(parent) : null;

  // 🔴 The admin MUST be able to see what it switched off, or the off switch
  // becomes a one-way door — turning a district off would remove its row from
  // the only page that has the switch, so nothing could ever turn it back on.
  //
  // The public checkout still gets active rows only — the controller decides,
  // and it grants `includeInactive` only to an authenticated admin route.
  const where: any = { parent_id };
  if (!includeInactive) where.is_active = true;

  const rows = await GeoLocationModel.find(where)
    .sort({ name_en: 1 })
    .select(includeInactive ? ADMIN_FIELDS : PUBLIC_FIELDS)
    .lean();

  // The ADMIN sees everything, including both lists' overlap — that is the
  // point of a maintenance screen.
  if (includeInactive) return rows;

  return dedupeForPicker(rows);
};

/**
 * Collapse the two lists into one set of choices.
 *
 * Government upazilas and Pathao's zones can sit under the same district and
 * overlap heavily. Offering both to a customer means showing the same place
 * twice with nothing to choose between them.
 *
 * 🔴 THE PATHAO ROW WINS A COLLISION, and the reason is not that it is better
 * data — it is that it carries a `zone_id`. Keeping the government twin instead
 * would hand Pathao an address it cannot dispatch, while losing nothing that a
 * name-based courier needs: the NAME is what Steadfast is given (as free text),
 * and both rows spell the same place.
 *
 * Government rows survive wherever Pathao has no equivalent — rural upazilas
 * Pathao does not serve — so coverage never shrinks.
 *
 * Deduplication happens HERE rather than by deleting rows, because the two
 * lists answer different questions and a delete cannot be undone by a re-seed.
 */
const dedupeForPicker = (rows: any[]): any[] => {
  // Normalised so "Cox's bazar Sadar" and "Coxs Bazar Sadar" collide.
  //
  // ⚠️ DIGITS ARE KEPT. Stripping them would merge 'Mirpur 1' with
  // 'Mirpur 10', 'Gulshan 1' with 'Gulshan 2' — different places with
  // different delivery zones, silently reduced to whichever sorted first.
  const key = (n: string) => n.toLowerCase().replace(/[^a-z0-9]/g, "");

  const pathaoKeys = new Set(
    rows.filter((r) => r.source === "pathao").map((r) => key(r.name_en)),
  );

  return rows.filter(
    (r) => r.source === "pathao" || !pathaoKeys.has(key(r.name_en)),
  );
};

/**
 * ALL districts, flat, across every division — the checkout's actual first
 * dropdown.
 *
 * Division is skipped entirely in the picker (owner decision, 2026-10-27):
 * one fewer screen to tap through before a customer can even reach District.
 * It isn't lost — `resolveGeoSnapshotServices` below still fills
 * `geo_division_id`/name onto the order by walking the picked district's own
 * `geo_path`, so `billing_state` and the shipping-cost split in
 * order.recompute.ts stay exactly as they were.
 *
 * 64 rows, cheap to return in one shot — no reason to paginate what a picker
 * renders as one scrollable list anyway.
 */
export const findAllDistrictsServices = async (): Promise<any[]> => {
  const rows: any[] = await GeoLocationModel.find({
    type: "district",
    is_active: true,
  })
    .sort({ name_en: 1 })
    .select(PUBLIC_FIELDS)
    .lean();

  // Attach the division's own name onto each row (division_name_en) so the
  // checkout can show a shipping-zone hint and derive billing_state-equivalent
  // display text WITHOUT a second round trip or a Division dropdown of its
  // own. One extra query, not N — divisions are only ever 8 rows.
  const divisionIds = Array.from(
    new Set(rows.map((r) => String((r.geo_path ?? [])[0] || "")).filter(Boolean)),
  );
  const divisions: any[] = await GeoLocationModel.find({
    _id: { $in: divisionIds },
  })
    .select("_id name_en")
    .lean();
  const divisionNameById = new Map(
    divisions.map((d: any) => [String(d._id), d.name_en]),
  );

  return rows.map((r) => ({
    ...r,
    division_name_en: divisionNameById.get(String((r.geo_path ?? [])[0])) || null,
  }));
};

/**
 * One location plus its ancestors, ordered root → leaf.
 *
 * Used to render "Dhaka › Dhaka › Savar" and to snapshot the full address onto
 * an order at place-time. The ancestors come from `geo_path`, which is why that
 * array is stored rather than walked parent-by-parent.
 */
export const findGeoBreadcrumbServices = async (
  id: string,
): Promise<IGeoLocationInterface[]> => {
  if (!Types.ObjectId.isValid(id)) throw new ApiError(400, "Invalid location id");

  const node: any = await GeoLocationModel.findById(id)
    .select(PUBLIC_FIELDS)
    .lean();
  if (!node) throw new ApiError(404, "Location not found");

  const ancestors = await GeoLocationModel.find({
    _id: { $in: node.geo_path ?? [] },
  })
    .select(PUBLIC_FIELDS)
    .lean();

  // `$in` does not preserve order; geo_path does, and the order IS the
  // breadcrumb. Re-sorting by it rather than trusting the query.
  const ordered = (node.geo_path ?? [])
    .map((pid: any) =>
      ancestors.find((a: any) => String(a._id) === String(pid)),
    )
    .filter(Boolean);

  return [...ordered, node];
};

/** Admin list: paginated, filterable by type/parent, searchable. */
export const findAllGeoServices = async (
  limit: number,
  skip: number,
  searchTerm: any,
  filters: { type?: GeoType; parent_id?: string; is_active?: boolean } = {},
): Promise<{ data: IGeoLocationInterface[]; total: number }> => {
  const andCondition: any[] = [];

  if (searchTerm) {
    andCondition.push({
      $or: geoSearchableField.map((field) => ({
        [field]: { $regex: searchTerm, $options: "i" },
      })),
    });
  }
  if (filters.type) andCondition.push({ type: filters.type });
  if (filters.parent_id && Types.ObjectId.isValid(filters.parent_id)) {
    andCondition.push({ parent_id: new Types.ObjectId(filters.parent_id) });
  }
  if (typeof filters.is_active === "boolean") {
    andCondition.push({ is_active: filters.is_active });
  }

  const where: any = andCondition.length > 0 ? { $and: andCondition } : {};

  const [data, total] = await Promise.all([
    GeoLocationModel.find(where)
      .sort({ depth: 1, name_en: 1 })
      .skip(skip)
      .limit(limit)
      .select("-__v")
      .lean(),
    GeoLocationModel.countDocuments(where),
  ]);

  return { data, total };
};

/**
 * Update the parts of a location an admin owns.
 *
 * Deliberately NOT an open `$set` of the body. `code`, `parent_id`, `geo_path`,
 * `depth` and `type` are structural — they are the seed's to maintain, and a
 * stray `depth` from a form would silently break every subtree query. An
 * allow-list is the pattern this codebase already learned the hard way (see
 * `allow-list-write-paths` memory note).
 */
export const updateGeoServices = async (
  id: string,
  data: Partial<IGeoLocationInterface>,
): Promise<IGeoLocationInterface | null> => {
  if (!Types.ObjectId.isValid(id)) throw new ApiError(400, "Invalid location id");

  const patch: any = {};
  if (typeof data.name_en === "string" && data.name_en.trim()) {
    patch.name_en = data.name_en.trim();
  }
  if (typeof data.name_bn === "string" && data.name_bn.trim()) {
    patch.name_bn = data.name_bn.trim();
  }
  if (typeof data.postal_code === "string") {
    patch.postal_code = data.postal_code.trim();
  }
  if (typeof data.is_active === "boolean") patch.is_active = data.is_active;

  // courier_refs is replaced wholesale when present, so clearing a mapping is
  // possible — `{ pathao: {} }` must be able to mean "unset this".
  if (data.courier_refs && typeof data.courier_refs === "object") {
    patch.courier_refs = data.courier_refs;
  }

  if (Object.keys(patch).length === 0) {
    throw new ApiError(400, "Nothing to update");
  }

  const updated = await GeoLocationModel.findByIdAndUpdate(
    id,
    { $set: patch },
    { new: true },
  )
    .select("-__v")
    .lean();

  if (!updated) throw new ApiError(404, "Location not found");
  return updated;
};

/**
 * How complete is Pathao's mapping?
 *
 * Drives the admin's mapping screen, and answers the only question that
 * matters operationally: which districts can Pathao NOT reach yet. Steadfast
 * needs no mapping at all (free-text address), so this is Pathao-only in this
 * clone — see geo.interface.ts for why RedX/Paperfly/eCourier aren't modeled.
 */
export const getGeoMappingStatsServices = async (
  courier: "pathao",
): Promise<any> => {
  const idField = "courier_refs.pathao.city_id";
  const level: GeoType = "district";

  const total = await GeoLocationModel.countDocuments({ type: level });
  const mapped = await GeoLocationModel.countDocuments({
    type: level,
    [idField]: { $nin: [null, ""] },
  });

  const unmapped = await GeoLocationModel.find({
    type: level,
    [idField]: { $in: [null, ""] },
  })
    .sort({ name_en: 1 })
    .select("_id name_en name_bn code")
    .limit(600)
    .lean();

  return { courier, level, total, mapped, missing: total - mapped, unmapped };
};

/**
 * Resolve a client-supplied location id into the snapshot an order stores.
 *
 * 🔴 THE NAMES ARE READ FROM THE DATABASE, NEVER FROM THE REQUEST.
 *
 * Order placement is a PUBLIC, unauthenticated route. If the checkout could
 * post `geo_district_name` directly, anyone could place an order whose stored
 * destination says one thing while its id says another — and the name is what
 * a picker reads, what the invoice prints, and what a name-based courier is
 * actually handed. So only the id crosses the wire; everything else is looked
 * up here.
 *
 * Accepts the deepest id the customer picked and walks UP, so passing an
 * upazila fills the district too. Returns `{}` for a missing or unknown id
 * rather than throwing: a POS walk-in has no delivery geography, and a
 * checkout must not fail because one dropdown was left empty (server-side
 * enforcement that a DELIVERY order has one IS the caller's job, not this
 * function's — see order.controller.ts wiring in Phase 3).
 */
export const resolveGeoSnapshotServices = async (
  locationId?: string | null,
): Promise<{
  geo_division_id?: string;
  geo_division_name?: string;
  geo_district_id?: string;
  geo_district_name?: string;
  geo_upazila_id?: string;
  geo_upazila_name?: string;
}> => {
  if (!locationId || !Types.ObjectId.isValid(locationId)) return {};

  const node: any = await GeoLocationModel.findById(locationId)
    .select("_id name_en type geo_path is_active")
    .lean();
  if (!node) return {};

  const out: any = {};

  if (node.type === "upazila") {
    out.geo_upazila_id = String(node._id);
    out.geo_upazila_name = node.name_en;

    // The district is the last ancestor; geo_path is ordered root → parent.
    const districtId = (node.geo_path ?? []).slice(-1)[0];
    if (districtId) {
      const district: any = await GeoLocationModel.findById(districtId)
        .select("_id name_en")
        .lean();
      if (district) {
        out.geo_district_id = String(district._id);
        out.geo_district_name = district.name_en;
      }
    }
  } else if (node.type === "district") {
    out.geo_district_id = String(node._id);
    out.geo_district_name = node.name_en;
  }

  // Division is skipped in the picker UI (owner decision, 2026-10-27 — one
  // fewer dropdown to tap through), but still resolved and snapshotted here:
  // `billing_state` and order.recompute.ts's shipping-cost "dhaka" match
  // both need the division NAME, not the district's. geo_path is ordered
  // root → parent, so the division is always index 0 regardless of whether
  // the picked node is a district (geo_path = [division]) or an upazila
  // (geo_path = [division, district]).
  const divisionId = (node.geo_path ?? [])[0];
  if (divisionId) {
    const division: any = await GeoLocationModel.findById(divisionId)
      .select("_id name_en")
      .lean();
    if (division) {
      out.geo_division_id = String(division._id);
      out.geo_division_name = division.name_en;
    }
  } else if (node.type === "division") {
    // Defensive — the picker never sends a division id directly anymore,
    // but resolving one correctly if it ever did is cheap and avoids a
    // silent gap.
    out.geo_division_id = String(node._id);
    out.geo_division_name = node.name_en;
  }

  return out;
};

/**
 * The Pathao reference for one location, walking up until something is found.
 *
 * Pathao maps at district level, so a lookup that only checked the exact node
 * would miss a perfectly good district mapping for an upazila-level address.
 * Returns null when nothing is mapped anywhere up the chain — which is not an
 * error: Steadfast needs no mapping at all, and an unmapped location must
 * never block a checkout. It only makes Pathao unavailable for that address.
 */
export const findPathaoRefServices = async (
  locationId: string,
): Promise<{ city_id?: number; zone_id?: number } | null> => {
  if (!Types.ObjectId.isValid(locationId)) return null;

  const node: any = await GeoLocationModel.findById(locationId)
    .select("_id courier_refs geo_path")
    .lean();
  if (!node) return null;

  const own = node.courier_refs?.pathao;
  if (own && Object.values(own).some((v) => v !== null && v !== undefined)) {
    return own;
  }

  // Walk up: nearest ancestor first, so a specific mapping always beats a
  // broader one.
  const ancestors = [...(node.geo_path ?? [])].reverse();
  for (const id of ancestors) {
    const parent: any = await GeoLocationModel.findById(id)
      .select("courier_refs")
      .lean();
    const ref = parent?.courier_refs?.pathao;
    if (ref && Object.values(ref).some((v) => v !== null && v !== undefined)) {
      return ref;
    }
  }
  return null;
};

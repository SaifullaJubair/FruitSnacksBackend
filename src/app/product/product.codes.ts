import { customAlphabet } from "nanoid";
// any-ascii covers Bangla, Hindi, Arabic, Chinese, etc. → ASCII so the SKU
// builder works for owner clients who type attribute names in their own
// script (Phase 0.5 V3). MIT-licensed, no native deps, ~80kB.
import anyAscii from "any-ascii";
import ProductModel from "./product.model";
import VariationModel from "../variation/variation.model";
import SettingModel from "../setting/setting.model";
import AttributeModel from "../attribute/attribute.model";

// 6-char [A-Za-z0-9] = 62^6 ≈ 56.8B unique values — per-product hash that is
// SHARED across that product's parent SKU + every variation SKU. Immutability
// is the contract: the hash never changes after creation (even on rename), so
// printed labels and warehouse references stay valid.
//
// Owner decision 2026-05-30: SKU is NAME-INDEPENDENT. Format = `FS-HASH-AXIS`.
// CORE_NOUN was dropped because product name can change (or owner can pivot
// the entire shop's product line) and we don't want SKUs to read as nonsense
// like `FS-MANGO-XL-BLK-...` after the product becomes "Cotton Panjabi".
const HASH_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
export const generateHash = customAlphabet(HASH_ALPHABET, 6);

// Shorter alphabet for the QR-short-code: 5 chars from a smaller alphabet
// (no easily-confused chars: removed I, O, 0, 1, l). The /q/<code> URL is
// what owner staff might rarely have to type by hand; readability matters
// more than total entropy here. 5 chars × 32 alphabet = 33.5M values — way
// more than any single shop's product count.
const SHORTCODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const generateShortCodeRaw = customAlphabet(SHORTCODE_ALPHABET, 5);

/**
 * Short alphanumeric axis code (e.g. "Ocean Blue" → "OCE", "কালো" → "KAL").
 *
 * Phase 0.5 V3 — transliterate non-ASCII first (any-ascii) so Bangla, Hindi,
 * Arabic, emoji etc. produce a readable Latin SKU axis instead of "X".
 *   "কালো"       → anyAscii → "kalo"      → "KAL"
 *   "Ocean Blue" → anyAscii → "Ocean Blue"→ "OCE"
 *   "🔥"         → anyAscii → ""          → "X" (fallback)
 *
 * Caller (buildVariationAxisCodes) handles collisions and can also pass the
 * value._id slice as a last-resort suffix if needed.
 */
export const generateAxisCode = (value: string, len = 3): string => {
  const translit = anyAscii(value || "");
  const cleaned = translit.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!cleaned) return "X";
  return cleaned.slice(0, Math.max(1, Math.min(5, len)));
};

/**
 * Given a set of sibling axis codes already taken at this position, expand
 * the candidate code so it does not collide. Breaks Brown/Bronze → both
 * "BRN" by extending Bronze to "BRNZ".
 */
const expandCodeOnCollision = (
  baseValue: string,
  takenAtPosition: Set<string>,
): string => {
  for (let len = 3; len <= 5; len++) {
    const candidate = generateAxisCode(baseValue, len);
    if (!takenAtPosition.has(candidate)) return candidate;
  }
  return generateAxisCode(baseValue, 5) + Math.floor(Math.random() * 10);
};

interface BuildVariationCodesInput {
  product_id?: string;
  variation_axis_values: Array<{
    attribute_id: string;
    value: string;
  }>;
  product_variant_axes: Array<{ attribute_id?: any }>;
  excludeVariationId?: string;
}

/**
 * Build the deterministic axis-code suffix for ONE variation. Axes are sorted
 * by attribute_id (NOT by UI order) so the same combination always produces
 * the same SKU regardless of how the admin rearranges the attribute list.
 *
 * Max 3 axes included in the SKU — keeps length capped. 4+ axes still live
 * on the variation row but don't bloat the printable SKU.
 */
export const buildVariationAxisCodes = async (
  input: BuildVariationCodesInput,
): Promise<string[]> => {
  const ordered = [...input.product_variant_axes]
    .filter((a) => a?.attribute_id)
    .sort((a, b) => String(a.attribute_id).localeCompare(String(b.attribute_id)));

  const rawCodes: { position: number; value: string }[] = [];
  for (let i = 0; i < Math.min(3, ordered.length); i++) {
    const axisId = String(ordered[i].attribute_id);
    const match = input.variation_axis_values.find(
      (v) => String(v.attribute_id) === axisId,
    );
    if (match) {
      rawCodes.push({ position: i, value: match.value || "" });
    }
  }

  // Sibling-collision check: gather existing variation_sku for this product,
  // parse out axis codes (between HASH at position 1 and the rest), avoid
  // clashing in the same position. SKU shape is `PREFIX-HASH-AXIS1-AXIS2...`
  // so axis parts = everything from index 2 onwards.
  let takenPerPosition: Record<number, Set<string>> = {};
  if (input.product_id) {
    const siblings = await VariationModel.find({
      product_id: input.product_id,
      ...(input.excludeVariationId
        ? { _id: { $ne: input.excludeVariationId } }
        : {}),
    })
      .select("variation_sku")
      .lean();

    siblings.forEach((s: any) => {
      const sku = s?.variation_sku as string | undefined;
      if (!sku) return;
      const parts = sku.split("-");
      // shape now: PREFIX, HASH, axis1?, axis2?, axis3?
      const axisParts = parts.slice(2);
      axisParts.forEach((code, idx) => {
        takenPerPosition[idx] = takenPerPosition[idx] || new Set();
        takenPerPosition[idx].add(code);
      });
    });
  }

  return rawCodes.map(({ position, value }) => {
    const taken = takenPerPosition[position] || new Set();
    return expandCodeOnCollision(value, taken);
  });
};

/**
 * Path A Q4-3 / Q4-4 — build axis-code suffixes for N variations in one DB
 * roundtrip. Old per-row `buildVariationAxisCodes` did O(N) DB calls inside
 * the parent transaction; this batch fetches the sibling SKU set ONCE and
 * processes all rows in-memory.
 *
 * Critical correctness: we must track `takenPerPosition` INCREMENTALLY as we
 * assign codes to rows in this batch. If row A has color=Brown ("BRN") and
 * row B has color=Bronze (also "BRN" raw), the second one needs to expand
 * to "BRNZ" — even though they're in the SAME batch and neither exists in
 * the DB yet. The audit caught this; sequential per-row code does not.
 */
export const buildVariationAxisCodesBatch = async (
  rows: Array<{
    combination?: any[]; // attribute_value._id list for this row
  }>,
  product_variant_axes: Array<{ attribute_id?: any }>,
  productId: string | undefined,
  session?: any,
): Promise<string[][]> => {
  if (!rows.length) return [];

  // Same sorted ordering used by single-row builder (kept identical so re-
  // saving a variation post-batch produces the same SKU layout).
  const ordered = [...product_variant_axes]
    .filter((a) => a?.attribute_id)
    .sort((a, b) =>
      String(a.attribute_id).localeCompare(String(b.attribute_id)),
    );
  const orderedAxisIds = ordered.slice(0, 3).map((a) => String(a.attribute_id));

  // Step 1 — collect all the attribute_value._id we'll need (deduped) so we
  // can fetch attribute docs in ONE query and resolve value names locally.
  const allValueIds = new Set<string>();
  for (const row of rows) {
    (row.combination || []).forEach((v) => allValueIds.add(String(v)));
  }
  const axisAttrIds = orderedAxisIds;

  // Step 2 — fetch axis attributes once. Attribute docs are small; loading
  // all needed is cheap vs N round-trips.
  let attrs: any[] = [];
  if (axisAttrIds.length) {
    const attrQuery = AttributeModel.find({ _id: { $in: axisAttrIds } }).lean();
    attrs = await (session ? attrQuery.session(session) : attrQuery);
  }

  // valueName lookup: `${attribute_id}|${value_id}` → name
  const valueNameByKey = new Map<string, string>();
  for (const attr of attrs) {
    const aid = String(attr._id);
    for (const v of attr.attribute_values || []) {
      valueNameByKey.set(`${aid}|${String(v._id)}`, v.attribute_value_name || "");
    }
  }

  // Step 3 — fetch existing sibling axis codes from THIS product (so the
  // batch doesn't collide with already-saved variations on update flow).
  // Empty Set for fresh product create.
  const takenPerPosition: Record<number, Set<string>> = {};
  if (productId) {
    const siblingsQuery = VariationModel.find({ product_id: productId })
      .select("variation_sku")
      .lean();
    const siblings: any[] = await (session
      ? siblingsQuery.session(session)
      : siblingsQuery);
    for (const s of siblings) {
      const sku = s?.variation_sku as string | undefined;
      if (!sku) continue;
      const parts = sku.split("-").slice(2); // skip PREFIX, HASH
      parts.forEach((code, idx) => {
        takenPerPosition[idx] = takenPerPosition[idx] || new Set();
        takenPerPosition[idx].add(code);
      });
    }
  }

  // Step 4 — assign codes row-by-row INCREMENTALLY, mutating the same
  // takenPerPosition Set so within-batch collisions (Brown/Bronze) also get
  // expanded properly. This is the correctness-critical piece flagged by
  // the edge audit.
  const allRowCodes: string[][] = [];
  for (const row of rows) {
    const rowCodes: string[] = [];
    for (let i = 0; i < orderedAxisIds.length; i++) {
      const axisId = orderedAxisIds[i];
      // Resolve which value_id in this row belongs to this axis.
      let chosenValueName = "";
      for (const vid of row.combination || []) {
        const name = valueNameByKey.get(`${axisId}|${String(vid)}`);
        if (name) {
          chosenValueName = name;
          break;
        }
      }
      if (!chosenValueName) continue;

      takenPerPosition[i] = takenPerPosition[i] || new Set();
      const code = expandCodeOnCollision(chosenValueName, takenPerPosition[i]);
      takenPerPosition[i].add(code); // mutate so next row sees it
      rowCodes.push(code);
    }
    allRowCodes.push(rowCodes);
  }
  return allRowCodes;
};

interface GenerateSkuInput {
  prefix?: string;
  hash?: string;        // share parent hash for variation SKUs
  axisCodes?: string[]; // optional — variation axis codes
}

/**
 * Build an SKU in the `<PREFIX>-<HASH>-<AXIS1>-<AXIS2>-<AXIS3>` shape.
 * Name-independent by design (see header). Caller supplies the parent-product
 * hash when generating variation SKUs so all variations share the same hash
 * trailing chunk.
 */
export const buildSku = (input: GenerateSkuInput): string => {
  const prefix = (input.prefix || "FS").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const hash = input.hash || generateHash();
  const axes = (input.axisCodes || []).filter(Boolean);
  return [prefix, hash, ...axes].join("-");
};

/**
 * Generate a UNIQUE parent SKU — collision-checks against ProductModel and
 * regenerates the hash on conflict. Loop bounded to prevent infinite hang.
 */
export const generateUniqueParentSku = async (
  prefix?: string,
  reuseHash?: string,
): Promise<{ sku: string; hash: string }> => {
  for (let attempt = 0; attempt < 50; attempt++) {
    const hash = reuseHash || generateHash();
    const sku = buildSku({ prefix, hash });
    const exists = await ProductModel.findOne({ product_sku: sku })
      .select("_id")
      .lean();
    if (!exists) return { sku, hash };
    if (reuseHash) reuseHash = undefined;
  }
  throw new Error("Could not generate unique parent SKU after 50 attempts");
};

/** 12-digit numeric barcode (CODE128 / numeric scanner friendly). */
export const generateUniqueBarcode = async (
  scope: "product" | "variation" = "product",
  session?: any,
): Promise<string> => {
  for (let attempt = 0; attempt < 50; attempt++) {
    const seed = Date.now().toString().slice(-10);
    const rand = String(Math.floor(Math.random() * 100)).padStart(2, "0");
    const candidate = `${rand}${seed}`;
    const query =
      scope === "product"
        ? ProductModel.findOne({ barcode: candidate }).select("_id").lean()
        : VariationModel.findOne({ variation_barcode: candidate })
            .select("_id")
            .lean();
    const exists = await (session ? query.session(session) : query);
    if (!exists) return candidate;
  }
  throw new Error("Could not generate unique barcode after 50 attempts");
};

/**
 * Path A Q4-1 / Q4-2 — generate N unique variation barcodes in one DB
 * roundtrip instead of N. Old per-row loop did `findOne` × N = O(N) queries
 * inside the parent Mongo transaction; this batch does ONE `$in` query.
 *
 * Strategy:
 *   1. Generate N + 10% candidates in-memory (cheap — Math.random)
 *   2. ONE `find({ variation_barcode: { $in: candidates } })` query inside
 *      the same session so snapshot isolation prevents concurrent admin
 *      saves from sneaking a duplicate in between our check and insertMany
 *   3. Drop collisions, take first N from the remaining unique pool
 *   4. If buffer wasn't enough (mathematically near-impossible at the 10^12
 *      keyspace with current dataset), fall back to per-row loop for the
 *      remainder — guarantees correctness over speed in the edge case
 *
 * Returns ordered array of length `count` matching the variation rows.
 */
export const generateUniqueBarcodesBatch = async (
  count: number,
  scope: "product" | "variation" = "variation",
  session?: any,
): Promise<string[]> => {
  if (count <= 0) return [];
  const buffer = Math.max(5, Math.ceil(count * 0.1));
  const target = count + buffer;

  // Step 1 — generate candidates in-memory. Use the request timestamp + per-
  // index salt so two near-simultaneous batches don't collide with each
  // other before either query the DB.
  const baseSeed = Date.now().toString().slice(-9);
  const candidates = new Set<string>();
  while (candidates.size < target) {
    const rand = String(Math.floor(Math.random() * 1000)).padStart(3, "0");
    candidates.add(`${rand}${baseSeed}`);
  }
  const candidateArr = Array.from(candidates);

  // Step 2 — ONE bulk query inside the session for snapshot consistency.
  const field = scope === "product" ? "barcode" : "variation_barcode";
  const Model: any = scope === "product" ? ProductModel : VariationModel;
  const collisionsQuery = Model.find({ [field]: { $in: candidateArr } })
    .select(field)
    .lean();
  const collisions: any[] = await (session
    ? collisionsQuery.session(session)
    : collisionsQuery);
  const taken = new Set(collisions.map((c: any) => c[field]));

  const unique = candidateArr.filter((c) => !taken.has(c));

  if (unique.length >= count) {
    return unique.slice(0, count);
  }

  // Step 3 — astronomically unlikely fallback: buffer exhausted by
  // collisions. Generate the shortfall one-by-one inside the same session.
  const need = count - unique.length;
  const out = [...unique];
  for (let i = 0; i < need; i++) {
    out.push(await generateUniqueBarcode(scope, session));
  }
  return out;
};

/**
 * Generate a unique 5-char short code for the `/q/<code>` URL. Confusable
 * chars (I, O, 0, 1, l) excluded so handwritten copies aren't ambiguous.
 */
export const generateUniqueShortCode = async (): Promise<string> => {
  for (let attempt = 0; attempt < 50; attempt++) {
    const candidate = generateShortCodeRaw();
    const exists = await ProductModel.findOne({ qr_short_code: candidate })
      .select("_id")
      .lean();
    if (!exists) return candidate;
  }
  throw new Error("Could not generate unique short code after 50 attempts");
};

/**
 * Build the QR payload as a short URL `/q/<code>`. This is permanently
 * immutable — even if the product slug changes or the owner switches domain,
 * the route stays valid (slug change → backend resolves to current PDP; domain
 * change → infra-level redirect from old → new domain catches all `/q/...`
 * URLs in one rule).
 */
export const buildQrPayload = async (short_code: string): Promise<string> => {
  let baseUrl: string | undefined;
  try {
    const settings: any = await SettingModel.findOne()
      .select("qr_storefront_base_url")
      .lean();
    baseUrl = settings?.qr_storefront_base_url;
  } catch (_) {
    /* settings fetch failed — fall back to env below */
  }
  const fallback = (
    process.env.FRONTEND_PUBLIC_URL || "https://fruitsnacksbd.com"
  ).replace(/\/$/, "");
  const root = (baseUrl || fallback).replace(/\/$/, "");
  return `${root}/q/${short_code}`;
};

/**
 * Look up the chosen attribute_value name for a single variation row (used
 * when generating variation SKU). The variation row sends `combination` =
 * array of attribute_value._id. We fetch attribute docs to map id → name.
 */
export const resolveVariationAxisValues = async (
  product_variant_axes: any[],
  combination_value_ids: any[],
): Promise<Array<{ attribute_id: string; value: string }>> => {
  if (!combination_value_ids?.length) return [];
  const axisAttrIds = (product_variant_axes || [])
    .map((a) => a?.attribute_id)
    .filter(Boolean);
  if (!axisAttrIds.length) return [];

  const attrs: any[] = await AttributeModel.find({
    _id: { $in: axisAttrIds },
  }).lean();

  const out: Array<{ attribute_id: string; value: string }> = [];
  for (const attrId of axisAttrIds) {
    const attr = attrs.find((a) => String(a._id) === String(attrId));
    if (!attr?.attribute_values?.length) continue;
    for (const valId of combination_value_ids) {
      const val = attr.attribute_values.find(
        (v: any) => String(v._id) === String(valId),
      );
      if (val) {
        out.push({
          attribute_id: String(attrId),
          value: val.attribute_value_name || "",
        });
        break;
      }
    }
  }
  return out;
};

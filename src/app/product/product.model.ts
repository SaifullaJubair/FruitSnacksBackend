import { Schema, model } from "mongoose";
import { randomUUID } from "crypto";
import { IProductInterface } from "./product.interface";
import ThemeModel from "../theme/theme.model";

const adjustThemeUsage = async (themeId: any, delta: number) => {
  if (!themeId) return;
  try {
    await ThemeModel.updateOne(
      { _id: themeId },
      [
        {
          $set: {
            used_in_products: {
              $max: [{ $add: ["$used_in_products", delta] }, 0],
            },
          },
        },
        {
          $set: { is_deletable: { $eq: ["$used_in_products", 0] } },
        },
      ],
    );
  } catch (e) {
    console.warn("[product] theme usage counter update failed", e);
  }
};

// Product Schema
const productSchema = new Schema<IProductInterface>(
  {
    product_name: {
      required: true,
      type: String,
    },
    product_slug: {
      required: true,
      type: String,
      unique: true,
    },
    product_slug_history: [
      {
        type: String,
      },
    ],
    // Phase-1 SKU/Barcode/QR. SKU follows pattern
    // `<PREFIX>-<CORE_NOUN>-<AXIS1>-<AXIS2>-<AXIS3>-<HASH>` (variations share
    // the parent hash). Sparse unique index so products without SKU don't
    // collide. Once set, the SKU is locked in the admin form by default — see
    // Option C "Edit SKU" warning modal in the admin product form.
    product_sku: {
      // No inline `index: true` — explicit sparse-unique index below avoids
      // Mongoose's duplicate-index warning at boot.
      type: String,
    },
    // 6-char nanoid alphanumeric. SHARED across the parent product + every
    // variation of that product, so variations are visually grouped by SKU.
    // Immutable across product rename (industry standard, Shopify/Amazon).
    product_sku_hash: {
      type: String,
    },
    product_status: {
      required: true,
      type: String,
      enum: ["active", "in-active"],
      default: "active",
    },
    // Single leaf category in the nested tree. category_path = ancestor ids
    // (root → … → parent of this leaf) copied from the category at assign time,
    // enabling subtree filtering ("all products under node X") without joins.
    // Phase L: category is now OPTIONAL — small sellers / single-item shops
    // shouldn't need to invent a category just to publish a product. Subtree
    // filter (`category_path`) gracefully handles the missing case.
    category_id: {
      type: Schema.Types.ObjectId,
      ref: "categories",
      index: true,
    },
    category_path: [
      {
        type: Schema.Types.ObjectId,
        ref: "categories",
      },
    ],
    brand_id: {
      type: Schema.Types.ObjectId,
      ref: "brands",
    },
    attributes_details: [
      {
        // Phase 0 fix — source attribute._id snapshot. Frontend helper
        // `variantAxisAttributes()` matches this against `variant_axes[]
        // .attribute_id`. The Mongoose-autogen subdoc `_id` is unrelated
        // and must NOT be used for that match. Optional only because
        // pre-Phase-0 documents may not have it until the backfill script
        // runs — see scripts/backfill-attribute-id.ts.
        attribute_id: {
          type: Schema.Types.ObjectId,
          ref: "attributes",
        },
        attribute_name: {
          type: String,
        },
        attribute_values: [
          {
            attribute_value_name: {
              type: String,
            },
            attribute_value_code: {
              type: String,
            },
          },
        ],
      },
    ],

    // ── Structured attribute engine (Phase 1) ──
    // Chosen attribute values by id (→ attributes collection). Single source of
    // truth for both the PDP spec table and the filter facets. value_ids is
    // indexed so the filter can match products by value without a join.
    product_attributes: [
      {
        _id: false,
        attribute_id: {
          type: Schema.Types.ObjectId,
          ref: "attributes",
          index: true,
        },
        value_ids: [
          {
            type: Schema.Types.ObjectId,
            index: true,
          },
        ],
        // Batch 2 E6 — per-product, per-attribute "should this surface in the
        // storefront filter sidebar?". Default true preserves legacy behaviour
        // (every attribute appears in the filter). Admin can untoggle for
        // internal-only attributes (e.g. Manufacturer, Batch number) so PDP
        // spec table still shows it but filter sidebar skips it.
        show_in_filter: {
          type: Boolean,
          default: true,
        },
      },
    ],
    // Which attributes form variation combinations (subset of product_attributes).
    variant_axes: [
      {
        _id: false,
        attribute_id: {
          type: Schema.Types.ObjectId,
          ref: "attributes",
        },
        is_mandatory: {
          type: Boolean,
          default: true,
        },
      },
    ],

    barcode: {
      // No inline `index: true` — explicit sparse-unique index below avoids
      // Mongoose's duplicate-index warning at boot.
      type: String,
    },
    barcode_image: {
      type: String,
    },
    barcode_image_key: {
      type: String,
    },
    barcode_format: {
      type: String,
      enum: ["CODE128", "EAN13", "UPC", "ITF14", "CUSTOM"],
      default: "CODE128",
    },
    description: {
      type: String,
    },
    main_image: {
      type: String,
    },
    main_image_key: {
      type: String,
    },
    size_chart: {
      type: String,
    },
    size_chart_key: {
      type: String,
    },
    // Structured size guide (niche-agnostic). `size_guide_columns` are the
    // admin-defined headers (e.g. ["Size","EU","UK","CM"] for shoes, or
    // ["Size","Chest","Waist","Length"] for shirts); each row in
    // `size_guide_rows` is a flat string[] of cell values aligned to those
    // columns. Rendered as a table on the PDP, data-gated (hidden when empty),
    // so food / unsized products simply leave it blank. The size_chart IMAGE
    // above is separate and complements this (admin can give either or both).
    size_guide_title: { type: String },
    size_guide_note: { type: String },
    size_guide_columns: [{ type: String }],
    size_guide_rows: [[{ type: String }]],
    main_video: {
      type: String,
    },
    main_video_key: {
      type: String,
    },
    other_images: [
      {
        other_image: {
          type: String,
        },
        other_image_key: {
          type: String,
        },
      },
    ],
    product_price: {
      type: Number,
    },
    product_buying_price: {
      type: Number,
    },
    product_discount_price: {
      type: Number,
    },
    product_quantity: {
      type: Number,
    },
    product_alert_quantity: {
      type: Number,
    },
    is_variation: {
      type: Boolean,
      default: false, // Default value can be added
    },
    product_warrenty: {
      type: String,
    },
    product_return: {
      type: String,
    },
    unit: {
      type: String,
    },
    meta_title: {
      type: String,
    },
    meta_description: {
      type: String,
    },
    meta_keywords: [
      {
        keyword: {
          type: String,
        },
      },
    ],
    product_publisher_id: {
      type: Schema.Types.ObjectId,
      ref: "admins",
      required: true,
    },
    product_updated_by: {
      type: Schema.Types.ObjectId,
      ref: "admins",
    },
    product_campaign_id: {
      type: Schema.Types.ObjectId,
      ref: "campaigns",
    },
    product_supplier_id: {
      type: Schema.Types.ObjectId,
      ref: "suppliers",
    },
    trending_product: {
      type: Boolean,
      default: true, // Default value can be added
    },

    // ===== Dynamic Product Page System =====

    theme_id: {
      type: Schema.Types.ObjectId,
      ref: "themes",
      index: true,
    },
    theme_overrides: {
      type: {
        colors: {
          primary: { type: String },
          page_bg: { type: String },
          accent: { type: String },
        },
        button_style: {
          border_radius: { type: String },
          variant: {
            type: String,
            enum: ["filled", "outlined", "gradient"],
          },
        },
      },
      default: undefined,
      _id: false,
    },

    short_description: { type: String, maxlength: 200 },
    badge_text: { type: String },
    // Small badge overlaid on the hero image corner (e.g. "নতুন", "বেস্ট সেলার").
    hero_corner_badge: { type: String },
    // Custom heading for the VideoSection ("দেখুন কিভাবে তৈরি হয়" area).
    video_title: { type: String },
    // Optional accent images sitting next to the Benefits / Use Cases cards.
    // Fall back to main_image on the storefront when not set. _key fields are
    // the S3 keys (used for deletion).
    benefits_side_image: { type: String },
    benefits_side_image_key: { type: String },
    use_cases_side_image: { type: String },
    use_cases_side_image_key: { type: String },
    faq_side_image: { type: String },
    faq_side_image_key: { type: String },
    // Per-section "show the side image on PDP" toggle. Absent = show (the
    // storefront gate is `!== false`, so legacy products keep their image +
    // main_image fallback). Setting false hides the side image entirely,
    // including the main_image fallback.
    benefits_side_image_show: { type: Boolean, default: true },
    use_cases_side_image_show: { type: Boolean, default: true },
    faq_side_image_show: { type: Boolean, default: true },

    short_features: [
      {
        _id: false,
        icon_url: { type: String },
        icon_key: { type: String },
        text: { type: String },
      },
    ],
    process_steps: [
      {
        _id: false,
        icon_url: { type: String },
        icon_key: { type: String },
        text: { type: String },
      },
    ],

    // benefits: per-item text + optional admin-picked/uploaded icon (mirrors
    // use_cases). Schema.Types.Mixed so legacy string[] rows (seed/demo + older
    // products) still load — the FE + write-path normalize handle both shapes.
    benefits: [{ type: Schema.Types.Mixed }],

    use_cases: [
      {
        _id: false,
        icon_url: { type: String },
        icon_key: { type: String },
        text: { type: String },
      },
    ],

    // Fully free-form nutrition: admin adds any rows (table) + info tiles.
    nutrition: {
      type: {
        per_serving: String, // optional heading shown next to "পুষ্টি তথ্য"
        rows: [
          {
            _id: false,
            label: { type: String },
            value: { type: String },
          },
        ],
        info_tiles: [
          {
            _id: false,
            label: { type: String },
            value: { type: String },
            icon_key: { type: String },
          },
        ],
      },
      default: undefined,
      _id: false,
    },

    faqs: [
      {
        _id: false,
        question: { type: String, required: true },
        answer: { type: String, required: true },
      },
    ],

    // Per-product floating accent images (transparent PNG/WebP). Placement is
    // percentage-based so it stays responsive. vertical = "" → auto-distribute.
    floating_images: [
      {
        _id: false,
        asset_url: { type: String },
        asset_key: { type: String },
        vertical: { type: String }, // "10" | "25" | "40" | "55" | "70" | "85" | "" (auto)
        side: { type: String, enum: ["left", "right"], default: "left" },
        layer: { type: String, enum: ["behind", "front"], default: "behind" },
        size: { type: String, enum: ["sm", "md", "lg"], default: "md" },
      },
    ],

    // Section-anchored override layer over the assigned theme's floating_assets.
    // Empty → product inherits the theme floats unchanged. See IProductFloatingOverrides.
    floating_overrides: {
      type: {
        _id: false,
        // Theme asset ids the product hides (inherited-but-removed).
        hidden_ids: { type: [String], default: [] },
        // Theme asset id → product-specific replacement image (same slot).
        replacements: {
          type: [
            {
              _id: false,
              theme_asset_id: { type: String, required: true },
              asset_url: { type: String, required: true },
              // key optional — only needed for S3 cleanup; a URL-only
              // replacement (legacy / pasted URL) is still valid.
              asset_key: { type: String, default: "" },
            },
          ],
          default: [],
        },
        // Floats unique to THIS product (same shape as theme.floating_assets).
        extras: {
          type: [
            {
              _id: false,
              id: { type: String, default: () => randomUUID() },
              asset_url: { type: String, required: true },
              // key optional — only needed for S3 cleanup; legacy floats had a
              // URL but no key, and admins may paste a URL directly.
              asset_key: { type: String, default: "" },
              position: { type: String, enum: ["left", "right"], default: "left" },
              align: {
                type: String,
                enum: ["top", "middle", "bottom"],
                default: "middle",
              },
              // MULTI-NICHE-DEBT: section enum hardcoded food — mirror of theme.model.ts.
              // Derive from pdp_section_array when the PDP section registry lands.
              // See docs/_ai/MULTI_NICHE_PLAN.md §4.
              section: {
                type: String,
                enum: [
                  "hero",
                  "order",
                  "benefits",
                  "use_cases",
                  "nutrition",
                  "reviews",
                  "faq",
                  "any",
                ],
                default: "any",
              },
              animation_type: {
                type: String,
                enum: ["float", "spin", "bounce", "sway", "none"],
                default: "float",
              },
              animation_speed: {
                type: String,
                enum: ["slow", "normal", "fast"],
                default: "normal",
              },
              size: {
                type: String,
                enum: ["xs", "sm", "md", "lg"],
                default: "md",
              },
              opacity: { type: Number, min: 0, max: 1, default: 1 },
              hide_on_mobile: { type: Boolean, default: true },
            },
          ],
          default: [],
        },
      },
      default: undefined,
    },

    og_image: { type: String },
    og_image_key: { type: String },
    og_title: { type: String },
    og_description: { type: String },

    // ── Phase F: additive fields ──────────────────────────────────────────────
    video_link: { type: String },
    condition: {
      type: String,
      enum: ["new", "used", "refurbished"],
      default: "new",
    },
    sold_count: { type: Number, default: 0 },
    view_count: { type: Number, default: 0 },
    product_weight_grams: { type: Number },
    product_dimensions: {
      length: { type: Number },
      width: { type: Number },
      height: { type: Number },
    },
    custom_fields: [
      {
        _id: false,
        label: { type: String, required: true },
        value: { type: String, required: true },
        icon_key: { type: String },
      },
    ],
    qr_code: { type: String },
    qr_code_image: { type: String },
    qr_code_image_key: { type: String },
    // Last regen timestamp — admin UI can show "stale, regenerate" hint when
    // the product slug changes after the QR was last built.
    qr_code_updated_at: { type: Date },
    // 5-char permanent short code for `/q/<code>` URL pattern. Immutable for
    // the product's lifetime — domain change or slug change cannot break a
    // printed QR because the code resolves server-side to the current PDP.
    // No inline `index: true` — explicit sparse-unique index below avoids
    // Mongoose's duplicate-index warning at boot.
    qr_short_code: { type: String },
    product_type: {
      type: String,
      enum: [
        "simple",
        "variable",
        "digital",
        "combo",
        "preorder",
        "subscription",
      ],
      default: "simple",
    },
    bundle_items: [
      {
        _id: false,
        product_id: { type: Schema.Types.ObjectId, ref: "products" },
        quantity: { type: Number, default: 1 },
      },
    ],
    download_url: { type: String },
    license_key: { type: String },
    available_from: { type: Date },
    billing_interval: { type: String, enum: ["monthly", "yearly"] },
    // Phase E — tier pricing (qty↑ → price↓). Resolver picks the lowest tier
    // whose min_qty ≤ ordered quantity.
    tier_prices: [
      {
        _id: false,
        min_qty: { type: Number, required: true },
        price: { type: Number, required: true },
      },
    ],

    // ── Phase H: future-proof field stubs ──────────────────────────────────
    warehouse_id: { type: Schema.Types.ObjectId, ref: "warehouses" },
    group_prices: [
      {
        _id: false,
        group: { type: String, enum: ["wholesale", "vip"], required: true },
        price: { type: Number, required: true },
      },
    ],
    vat_percentage_override: { type: Number },

    // ── M20 (2026-06-04): per-product delivery rule. Default `inherit` means
    // this product follows the global zone charge + free-delivery rule. Other
    // modes override per-line. See order.recompute.ts recomputeShippingCost
    // for the per-line-additive formula.
    delivery_mode: {
      type: String,
      enum: ["inherit", "free", "flat", "qty_threshold"],
      default: "inherit",
    },
    delivery_flat_amount: { type: Number },
    delivery_free_after_qty: { type: Number },

    // Demo-seed marker. true ONLY for docs created by `npm run seed:demo` so the
    // Admin "Clear demo data" button can remove the whole demo catalog in one
    // click (delete-by-flag, never by name/slug). Default false; STRIPPED from
    // admin create/update payloads so it can never be set true via the form.
    is_demo: { type: Boolean, default: false, index: true },
  },
  {
    timestamps: true,
  },
);

// Theme usage counter — keep themes.used_in_products in sync
productSchema.post("save", async function (doc: any) {
  if (doc.theme_id) {
    await adjustThemeUsage(doc.theme_id, +1);
  }
});

productSchema.post("findOneAndDelete", async function (doc: any) {
  if (doc?.theme_id) {
    await adjustThemeUsage(doc.theme_id, -1);
  }
});

productSchema.post("deleteOne", { document: true, query: false }, async function (this: any) {
  if (this?.theme_id) {
    await adjustThemeUsage(this.theme_id, -1);
  }
});

// Track theme changes via findOneAndUpdate
productSchema.pre("findOneAndUpdate", async function () {
  const update: any = this.getUpdate();
  const newThemeId = update?.theme_id ?? update?.$set?.theme_id;
  if (newThemeId) {
    const existing: any = await this.model.findOne(this.getQuery()).lean();
    if (existing && String(existing.theme_id) !== String(newThemeId)) {
      // stash old + new on options for post hook
      this.setOptions({
        ...(this.getOptions() || {}),
        _prevThemeId: existing.theme_id,
        _newThemeId: newThemeId,
      });
    }
  }
});

productSchema.post("findOneAndUpdate", async function () {
  const opts: any = this.getOptions();
  if (opts?._prevThemeId) {
    await adjustThemeUsage(opts._prevThemeId, -1);
  }
  if (opts?._newThemeId) {
    await adjustThemeUsage(opts._newThemeId, +1);
  }
});

// Sparse unique — uniqueness enforced when present; products without SKU /
// barcode (small shops at launch) don't collide. Sparse:true is REQUIRED for
// back-compat with existing docs that have no SKU/barcode field at all.
productSchema.index({ product_sku: 1 }, { unique: true, sparse: true });
productSchema.index({ barcode: 1 }, { unique: true, sparse: true });
productSchema.index({ qr_short_code: 1 }, { unique: true, sparse: true });

const ProductModel = model<IProductInterface>("products", productSchema);

export default ProductModel;

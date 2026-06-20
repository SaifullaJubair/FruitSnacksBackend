# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> For complete API documentation in Bangla (every module, every endpoint, every database schema), see [docs/backend.md](../docs/backend.md) in the monorepo root.
> For known bugs and improvement opportunities, see [docs/issues.md](../docs/issues.md).

## Commands

```bash
# Development (hot-reload via ts-node-dev)
npm run dev

# Production build (compiles TypeScript → dist/)
npm run build

# Run compiled production server
npm start
```

No test runner or linter is configured.

## Environment Variables

Create a `.env` file with these required variables:

```
MONGO_URI=
PORT=8080
ACCESS_TOKEN=                # JWT signing secret

# DigitalOcean Spaces (S3-compatible)
S3_REGION=
S3_ENDPOINT=
S3_ACCESS_KEY=
S3_SECRET_KEY=
S3_BUCKET=                   # e.g. "fruit-snacks"
S3_PUBLIC_URL=               # CDN/public URL prefix

# Pathao courier
PATHAO_BASE_URL=
PATHAO_CLIENT_ID=
PATHAO_CLIENT_SECRET=
PATHAO_CLIENT_EMAIL=
PATHAO_CLIENT_PASSWORD=

# Steadfast courier
STEADFAST_CLIENT_ID=
STEADFAST_CLIENT_PASSWORD=

# Fraud detection (optional)
FRAUDBD_API_KEY=
```

## Architecture

**Stack:** Express + TypeScript + MongoDB (Mongoose) + DigitalOcean Spaces (S3) + Pathao/Steadfast couriers

**Entry points:**
- [src/index.ts](src/index.ts) — Express app, CORS, middleware, route mounting, daily cron job
- [src/server.ts](src/server.ts) — Mongoose connection
- [src/routes/routes.ts](src/routes/routes.ts) — Central router that mounts all 45+ module routes under `/api/v1`

### Module Pattern (CRISM)

Every feature module under `src/app/[module]/` follows:

```
[module].interface.ts   — TypeScript interfaces + searchable fields array export
[module].model.ts       — Mongoose schema + model
[module].services.ts    — Business logic (direct DB calls, aggregations)
[module].controllers.ts — HTTP handlers, call services, use sendResponse()
[module].routes.ts      — Express router, applies verifyToken() where needed
```

### Module Groups (37 modules total)

> ⚠️ Module list updated 2026-06-16. Removed: `sub_category`, `child_category`, `specification` (→ nested category tree + attribute engine), `offerOrder` (→ merged into `orders` as `order_type:"offer"`). Authoritative mount list: [src/routes/routes.ts](src/routes/routes.ts).

| Group | Modules |
|-------|---------|
| **Auth & Users** | authentication, adminRegLog, user, role, getme, supplier |
| **Catalog** | category (nested tree), brand, attribute, product, variation, productFilter |
| **Commerce** | cart, order (offer merged), orderProducts, order/courier (Pathao+Steadfast), order/webhook, fraud, coupon, payment (SSLCommerz) |
| **Marketing** | campaign, offer, flashsale, banner, slider, review, question |
| **Storefront extras** | wishlist, wallet, loyalty, abandonedCart, productFeed, siteFaq, newsletterSubscriber, trustPoint |
| **Admin Config** | setting, pageSeo, theme, faq_template, dashboard, warehouse, demo, paymentWithdrawList, withdrow_payment_method |
| **Integrations** | metaPixel, tiktokPixel, image upload helpers |

### Key Shared Utilities

- [src/shared/sendResponse.ts](src/shared/sendResponse.ts) — Standard response shape: `{ statusCode, success, message, data, totalData? }`
- [src/errors/ApiError.ts](src/errors/ApiError.ts) — Custom error class with `statusCode`; thrown from services, caught by global handler
- [src/middlewares/global.error.handler.ts](src/middlewares/global.error.handler.ts) — Converts ApiError, Mongoose ValidationError, and CastError to standard responses
- [src/middlewares/verify.token.ts](src/middlewares/verify.token.ts) — `verifyToken(permission: string)` for admin JWT + RBAC check
- [src/middlewares/verify.user.token.ts](src/middlewares/verify.user.token.ts) — `verifyUserToken` for storefront user auth (cart module)
- [src/helpers/image.upload.ts](src/helpers/image.upload.ts) — Multer config + DigitalOcean Spaces (S3) uploader

### Authentication & RBAC

Two parallel auth systems:

1. **Admin auth** — JWT in httpOnly cookie `fruit_snacks_token`, signed with `ACCESS_TOKEN`. Each admin has a `role_id` referencing a role document with ~100 boolean permission flags (e.g., `category_post`, `product_update`, `theme_delete`). Apply `verifyToken("module_action")` on protected routes; omit for public endpoints.

2. **User auth** — Separate `verifyUserToken` middleware for storefront users (cart, profile). Same `fruit_snacks_token` cookie name but verified against `users` collection instead of `admins`.

### Database Conventions

- Soft deletes: most modules use `status: "active" | "in-active"` fields; cart and OTP records use hard delete
- `.lean()` on read-only queries for performance
- `.select("-password")` (and similar) to exclude sensitive fields
- Slug history arrays on products for SEO 301 redirect support (`product_slug_history`)
- Mongoose sessions used for multi-document transactions (product creation, order checkout)
- ObjectId reference pattern — almost every entity tracks `_publisher_id` (admin who created) and `_updated_by` (admin who last edited)

### Nested Category Tree (infinite depth)

The legacy 3-level hierarchy (`category → sub_category → child_category`) has been replaced by a single self-referencing `categories` collection. Each node has:

- `parent_id` — null for root, ObjectId for nested
- `category_path` — ordered ancestor ids (root → … → immediate parent), enabling subtree filter `{ category_path: nodeId }` to match the node and every descendant in one indexed query
- `depth` — path length (0 = root)
- `default_variant_attributes` / `default_filter_attributes` — attribute suggestions inherited by descendants via `resolveCategoryDefaults()` (parent-chain merge, dead-ref self-heal, cycle guard)

Products carry `category_id` (a single leaf, OPTIONAL since Phase L) + `category_path` (snapshot of the category's ancestors, refreshed on re-parent cascade). Storefront filter / breadcrumbs read `category_path`.

`updateCategoryServices` handles re-parent with cycle prevention + transactional descendant + product cascade. `getReparentImpactServices` returns descendant + product counts for the admin's confirm dialog. `deleteCategoryServices` enforces leaf-only delete + `$pull`s the deleted id from any stale product `category_path` entries.

### Dynamic Product Page System

A theming layer that lets each product page render with a unique palette, floating fruit images, fonts, and button style. See [FEATURE_PLAN.md](../docs/FEATURE_PLAN.md) for the complete spec.

Key wiring:
- `themes` collection holds reusable theme presets (colors, floating_assets, typography, button_style)
- `products.theme_id` → references a theme; `products.theme_overrides` lets per-product fields override the base theme
- `categories.default_theme_id` → applied to new products in that category node by default (nested tree; was subcategories)
- Product model has 4 lifecycle hooks (`save`, `findOneAndDelete`, `deleteOne`, `findOneAndUpdate`) that keep `themes.used_in_products` counter in sync — this drives the `is_deletable` flag (a theme used by any product cannot be deleted)
- `faq_templates` collection — reusable FAQ entries admin can copy into a product's `faqs[]` array
- Variations now have `variation_weight_grams` to fix the old hardcoded `0.5kg` Pathao courier weight

### External Integrations

- **Couriers:** Pathao (OAuth token cached in-memory with expiry) and Steadfast (API key) — both have send/track/cancel/sync endpoints under `/api/v1/courier/*`, and both have webhook endpoints at `/api/v1/webhook/*` for real-time status updates
- **Fraud detection:** FraudBD API for phone-number based risk assessment, combined with internal order history → returns risk level (High/Medium/Low/New)
- **File storage:** DigitalOcean Spaces via AWS S3 SDK; local temp via `uploads/` directory then deleted after S3 upload
- **Analytics CAPI:** Meta Pixel and TikTok Pixel server-side conversion API endpoints (`/meta-pixel/event`, `/tiktok-pixel/event`)
- **SMS:** BulkSMS BD provider configured in `authentication` collection (and duplicated in `settings`)

### Cron Job

`node-cron` runs nightly at 23:55 UTC ([src/index.ts](src/index.ts)) to:
- Deactivate offers whose `offer_end_date` equals today
- Deactivate campaigns whose `campaign_end_date` equals today, and `$unset` the `product_campaign_id` field on every product in that campaign's `campaign_products[]` list

## Conventions and Pitfalls

### File naming
Some folders/fields have misspellings preserved for backward compatibility:
- `withdrow_payment_method` (should be `withdraw_`)
- `product_warrenty` field (should be `warranty`)
Don't fix these silently — they're referenced across all three apps; coordinate a rename if needed.

### Backup files to ignore
Files ending in ` copy.ts` are legacy backups and not part of the active code:
- `product.interface copy.ts`, `setting.model copy.ts`, `order.controller copy.ts`, `user.controllers copy.ts`, `setting.interface copy.ts`

### Route ordering matters
In [order.routes.ts](src/app/order/order.routes.ts), `/:order_id` must be the LAST route — otherwise `/dashboard`, `/steadfast`, `/pathao` all get matched as `:order_id` and throw CastError.

### Permission flags
When adding a new module, you must also:
1. Add `<module>_<action>` boolean fields to [role.interface.ts](src/app/role/role.interface.ts) AND [role.model.ts](src/app/role/role.model.ts)
2. Add the same flag values to [FruitSnacksAdmin/src/data/permissionData.js](../FruitSnacksAdmin/src/data/permissionData.js) so the admin UI exposes them

### Webhook responses
Pathao webhook expects HTTP 202 (not 200). Steadfast webhook can accept either.

### Search pattern
Every module exports a `<module>SearchableField` string array consumed by service-layer search queries via regex `$or` against those fields. When adding a searchable text field to a schema, add it to this array too.

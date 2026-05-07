# FruitSnacks Backend

REST API for the FruitSnacks e-commerce platform — Express + TypeScript + MongoDB, with cookie-based JWT auth and role-based admin permissions.

## Tech Stack

- **Node.js** + **Express 4** + **TypeScript 5**
- **MongoDB** via **Mongoose 8**
- **JWT** auth via httpOnly cookie (`fruit_snacks_token`)
- **AWS S3 SDK v3** (used with Contabo / DigitalOcean Spaces) for image + video uploads via **Multer**
- **node-cron** for scheduled jobs
- **bcryptjs**, **cookie-parser**, **cors**, **dotenv**
- Payment integrations: **SSLCommerz**, **bKash**
- Courier integrations: **Pathao**, **Steadfast** (with webhook endpoints)
- Notifications: **Nodemailer** (email), BulkSMS BD HTTP API (SMS/OTP), Meta + TikTok server-side pixel events
- **QRCode** generation for invoices

## Getting Started

```bash
npm install
npm run dev          # ts-node-dev hot reload, default port 5000
```

For production:

```bash
npm run build        # compiles TypeScript -> dist/
npm start            # runs node dist/index.js
```

## Environment Variables

Create a `.env` file in the project root with the following keys:

```env
PORT=5000
SITE_TITLE=FruitSnacks
SITE_URL=https://fruitsnacksbd.com

MONGO_URI=mongodb://...                # MongoDB connection string
ACCESS_TOKEN=<jwt-signing-secret>      # used to sign auth cookies

# S3-compatible storage (Contabo / DigitalOcean Spaces / AWS)
S3_REGION=
S3_ENDPOINT=
S3_ACCESS_KEY=
S3_SECRET_KEY=
S3_BUCKET=
S3_FORCE_PATH_STYLE=true
S3_PUBLIC_URL=

# Couriers
STEADFAST_API_KEY=
STEADFAST_SECRET_KEY=
PATHAO_BASE_URL=
PATHAO_CLIENT_ID=
PATHAO_CLIENT_SECRET=
PATHAO_CLIENT_EMAIL=
PATHAO_CLIENT_PASSWORD=
PATHAO_STORE_ID=
PATHAO_WEBHOOK_SECRET=

# Fraud check + analytics
FRAUDBD_API_KEY=
META_PIXEL_ID=
META_ACCESS_TOKEN=
META_TEST_EVENT_CODE=
TIKTOK_PIXEL_ID=
TIKTOK_ACCESS_TOKEN=

# SMS / OTP
BULKSMS_API_KEY=
BULKSMS_SENDER_ID=
```

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Hot-reload dev server via `ts-node-dev` |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run compiled production server |

> No test runner is configured.

## Architecture

### Module Pattern

Every feature under `src/app/<module>/` follows the same five-file shape:

```
<module>.interface.ts    # TypeScript interfaces + searchableFields
<module>.model.ts        # Mongoose schema + model
<module>.services.ts     # Business logic (DB calls, aggregations)
<module>.controllers.ts  # HTTP handlers, call services, use sendResponse()
<module>.routes.ts       # Express router, applies verifyToken() where needed
```

Routes are aggregated in [src/routes/routes.ts](src/routes/routes.ts) under the `/api/v1` prefix.

### Auth & RBAC

- Login issues a JWT signed with `ACCESS_TOKEN`, set as the `fruit_snacks_token` httpOnly cookie.
- Each admin has a `role_id` referencing a Role document with ~100 boolean permission flags (e.g. `product_post`, `order_update`, `category_delete`).
- Protected routes apply `verifyToken("module_action")` from [src/middlewares/verify.token.ts](src/middlewares/verify.token.ts).
- Customer-facing routes use [src/middlewares/verify.user.token.ts](src/middlewares/verify.user.token.ts).

### Database Conventions

- **Soft deletes** via `status: "active" | "in-active"` fields — no hard deletes.
- `.lean()` on read-only queries; `.select("-password")` to exclude sensitive fields.
- Slug history arrays on products for SEO-safe redirects.
- Mongoose sessions for multi-document transactions (e.g. order + stock + campaign updates).

### External Integrations

- **Couriers** — Pathao (token cached with expiry) and Steadfast both expose webhook endpoints for real-time status updates; courier-specific statuses are mapped to internal order statuses.
- **Payments** — SSLCommerz and bKash, wired into the order flow.
- **Storage** — DigitalOcean Spaces / Contabo via AWS S3 SDK v3; uploads stream from a local `uploads/` temp directory.
- **Cron** — `node-cron` runs nightly at 23:55 to expire campaigns and offers past their end date and unset campaign references on affected products.
- **Pixel events** — Server-side Meta + TikTok events fired on Login, Purchase, etc.

### Shared Utilities

- [src/shared/sendResponse.ts](src/shared/sendResponse.ts) — standard response shape `{ statusCode, success, message, data, totalData? }`.
- [src/errors/ApiError.ts](src/errors/ApiError.ts) — typed error class with `statusCode`; thrown from services, caught by global handler.
- [src/middlewares/global.error.handler.ts](src/middlewares/global.error.handler.ts) — converts ApiError, Mongoose ValidationError, and CastError to standard JSON responses.
- [src/helpers/image.upload.ts](src/helpers/image.upload.ts) — Multer config + S3 uploader for images and videos.

## CORS

Allowed origins are listed in [src/index.ts](src/index.ts). Add new buyer/staging domains there alongside the existing `fruitsnacksbd.com` entries.

For deeper architectural guidance, see [CLAUDE.md](CLAUDE.md).

## Related Repos

- Admin: [FruitSnacksAdmin](https://github.com/SaifullaJubair/FruitSnacksAdmin)
- Storefront: [FruitSnacksFrontend](https://github.com/SaifullaJubair/FruitSnacksFrontend)

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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
ACCESS_TOKEN=
S3_REGION=
S3_ENDPOINT=
S3_ACCESS_KEY=
S3_SECRET_KEY=
S3_BUCKET=
PATHAO_BASE_URL=
PATHAO_CLIENT_ID=
PATHAO_CLIENT_SECRET=
PATHAO_CLIENT_EMAIL=
PATHAO_CLIENT_PASSWORD=
STEADFAST_CLIENT_ID=
STEADFAST_CLIENT_PASSWORD=
```

## Architecture

**Stack:** Express + TypeScript + MongoDB (Mongoose)

**Entry points:**
- [src/index.ts](src/index.ts) — Express app, CORS, middleware, route mounting
- [src/server.ts](src/server.ts) — Mongoose connection
- [src/routes/routes.ts](src/routes/routes.ts) — Central router that mounts all 35+ module routes

### Module Pattern (CRISM)

Every feature module under `src/app/[module]/` follows:

```
[module].interface.ts   — TypeScript interfaces + searchable fields array export
[module].model.ts       — Mongoose schema + model
[module].services.ts    — Business logic (direct DB calls, aggregations)
[module].controllers.ts — HTTP handlers, call services, use sendResponse()
[module].routes.ts      — Express router, applies verifyToken() where needed
```

### Key Shared Utilities

- [src/shared/sendResponse.ts](src/shared/sendResponse.ts) — Standard response shape: `{ statusCode, success, message, data, totalData? }`
- [src/errors/ApiError.ts](src/errors/ApiError.ts) — Custom error class with `statusCode`; thrown from services, caught by global handler
- [src/middlewares/global.error.handler.ts](src/middlewares/global.error.handler.ts) — Converts ApiError, Mongoose ValidationError, and CastError to standard responses
- [src/middlewares/verify.token.ts](src/middlewares/verify.token.ts) — `verifyToken(permission: string)` middleware; reads JWT from `fruit_snacks_token` cookie, checks admin status, then checks `role_data[permission]` boolean on the role document
- [src/helpers/image.upload.ts](src/helpers/image.upload.ts) — Multer config + DigitalOcean Spaces (S3) uploader

### Authentication & RBAC

- JWT stored in httpOnly cookie `fruit_snacks_token`; signed with `ACCESS_TOKEN` env var
- Each admin has a `role_id` referencing a role document with ~100 boolean permission flags (e.g., `category_post`, `product_update`, `order_delete`)
- Apply `verifyToken("module_action")` on protected routes; omit for public endpoints

### Database Conventions

- Soft deletes: use `status: "active" | "in-active"` fields; no hard deletes
- `.lean()` on read-only queries for performance
- `.select("-password")` (and similar) to exclude sensitive fields
- Slug history arrays on products for SEO redirect support
- Mongoose sessions used for multi-document transactions (e.g., product creation)

### External Integrations

- **Payments:** SSLCommerz, bKash — wired into order flow
- **Couriers:** Pathao (token cached with expiry), Steadfast — both have webhook endpoints for real-time status updates; internal statuses are mapped from courier-specific statuses
- **File storage:** DigitalOcean Spaces via AWS S3 SDK; local temp via `uploads/` directory
- **Cron:** `node-cron` runs nightly at 23:55 UTC to expire campaigns/offers past their end date

### 3-Level Category Hierarchy

Products reference `category_id → sub_category_id → child_category_id`. Always validate all three levels are `status: "active"` before returning product details (see `product.services.ts`).

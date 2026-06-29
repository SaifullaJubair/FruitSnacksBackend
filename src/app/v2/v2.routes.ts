import express from "express";
import { V2BrandRoutes } from "./brand/v2.brand.routes";
import { V2CategoryRoutes } from "./category/v2.category.routes";

// Aggregate router for the clean V2 REST layer, mounted at /api/v2 (alongside
// the untouched V1 /api/v1). Every V2 admin resource gets a clean contract:
// paginated /list with §9.1 meta, JSON/multipart create+update returning the
// row, :id-param mutations, error.code, /reorder before /:id. Category +
// future resources register here.
const v2Router = express.Router();

const v2Modules = [
  { path: "/brand", route: V2BrandRoutes },
  { path: "/category", route: V2CategoryRoutes },
];

v2Modules.forEach((m) => v2Router.use(m.path, m.route));

export default v2Router;

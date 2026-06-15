import {
  NextFunction,
  request,
  Request,
  RequestHandler,
  Response,
} from "express";
import { FileUploadHelper } from "../../helpers/image.upload";
import { stripDemoFlag } from "../../helpers/stripDemoFlag";
import sendResponse from "../../shared/sendResponse";
import ApiError from "../../errors/ApiError";
import ProductModel from "./product.model";
import { IProductInterface, productSearchableField } from "./product.interface";
import {
  deleteProductServices,
  findADashboardProductServices,
  findAllDashboardProductServices,
  findAllDashboardProductRichServices,
  countDashboardProductRichServices,
  patchProductQuickServices,
  patchProductImagesServices,
  findAProductDetailsServices,
  findBrandMatchProductServices,
  findCartProductServices,
  findCompareProductServices,
  findECommerceChoiceProductServices,
  findTopSellingProductServices,
  findNewArrivalProductServices,
  findMostViewedProductServices,
  findJustForYouProductServices,
  findPopularProductServices,
  findRelatedProductServices,
  findTrendingProductServices,
  postProductServices,
  updateProductServices,
  updateProductPageContentServices,
  findLowStockServices,
  cleanupOrphanedProductMedia,
  listFaqPlaceholderKeysService,
} from "./product.services";
import QRCode from "qrcode";
import VariationModel from "../variation/variation.model";
import { IVariationInterface } from "../variation/variation.interface";
import httpStatus from "http-status";
import mongoose, { Types } from "mongoose";
import fs from "fs";
import path from "path";
import {
  deleteAllFilesInDirectory,
  generateQRCode,
  generateUniqueSlug,
} from "./product.allId";
import SettingModel from "../setting/setting.model";
import {
  renderBarcodeImage,
  renderQrImage,
} from "../../helpers/code.images";
import {
  buildQrPayload,
  buildSku,
  buildVariationAxisCodes,
  buildVariationAxisCodesBatch,
  generateUniqueBarcode,
  generateUniqueBarcodesBatch,
  generateUniqueParentSku,
  generateUniqueShortCode,
  resolveVariationAxisValues,
} from "./product.codes";
import OrderProductModel from "../orderProducts/orderProduct.model";
import OfferModel from "../offer/offer.model";

/**
 * Parse a FormData-stringified value back into JS. Multer multipart wraps
 * arrays/objects as strings; admin sends them via JSON.stringify. Falls back
 * to the raw value if it's already an object/array (defensive — direct JSON
 * callers, future fetch() bodies, etc.).
 */
const parseJsonField = (raw: any, fallback: any = undefined): any => {
  if (raw === undefined || raw === null || raw === "") return fallback;
  if (typeof raw !== "string") return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
};

/**
 * Batch 2 C1 — multi-image per variation.
 *
 * Frontend sends two parallel arrays per row:
 *   - File uploads:  variation_details[i][variation_images][j]  (multer multipart)
 *   - Reused URLs:   variation_details[i][variation_images_urls][j]  (string body field)
 *
 * Server uploads the Files, then merges newly-uploaded URLs with the reused
 * URLs into ONE final array. First element = primary (used wherever the old
 * single `variation_image` field used to render). Also keeps the legacy single
 * field in sync (= first image) for cart/order/courier back-compat until they
 * migrate to read the array.
 */
const processVariationImages = async (
  product: any,
  index: number,
  files: Express.Multer.File[],
): Promise<void> => {
  // Multer keeps the full bracketed fieldname (with the trailing index) intact,
  // so the file.fieldname looks like `variation_details[0][variation_images][2]`.
  // startsWith catches the whole `[j]` slice regardless of how many files there
  // are. Anchor with the exact attribute prefix so we don't accidentally
  // include `variation_details[0][variation_image]` (legacy single field).
  const prefix = `variation_details[${index}][variation_images][`;
  const newImageFiles = files.filter((file) =>
    file.fieldname.startsWith(prefix),
  );
  // Path A Q5-3: parallel chunked upload inside the per-row image batch.
  // Without this, a row with 5 images × 100 rows = 500 sequential S3 calls
  // even after the outer Q5-1 fix.
  const uploads = await FileUploadHelper.uploadFilesInChunks(newImageFiles);
  const uploadedUrls: string[] = uploads.map((u) => u.Location);
  const uploadedKeys: string[] = uploads.map((u) => u.Key);

  // Reused-existing URLs come as form-field strings under [variation_images_urls].
  // Express multer body parsing surfaces array-style fields as either array or
  // a single string — defensive on both shapes.
  const reusedRaw = product.variation_images_urls;
  let reusedUrls: string[] = [];
  if (Array.isArray(reusedRaw)) {
    reusedUrls = reusedRaw.filter((u: unknown) => typeof u === "string" && u);
  } else if (typeof reusedRaw === "string" && reusedRaw) {
    reusedUrls = [reusedRaw];
  }

  const allUrls = [...uploadedUrls, ...reusedUrls];
  if (allUrls.length > 0) {
    product.variation_images = allUrls;
    product.variation_images_keys = uploadedKeys; // only new uploads have S3 keys
    // Legacy single field = first image (back-compat).
    product.variation_image = allUrls[0];
    product.variation_image_key = uploadedKeys[0] || product.variation_image_key;
  }
  // Drop the form-only helper field before passing to the model.
  delete product.variation_images_urls;
};

/**
 * Phase A MOD #3 — coerce empty-string variation_weight_grams to null before
 * insertMany. Empty string casts to NaN in Mongoose Number fields, which
 * throws on `insertMany({ ordered: true })` and rolls back the entire batch.
 * Most rows arrive with `""` because the admin matrix input is blank.
 * Frontend also coerces but this is the authoritative safety net.
 */
const sanitizeVariationWeights = (rows: any[]): void => {
  for (const r of rows || []) {
    if (
      r?.variation_weight_grams === "" ||
      r?.variation_weight_grams === undefined ||
      r?.variation_weight_grams === "null" ||
      r?.variation_weight_grams === "undefined"
    ) {
      r.variation_weight_grams = null;
    }
  }
};

/** Phase F+H field block — shared by postProduct + updateProduct. */
const buildPhaseFHFields = (r: any): Record<string, any> => {
  const out: Record<string, any> = {};

  if (r?.video_link !== undefined) out.video_link = r.video_link || "";
  if (r?.condition !== undefined && r.condition !== "") out.condition = r.condition;

  if (r?.product_weight_grams !== undefined && r.product_weight_grams !== "") {
    const n = parseFloat(r.product_weight_grams);
    if (Number.isFinite(n)) out.product_weight_grams = n;
  }

  if (r?.product_dimensions !== undefined && r.product_dimensions !== "") {
    const dims = parseJsonField(r.product_dimensions, null);
    if (dims && typeof dims === "object") {
      const sanitized: any = {};
      ["length", "width", "height"].forEach((k) => {
        const v = parseFloat(dims[k]);
        if (Number.isFinite(v)) sanitized[k] = v;
      });
      if (Object.keys(sanitized).length) out.product_dimensions = sanitized;
    }
  }

  if (r?.vat_percentage_override !== undefined && r.vat_percentage_override !== "") {
    const n = parseFloat(r.vat_percentage_override);
    if (Number.isFinite(n) && n >= 0) out.vat_percentage_override = n;
  }

  // Pass warehouse_id through even when empty string — admin clearing the
  // selection sends "". updateProductServices' OPTIONAL_FK_FIELDS loop then
  // converts empty to $unset. Old gate (`!== ""`) silently dropped the
  // clear intent so admin could never remove a warehouse assignment.
  if (r?.warehouse_id !== undefined) {
    out.warehouse_id = r.warehouse_id || "";
  }

  if (r?.tier_prices !== undefined && r.tier_prices !== "") {
    const arr = parseJsonField(r.tier_prices, []);
    if (Array.isArray(arr)) {
      out.tier_prices = arr
        .map((row: any) => ({
          min_qty: parseInt(row?.min_qty),
          price: parseFloat(row?.price),
        }))
        .filter(
          (row) =>
            Number.isFinite(row.min_qty) &&
            row.min_qty > 0 &&
            Number.isFinite(row.price) &&
            row.price >= 0,
        );
    }
  }

  if (r?.group_prices !== undefined && r.group_prices !== "") {
    const arr = parseJsonField(r.group_prices, []);
    if (Array.isArray(arr)) {
      out.group_prices = arr
        .map((row: any) => ({
          group: row?.group,
          price: parseFloat(row?.price),
        }))
        .filter(
          (row) =>
            (row.group === "wholesale" || row.group === "vip") &&
            Number.isFinite(row.price) &&
            row.price >= 0,
        );
    }
  }

  // ── Phase F (A2c): product_type + per-type fields + custom_fields ────
  const VALID_PRODUCT_TYPES = [
    "simple",
    "variable",
    "digital",
    "combo",
    "preorder",
    "subscription",
  ];
  if (r?.product_type !== undefined && r.product_type !== "") {
    if (VALID_PRODUCT_TYPES.includes(r.product_type)) {
      out.product_type = r.product_type;
    }
  }

  // combo type
  if (r?.bundle_items !== undefined && r.bundle_items !== "") {
    const arr = parseJsonField(r.bundle_items, []);
    if (Array.isArray(arr)) {
      out.bundle_items = arr
        .map((row: any) => ({
          product_id: row?.product_id,
          quantity: parseInt(row?.quantity),
        }))
        .filter(
          (row) =>
            row.product_id &&
            Number.isFinite(row.quantity) &&
            row.quantity > 0,
        );
    }
  }

  // digital type
  if (r?.download_url !== undefined) out.download_url = r.download_url || "";
  if (r?.license_key !== undefined) out.license_key = r.license_key || "";

  // preorder type
  if (r?.available_from !== undefined && r.available_from !== "") {
    const d = new Date(r.available_from);
    if (!Number.isNaN(d.getTime())) out.available_from = d;
  }

  // subscription type
  if (
    r?.billing_interval !== undefined &&
    (r.billing_interval === "monthly" || r.billing_interval === "yearly")
  ) {
    out.billing_interval = r.billing_interval;
  }

  // Free-form spec rows (label + value + icon_key).
  if (r?.custom_fields !== undefined && r.custom_fields !== "") {
    const arr = parseJsonField(r.custom_fields, []);
    if (Array.isArray(arr)) {
      out.custom_fields = arr
        .map((row: any) => ({
          label: String(row?.label ?? "").trim(),
          value: String(row?.value ?? "").trim(),
          icon_key: row?.icon_key ? String(row.icon_key) : undefined,
        }))
        .filter((row) => row.label && row.value);
    }
  }

  return out;
};
import CategoryModel from "../category/category.model";
import BrandModel from "../brand/brand.model";
import AttributeModel from "../attribute/attribute.model";

// Path to the upload folder
const uploadDir = path.join(__dirname, "../../../uploads");

// Build a product's category_path = full ancestor chain root → … → leaf
// (inclusive of the chosen leaf), so a subtree query `{ category_path: X }`
// matches every product at or below node X. Returns [] if no/invalid category.
const resolveProductCategoryPath = async (
  category_id: any,
): Promise<Types.ObjectId[]> => {
  if (!category_id) return [];
  const category: any = await CategoryModel.findById(category_id)
    .select("_id category_path")
    .lean();
  if (!category) return [];
  return [...(category.category_path ?? []), category._id];
};

// find Trending product
export const findTrendingProduct: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const pageNumber = Number(page);
    const limitNumber = Number(limit);
    const skip = (pageNumber - 1) * limitNumber;
    const findTrendingProduct: IProductInterface[] | [] | any =
      await findTrendingProductServices(limitNumber, skip);
    return sendResponse<IProductInterface>(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Trending Product Found Successfully !",
      data: findTrendingProduct,
    });
  } catch (error) {
    next(error);
  }
};

// find BrandMatchProduct
export const findBrandMatchProduct: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { page = 1, limit = 20, brand_id } = req.query;
    const pageNumber = Number(page);
    const limitNumber = Number(limit);
    const skip = (pageNumber - 1) * limitNumber;
    const findTrendingProduct: IProductInterface[] | [] | any =
      await findBrandMatchProductServices(limitNumber, skip, brand_id);
    return sendResponse<IProductInterface>(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Brand Product Found Successfully !",
      data: findTrendingProduct,
      totalData: findTrendingProduct?.totalData,
    });
  } catch (error) {
    next(error);
  }
};

// find Popular product
export const findPopularProduct: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    // const category_id: any = req.query.category_id;
    const { page = 1, limit = 20, category_id } = req.query;
    const pageNumber = Number(page);
    const limitNumber = Number(limit);
    const skip = (pageNumber - 1) * limitNumber;
    const findPopularProduct: IProductInterface[] | [] | any =
      await findPopularProductServices(limitNumber, skip, category_id);
    return sendResponse<IProductInterface>(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Popular Product Found Successfully !",
      data: findPopularProduct?.findPopularProduct,
      totalData: findPopularProduct?.totalCount,
    });
  } catch (error) {
    next(error);
  }
};

// find EcommerceChoice product
export const findECommerceChoiceProduct: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { page = 1, limit = 12 } = req.query;
    const pageNumber = Number(page);
    const limitNumber = Number(limit);
    const skip = (pageNumber - 1) * limitNumber;
    const findECommerceChoiceProduct: IProductInterface[] | [] | any =
      await findECommerceChoiceProductServices(limitNumber, skip);
    return sendResponse<IProductInterface>(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Ecommerce Choice Product Found Successfully !",
      data: findECommerceChoiceProduct,
    });
  } catch (error) {
    next(error);
  }
};

// top selling — সবচেয়ে বেশি বিক্রি (sort by sold_count desc)
export const findTopSellingProduct: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { page = 1, limit = 20, category_id } = req.query;
    const pageNumber = Number(page);
    const limitNumber = Number(limit);
    const skip = (pageNumber - 1) * limitNumber;
    const result = await findTopSellingProductServices(limitNumber, skip, category_id);
    return sendResponse<IProductInterface>(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Top Selling Products Found Successfully!",
      data: result.data,
      totalData: result.totalCount,
    });
  } catch (error) {
    next(error);
  }
};

// new arrival — নতুন পণ্য (sort by createdAt desc)
export const findNewArrivalProduct: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const pageNumber = Number(page);
    const limitNumber = Number(limit);
    const skip = (pageNumber - 1) * limitNumber;
    const result = await findNewArrivalProductServices(limitNumber, skip);
    return sendResponse<IProductInterface>(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "New Arrival Products Found Successfully!",
      data: result.data,
      totalData: result.totalCount,
    });
  } catch (error) {
    next(error);
  }
};

// most viewed — সর্বাধিক দেখা (sort by view_count desc)
export const findMostViewedProduct: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const pageNumber = Number(page);
    const limitNumber = Number(limit);
    const skip = (pageNumber - 1) * limitNumber;
    const result = await findMostViewedProductServices(limitNumber, skip);
    return sendResponse<IProductInterface>(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Most Viewed Products Found Successfully!",
      data: result.data,
      totalData: result.totalCount,
    });
  } catch (error) {
    next(error);
  }
};

// find findJustForYouProductServices product
export const findJustForYouProduct: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const findJustForYouProduct: IProductInterface[] | [] | any =
      await findJustForYouProductServices();
    return sendResponse<IProductInterface>(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Just For You Product Found Successfully !",
      data: findJustForYouProduct,
    });
  } catch (error) {
    next(error);
  }
};

// Check product barcode
export const checkProductBarcode: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const requestData = req.body;
    if (!requestData?.showProductVariation) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Variation status is required.",
      );
    }

    if (
      requestData.showProductVariation == true &&
      requestData.variation_details
    ) {
      // const variationDetails = JSON.parse(requestData.variation_details);
      for (const variation of requestData.variation_details) {
        const { variation_barcode } = variation;

        const varCodeCheck = await VariationModel.findOne({
          variation_barcode: variation_barcode,
        });

        if (varCodeCheck) {
          throw new ApiError(
            httpStatus.BAD_REQUEST,
            `Barcode "${variation_barcode}" already exists`,
          );
        }
      }
    }
    return sendResponse(res, {
      statusCode: 200,
      success: true,
      message: "Varcode checked successfully!",
    });
  } catch (error) {
    next(error);
  }
};

// Check product barcode when update
export const checkProductBarcodeWhenUpdate: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const requestData = req.body;
    if (!requestData?.showProductVariation) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Variation status is required.",
      );
    }

    if (requestData.is_variation == true && requestData.variation_details) {
      // const variationDetails = JSON.parse(requestData.variation_details);
      for (const variation of requestData.variation_details) {
        const { variation_barcode } = variation;

        if (
          variation_barcode != null &&
          variation_barcode != "" &&
          variation_barcode != undefined &&
          variation_barcode != "null" &&
          variation_barcode != "undefined"
        ) {
          const varCodeCheck = await VariationModel.findOne({
            variation_barcode: variation_barcode,
          });

          if (varCodeCheck && variation?._id !== varCodeCheck?._id.toString()) {
            deleteAllFilesInDirectory(uploadDir);
            throw new ApiError(
              httpStatus.BAD_REQUEST,
              `Barcode "${variation_barcode}" already exists`,
            );
          }
        }
      }
    }
    return sendResponse(res, {
      statusCode: 200,
      success: true,
      message: "Varcode checked successfully!",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Post-save QR generation — payload is the permanent `/q/<short_code>` short
 * URL so phone cameras open the PDP directly, AND printed QR labels survive
 * product rename + domain change. Best-effort: if S3 upload fails the product
 * is still saved; admin can hit `/product/qr` to regen later.
 */
const persistQrForProduct = async (
  productId: any,
  shortCode: string,
  slugForImageName: string,
  session?: any,
) => {
  if (!productId || !shortCode) return;
  try {
    const payload = await buildQrPayload(shortCode);
    const qr = await renderQrImage(payload, slugForImageName || shortCode);
    await ProductModel.updateOne(
      { _id: productId },
      {
        $set: {
          qr_code: payload,
          qr_code_image: qr.Location,
          qr_code_image_key: qr.Key,
          qr_code_updated_at: new Date(),
        },
      },
      session ? { session } : undefined,
    );
  } catch (e) {
    console.warn("[product] QR generation failed", e);
  }
};

// Post multiple images with product data
export const postProduct: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    if (req.files || req.body) {
      const requestData = stripDemoFlag(req.body);
      // if (requestData?.showProductVariation == "false") {
      //   if (requestData?.barcode) {
      //     const varCodeCheck = await ProductModel.findOne({
      //       barcode: requestData?.barcode,
      //     }).session(session);
      //     if (varCodeCheck) {
      //       deleteAllFilesInDirectory(uploadDir);
      //       throw new ApiError(
      //         httpStatus.BAD_REQUEST,
      //         "Barcode already exists"
      //       );
      //     }
      //   }
      // }

      // if (
      //   requestData?.showProductVariation == "true" &&
      //   requestData?.variation_details
      // ) {
      //   // const variationDetails = JSON.parse(requestData?.variation_details);
      //   for (const variation of requestData?.variation_details) {
      //     const { variation_barcode } = variation;

      //     const varCodeCheck = await VariationModel.findOne({
      //       variation_barcode: variation_barcode,
      //     }).session(session);

      //     if (varCodeCheck) {
      //       deleteAllFilesInDirectory(uploadDir);
      //       throw new ApiError(
      //         httpStatus.BAD_REQUEST,
      //         `Barcode "${variation_barcode}" already exists`
      //       );
      //     }
      //   }
      // }

      const files = req.files as Express.Multer.File[];

      // Array to store main_image data
      let main_image;
      let main_image_key;
      let size_chart;
      let size_chart_key;
      let main_video;
      let main_video_key;

      // Handle main image
      const mainImage = files.find((file) => file.fieldname === "main_image");
      if (mainImage) {
        const main_image_upload =
          await FileUploadHelper.uploadToSpaces(mainImage);
        main_image = main_image_upload?.Location;
        main_image_key = main_image_upload?.Key;
      }
      // Handle size_chart
      const sizeChartImage = files.find(
        (file) => file.fieldname === "size_chart",
      );
      if (sizeChartImage) {
        const size_chart_upload =
          await FileUploadHelper.uploadToSpaces(sizeChartImage);
        size_chart = size_chart_upload?.Location;
        size_chart_key = size_chart_upload?.Key;
      }

      // Handle main video
      const mainVideo = files.find((file) => file.fieldname === "main_video");
      if (mainVideo) {
        const main_video_upload =
          await FileUploadHelper.VideoUploader(mainVideo);
        main_video = main_video_upload?.Location;
        main_video_key = main_video_upload?.Key;
      }

      // Handle other_images — Path A Q5-2: parallel chunked upload instead
      // of the old per-file sequential loop (was the slowest part of a save
      // with many product photos).
      const otherImageFiles = files.filter((file) =>
        file.fieldname.startsWith("other_images"),
      );
      const otherImageUploads = await FileUploadHelper.uploadFilesInChunks(
        otherImageFiles,
      );
      const other_images = otherImageUploads.map((u) => ({
        other_image: u.Location,
        other_image_key: u.Key,
      }));

      // Generate a unique slug for the product
      const product_slug = await generateUniqueSlug(requestData?.product_name);
      requestData.product_slug = product_slug;
      requestData.is_variation = requestData?.showProductVariation;

      // ── SKU / Barcode generation (Phase 1, redesigned) ─────────────────
      // Owner decision 2026-05-30: SKU/Barcode are STRICTLY backend-controlled.
      // Admin form does not have these fields any more. Any value arriving in
      // `requestData.product_sku` or `requestData.barcode` is IGNORED (would
      // come from a stale admin client only). Backend always auto-generates.
      const skuSettings: any = await SettingModel.findOne()
        .select("sku_prefix barcode_auto_generate barcode_default_format")
        .lean();
      const skuPrefix = skuSettings?.sku_prefix || "FS";
      const autoGenBarcode = skuSettings?.barcode_auto_generate !== false;
      const defaultBarcodeFormat =
        skuSettings?.barcode_default_format || "CODE128";

      // PARENT SKU — name-independent hash format `FS-HASH`
      const { sku, hash } = await generateUniqueParentSku(skuPrefix);
      requestData.product_sku = sku;
      const parentSkuHash = hash;

      // Short code for /q/<code> permanent URL
      const shortCode = await generateUniqueShortCode();
      requestData.qr_short_code = shortCode;

      // PARENT BARCODE (only when no variations; variation rows carry their
      // own barcodes — scanning a 250g box should not scan as the 500g box).
      //
      // Phase 0.5+ Option 1 (2026-05-31): barcode IMAGE generation deferred
      // to first print via POST /product/ensure-barcode-image. Saving only
      // the barcode NUMBER here keeps the transaction window safe — bwip-js
      // render + S3 upload were the 1-2 second per-row killer that was
      // aborting 256-variation saves. PrintLabel modal calls the ensure
      // endpoint lazily; once cached on the doc, subsequent prints are fast.
      const isVariableProduct = requestData?.showProductVariation == "true";
      const barcodeFormat = defaultBarcodeFormat;
      if (!isVariableProduct && autoGenBarcode) {
        requestData.barcode = await generateUniqueBarcode("product");
      }
      // Resolve the nested-tree category_path for the chosen leaf category:
      // full chain root → … → leaf (inclusive), so subtree filtering by any
      // ancestor id matches this product. See category_path convention in 0.2.
      const category_path = await resolveProductCategoryPath(
        requestData?.category_id,
      );

      // Phase D Bug #6 — backend safety net. The admin UI disables Publish
      // when category/brand is inactive, but a stale client / direct API call
      // could still ship `product_status=active` referencing an inactive ref.
      // Force draft in that case instead of rejecting (preserves work).
      let resolvedProductStatus = requestData?.product_status as
        | "active"
        | "in-active";
      if (resolvedProductStatus === "active") {
        // Collect picked attribute ids from product_attributes (the structured
        // payload; never trust attributes_details alone since older clients
        // may not send attribute_id there).
        const pickedAttrIds: any[] = (() => {
          const raw = Array.isArray(requestData?.product_attributes)
            ? requestData.product_attributes
            : Object.values(requestData?.product_attributes ?? {});
          return raw
            .map((pa: any) => pa?.attribute_id)
            .filter(Boolean);
        })();

        const [catCheck, brandCheck, attrInactiveCount] = await Promise.all([
          requestData?.category_id
            ? CategoryModel.findById(requestData.category_id)
                .select("category_status")
                .lean()
            : Promise.resolve(null),
          requestData?.brand_id
            ? BrandModel.findById(requestData.brand_id)
                .select("brand_status")
                .lean()
            : Promise.resolve(null),
          pickedAttrIds.length > 0
            ? AttributeModel.countDocuments({
                _id: { $in: pickedAttrIds },
                attribute_status: "in-active",
              })
            : Promise.resolve(0),
        ]);
        if (
          (catCheck && (catCheck as any).category_status !== "active") ||
          (brandCheck && (brandCheck as any).brand_status !== "active") ||
          (attrInactiveCount as number) > 0
        ) {
          resolvedProductStatus = "in-active";
        }
      }

      // Create product object
      const productData: any = {
        product_name: requestData?.product_name,
        product_slug: requestData?.product_slug,
        product_sku: requestData?.product_sku,
        product_sku_hash: parentSkuHash || undefined,
        qr_short_code: requestData?.qr_short_code,
        product_status: resolvedProductStatus,
        category_id: requestData?.category_id,
        category_path,
        brand_id: requestData?.brand_id ? requestData?.brand_id : undefined,
        // Phase-1 structured attribute payload (single source of truth for
        // PDP spec table + filter facets). Admin StepOneVariation emits these.
        product_attributes: Array.isArray(requestData?.product_attributes)
          ? requestData.product_attributes
          : Object.values(requestData?.product_attributes ?? {}),
        variant_axes: Array.isArray(requestData?.variant_axes)
          ? requestData.variant_axes
          : Object.values(requestData?.variant_axes ?? {}),
        attributes_details: Object.values(requestData?.attributes_details ?? {})
          .filter(
            (att: any) =>
              att?.attribute_name !== undefined &&
              att?.attribute_values?.length > 0,
          )
          .map((att: any) => ({
            // Phase 0 fix — copy the source attribute._id snapshot. The PDP
            // picker uses this to reconcile attributes_details rows with
            // variant_axes[].attribute_id. Skipping the field leaves the row
            // unmatched and the picker silently renders nothing.
            attribute_id: att?.attribute_id || undefined,
            attribute_name: att?.attribute_name,
            attribute_values:
              att?.attribute_values?.map(
                (value: {
                  attribute_value_name: any;
                  attribute_value_code: any;
                }) => ({
                  attribute_value_name:
                    value?.attribute_value_name ?? undefined,
                  attribute_value_code:
                    value?.attribute_value_code ?? undefined,
                }),
              ) ?? [],
          })),
        barcode: requestData?.barcode || undefined,
        // barcode_image + key omitted on create — lazily generated on first
        // print (Phase 0.5+ Option 1). See POST /product/ensure-barcode-image.
        barcode_image: undefined,
        barcode_image_key: undefined,
        barcode_format: barcodeFormat,
        description: requestData?.description ?? "",
        main_image: main_image as string,
        main_image_key: main_image_key,
        size_chart: size_chart as string,
        size_chart_key: size_chart_key,
        main_video: main_video as string,
        main_video_key: main_video_key,
        other_images: other_images ?? [],
        product_price:
          requestData?.product_price && parseFloat(requestData?.product_price),
        product_buying_price:
          requestData?.product_buying_price &&
          parseFloat(requestData?.product_buying_price),
        product_discount_price:
          requestData?.product_discount_price &&
          parseFloat(requestData?.product_discount_price),
        product_quantity:
          requestData?.product_quantity &&
          parseInt(requestData?.product_quantity),
        product_alert_quantity:
          requestData?.product_alert_quantity &&
          parseInt(requestData?.product_alert_quantity),
        is_variation: requestData?.is_variation === "true",
        trending_product:
          requestData?.trending_product === "true" ||
          requestData?.trending_product === true,
        product_warrenty: requestData?.product_warrenty ?? "",
        product_return: requestData?.product_return ?? "",
        unit: requestData?.unit ?? "",
        meta_title: requestData?.meta_title ?? "",
        meta_description: requestData?.meta_description ?? "",
        meta_keywords:
          typeof requestData?.meta_keywords === "string"
            ? JSON.parse(requestData?.meta_keywords)
            : requestData?.meta_keywords || [],
        product_publisher_id: requestData?.product_publisher_id,
        // product_supplier_id: requestData?.product_supplier_id || null,
        // Phase F+H — additive fields wired from admin StepOne / ProductUpdate.
        ...buildPhaseFHFields(requestData),
      };

      if (!productData?.main_image) {
        delete productData?.main_image;
        delete productData?.main_image_key;
      }

      if (!productData?.main_video) {
        delete productData?.main_video;
        delete productData?.main_video_key;
      }
      if (!productData?.size_chart) {
        delete productData?.size_chart;
        delete productData?.size_chart_key;
      }

      // Save product in the database
      const newProduct: any = await postProductServices(productData, session);

      if (requestData?.showProductVariation == "true") {
        const variation_details = req?.body?.variation_details;
        const _vdArr = Array.isArray(variation_details)
          ? variation_details
          : Object.values(variation_details ?? {});
        // Path A C-1 (2026-06-01): cap restored to 500 now that Q4 batch
        // barcode/SKU + Q5 parallel S3 uploads + insertMany eliminate the
        // per-row Mongo round-trips that timed out the transaction. 500 rows
        // with no images now save in ~10-15s vs 6+ min on the old path.
        if (_vdArr.length > 500) {
          throw new ApiError(
            400,
            `Too many variations (${_vdArr.length}). Maximum allowed is 500 per product. Use fewer attribute values or split into separate products.`,
          );
        }

        const variationCount = variation_details.length;
        const savedVariantAxes = newProduct?.variant_axes || [];

        // Path A Q4-1/Q4-2 — pre-generate ALL barcode numbers in one bulk
        // DB query (vs per-row findOne × N). Session-bound so concurrent
        // saves can't race in a duplicate between our check and insertMany.
        const variationBarcodes = autoGenBarcode
          ? await generateUniqueBarcodesBatch(variationCount, "variation", session)
          : [];

        // Path A Q4-3/Q4-4 — pre-build ALL axis-code arrays in one bulk
        // attribute fetch + one bulk sibling fetch (vs per-row × 2 calls).
        const axisCodesPerRow = await buildVariationAxisCodesBatch(
          variation_details,
          savedVariantAxes,
          newProduct?._id?.toString(),
          session,
        );

        const updatedVariation_details: any = [];
        for (let index = 0; index < variationCount; index++) {
          let product = variation_details[index];
          product.product_id = newProduct?._id?.toString();
          const matchingFiles = files.filter(
            (file) =>
              file.fieldname === `variation_details[${index}][variation_image]`,
          );
          const matchingVideos = files.filter(
            (file) =>
              file.fieldname === `variation_details[${index}][variation_video]`,
          );

          // SKU is built from the pre-resolved axis codes — no DB call here.
          product.variation_sku = buildSku({
            prefix: skuPrefix,
            hash: parentSkuHash,
            axisCodes: axisCodesPerRow[index] || [],
          });

          // Barcode + format from the pre-generated batch. Image stays lazy
          // (Phase 0.5+ Option 1 — generated on first print).
          if (autoGenBarcode) {
            product.variation_barcode = variationBarcodes[index];
            product.variation_barcode_format = barcodeFormat;
          }

          // Legacy single-image field (kept for back-compat with cart/order
          // until consumers migrate to variation_images[]). Parallel chunk
          // doesn't help here because it's at most 1 file — keep as-is.
          for (const file of matchingFiles) {
            const imageUpload = await FileUploadHelper.uploadToSpaces(file);
            product.variation_image = imageUpload.Location;
            product.variation_image_key = imageUpload.Key;
          }
          for (const file of matchingVideos) {
            const videoUpload = await FileUploadHelper.VideoUploader(file);
            product.variation_video = videoUpload.Location;
            product.variation_video_key = videoUpload.Key;
          }
          // Multi-image processing (variation_images[] + reused URLs). Now
          // internally parallel-chunked (Q5-3).
          await processVariationImages(product, index, files);

          updatedVariation_details.push(product);
        }

        // Path A Q4-5 — insertMany with ordered:true (vs old per-row create
        // loop). ordered:true means the first duplicate-key error aborts
        // the batch + throws, which fails the parent transaction cleanly.
        // Defense-in-depth count assertion catches silent partial inserts
        // even if a future Mongoose version changes default behavior.
        // Phase A MOD #3 — empty-string weights to null, else NaN throws.
        sanitizeVariationWeights(updatedVariation_details);
        const insertResult: any = await VariationModel.insertMany(
          updatedVariation_details,
          { session, ordered: true },
        );
        if (!insertResult || insertResult.length !== variationCount) {
          throw new ApiError(
            500,
            `Variation insertMany count mismatch: expected ${variationCount}, got ${insertResult?.length || 0}`,
          );
        }
        const successVariationUpload = insertResult;

        if (successVariationUpload.length > 0) {
          await persistQrForProduct(newProduct?._id, newProduct?.qr_short_code, newProduct?.product_slug, session);
          await session.commitTransaction();
          session.endSession();
          // Fix #20 — return key identifiers so the admin form doesn't have
          // to re-fetch the product just to know the slug / _id (used for
          // post-save CTA, redirect, page-content link).
          return sendResponse(res, {
            statusCode: 200,
            success: true,
            message: "Product created successfully!",
            data: {
              _id: newProduct?._id,
              product_slug: newProduct?.product_slug,
              product_sku: newProduct?.product_sku,
              qr_short_code: newProduct?.qr_short_code,
            } as any,
          });
        }
      }

      await persistQrForProduct(newProduct?._id, newProduct?.qr_short_code, newProduct?.product_slug, session);
      // Commit transaction
      await session.commitTransaction();
      session.endSession();
      return sendResponse(res, {
        statusCode: 200,
        success: true,
        message: "Product created successfully!",
        data: {
          _id: newProduct?._id,
          product_slug: newProduct?.product_slug,
          product_sku: newProduct?.product_sku,
          qr_short_code: newProduct?.qr_short_code,
        } as any,
      });
    } else {
      throw new ApiError(400, "Image Upload Failed");
    }
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    next(error);
  }
};

// Partial update for the themed Page Content form. Accepts a plain JSON body
// with only page-content fields (+ _id) and updates just those — never touches
// price/stock/category/name. Separate from updateProduct, which is the
// multipart full-edit handler that rebuilds the whole document.
export const patchProductPageContent: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { _id, ...rest } = req.body || {};
    if (!_id) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Product _id is required");
    }
    const adminId = (req as any)?.user?._id;
    const result = await updateProductPageContentServices(_id, {
      ...rest,
      product_updated_by: adminId,
    });
    if (!result || (result as any).matchedCount === 0) {
      throw new ApiError(httpStatus.NOT_FOUND, "Product not found");
    }
    return sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Page content updated",
    });
  } catch (error) {
    next(error);
  }
};

// update product data
export const updateProduct: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    if (req.files || req.body) {
      const requestData = stripDemoFlag(req.body);
      let barcode: any;
      // if (requestData.is_variation == "false") {
      //   if (requestData.barcode) {
      //     const varCodeCheck = await ProductModel.findOne({
      //       barcode: requestData.barcode,
      //     });
      //     if (
      //       varCodeCheck &&
      //       varCodeCheck?._id.toString() !== requestData?._id
      //     ) {
      //       deleteAllFilesInDirectory(uploadDir);
      //       throw new ApiError(
      //         httpStatus.BAD_REQUEST,
      //         "Barcode already exists"
      //       );
      //     }
      //   }
      // }

      // if (requestData.is_variation == "true" && requestData.variation_details) {
      //   // const variationDetails = JSON.parse(requestData.variation_details);
      //   for (const variation of requestData.variation_details) {
      //     const { variation_barcode } = variation;

      //     if (
      //       variation_barcode != null &&
      //       variation_barcode != "" &&
      //       variation_barcode != undefined &&
      //       variation_barcode != "null" &&
      //       variation_barcode != "undefined"
      //     ) {
      //       const varCodeCheck = await VariationModel.findOne({
      //         variation_barcode: variation_barcode,
      //       });

      //       if (
      //         varCodeCheck &&
      //         variation?._id !== varCodeCheck?._id.toString()
      //       ) {
      //         deleteAllFilesInDirectory(uploadDir);
      //         throw new ApiError(
      //           httpStatus.BAD_REQUEST,
      //           `Barcode "${variation_barcode}" already exists`
      //         );
      //       }
      //     }
      //   }
      // }

      // Multer only populates req.files for multipart/form-data requests. A
      // plain application/json PATCH (e.g. the admin Page Content form, which
      // sends no files) leaves req.files undefined — default to [] so the
      // .find()/.filter() calls below don't throw.
      const files = (req?.files as Express.Multer.File[]) || [];

      // Array to store main_image data
      let main_image;
      let main_image_key;
      let size_chart;
      let size_chart_key;
      let main_video;
      let main_video_key;

      // Handle main image
      const mainImage = files?.find((file) => file?.fieldname === "main_image");
      if (mainImage) {
        const main_image_upload =
          await FileUploadHelper.uploadToSpaces(mainImage);
        main_image = main_image_upload?.Location;
        main_image_key = main_image_upload?.Key;
      } else {
        main_image = requestData?.main_image;
        main_image_key = requestData?.main_image_key;
      }
      // Handle size_chart
      const sizeChartImage = files?.find(
        (file) => file?.fieldname === "size_chart",
      );
      if (sizeChartImage) {
        const size_chart_upload =
          await FileUploadHelper.uploadToSpaces(sizeChartImage);
        size_chart = size_chart_upload?.Location;
        size_chart_key = size_chart_upload?.Key;
      } else {
        size_chart = requestData?.size_chart;
        size_chart_key = requestData?.size_chart_key;
      }

      // Handle main video
      const mainVideo = files?.find((file) => file?.fieldname === "main_video");
      if (mainVideo) {
        const main_video_upload =
          await FileUploadHelper.VideoUploader(mainVideo);
        main_video = main_video_upload?.Location;
        main_video_key = main_video_upload?.Key;
      } else {
        main_video = requestData?.main_video;
        main_video_key = requestData?.main_video_key;
      }

      // Array to store other_images URLs and keys
      const other_images = [];

      // Handle other_images
      const otherImageFiles = files.filter((file) =>
        file.fieldname.startsWith("other_images"),
      );
      for (const file of otherImageFiles) {
        const imageUpload = await FileUploadHelper.uploadToSpaces(file);
        other_images.push({
          other_image: imageUpload.Location,
          other_image_key: imageUpload.Key,
        });
      }

      if (requestData?.other_default_images) {
        // Assuming requestData?.other_default_images is defined as shown
        const otherImages = requestData?.other_default_images;

        // Combine `other_image` and `other_image_key` into objects, filtering out `undefined` values
        const formattedImages = otherImages?.other_image
          ?.map((image: any, index: any) => {
            const key = otherImages.other_image_key[index];
            // Skip if either `image` or `key` is `undefined`
            if (image === "undefined" || key === "undefined") return null;

            return { other_image: image, other_image_key: key };
          })
          .filter(Boolean); // Remove any null values from the array
        other_images.push(...formattedImages);
      }

      // Generate a unique slug for the product
      // const product_slug = await generateUniqueSlug(requestData.product_name);
      // requestData.product_slug = product_slug;
      // product name বদলেছে কিনা check করো
      const existingProduct: any = await ProductModel.findById(requestData._id);
      if (!existingProduct) {
        throw new ApiError(httpStatus.NOT_FOUND, "Product not found");
      }
      // Snapshot existing variations BEFORE any saves so the orphan-cleanup
      // pass (run after all writes succeed) can diff old keys vs new keys
      // and delete only what's no longer referenced anywhere on the product.
      const existingVariations: any[] = await VariationModel.find({
        product_id: requestData._id,
      }).lean();

      let updatedSlug = existingProduct.product_slug; // default পুরনো slug

      if (existingProduct.product_name !== requestData.product_name) {
        // name বদলেছে — নতুন slug বানাও। excludeId পাঠাই যাতে নিজের পুরনো slug
        // (যা history-তে move করবে) clash হিসেবে count না হয়।
        updatedSlug = await generateUniqueSlug(
          requestData.product_name,
          requestData._id,
        );
      }

      requestData.is_variation = requestData?.is_variation;

      // ── SKU / Barcode strict immutability (owner decision 2026-05-30) ──
      // SKU + barcode are ALWAYS preserved from the existing doc on update.
      // Admin form does not expose these fields. Any value arriving in the
      // request body is from a stale client (or someone bypassing the UI) and
      // is silently ignored. This is non-negotiable for warehouse label
      // integrity, order snapshot consistency, and printed-label validity.
      requestData.product_sku = existingProduct.product_sku;
      requestData.barcode = existingProduct.barcode;
      requestData.barcode_format = existingProduct.barcode_format;
      requestData.barcode_image = existingProduct.barcode_image;
      requestData.barcode_image_key = existingProduct.barcode_image_key;

      // Recompute category_path on update (PATCH /product is a full rebuild —
      // see [[product-update-route-is-full-rebuild]]), so the chosen leaf's
      // ancestor chain is re-derived each save.
      const category_path = await resolveProductCategoryPath(
        requestData.category_id,
      );

      // Phase D Bug #6 — same backend safety net as postProduct. Block any
      // attempt to flip status to "active" while the chosen cat/brand is
      // inactive; force draft so the work is preserved. Activating one ref
      // back to active then re-saving will allow Publish.
      let resolvedProductStatus = requestData.product_status as
        | "active"
        | "in-active";
      if (resolvedProductStatus === "active") {
        const [catCheck, brandCheck] = await Promise.all([
          requestData.category_id
            ? CategoryModel.findById(requestData.category_id)
                .select("category_status")
                .lean()
            : Promise.resolve(null),
          requestData.brand_id
            ? BrandModel.findById(requestData.brand_id)
                .select("brand_status")
                .lean()
            : Promise.resolve(null),
        ]);
        if (
          (catCheck && (catCheck as any).category_status !== "active") ||
          (brandCheck && (brandCheck as any).brand_status !== "active")
        ) {
          resolvedProductStatus = "in-active";
        }
      }

      // Create product object. Note: product_sku / barcode / qr_short_code are
      // re-set lower in the object literal from `existingProduct.*` (strict
      // immutability — see "SKU / Barcode strict immutability" above).
      const productData: any = {
        product_name: requestData.product_name,
        product_slug: updatedSlug,
        product_status: resolvedProductStatus,
        category_id: requestData.category_id,
        category_path,
        brand_id: requestData.brand_id ? requestData.brand_id : undefined,
        // Phase-1 structured attribute payload (additive — spec table + filter
        // facets read from product_attributes; variant_axes drives the
        // variation matrix). PATCH is a full rebuild so always rewrite both.
        product_attributes: Array.isArray(requestData.product_attributes)
          ? requestData.product_attributes
          : Object.values(requestData.product_attributes ?? {}),
        variant_axes: Array.isArray(requestData.variant_axes)
          ? requestData.variant_axes
          : Object.values(requestData.variant_axes ?? {}),
        // Phase 0 — also rewrite the legacy display snapshot on PATCH so the
        // PDP spec table stays in lockstep with product_attributes, and so
        // attribute_id (Phase 0 fix) backfills for products edited after the
        // schema change without needing the migration script to run twice.
        attributes_details: Object.values(requestData?.attributes_details ?? {})
          .filter(
            (att: any) =>
              att?.attribute_name !== undefined &&
              att?.attribute_values?.length > 0,
          )
          .map((att: any) => ({
            attribute_id: att?.attribute_id || undefined,
            attribute_name: att?.attribute_name,
            attribute_values:
              att?.attribute_values?.map(
                (value: {
                  attribute_value_name: any;
                  attribute_value_code: any;
                }) => ({
                  attribute_value_name:
                    value?.attribute_value_name ?? undefined,
                  attribute_value_code:
                    value?.attribute_value_code ?? undefined,
                }),
              ) ?? [],
          })),
        description: requestData.description ?? "",
        trending_product:
          requestData?.trending_product === "true" ||
          requestData?.trending_product === true,
        main_image: main_image as string,
        main_image_key: main_image_key,
        size_chart: size_chart as string,
        size_chart_key: size_chart_key,
        main_video: main_video as string,
        main_video_key: main_video_key,
        other_images: other_images ?? [],
        product_price:
          requestData.product_price && parseFloat(requestData.product_price),
        product_buying_price:
          requestData.product_buying_price &&
          parseFloat(requestData.product_buying_price),
        product_discount_price:
          requestData.product_discount_price &&
          parseFloat(requestData.product_discount_price),
        product_quantity:
          requestData.product_quantity &&
          parseInt(requestData.product_quantity),
        product_alert_quantity:
          requestData.product_alert_quantity &&
          parseInt(requestData.product_alert_quantity),
        is_variation: requestData.is_variation === "true",
        product_warrenty: requestData.product_warrenty ?? "",
        product_return: requestData.product_return ?? "",
        unit: requestData.unit ?? "",
        meta_title: requestData.meta_title ?? "",
        meta_description: requestData.meta_description ?? "",
        meta_keywords:
          typeof requestData.meta_keywords === "string"
            ? JSON.parse(requestData.meta_keywords)
            : requestData.meta_keywords || [],
        product_updated_by: requestData.product_updated_by,
        product_supplier_id: requestData.product_supplier_id,
        _id: requestData?._id,
        // Strict immutable: always carry forward existing values.
        product_sku: existingProduct.product_sku,
        product_sku_hash: existingProduct.product_sku_hash,
        qr_short_code: existingProduct.qr_short_code,
        barcode: existingProduct.barcode,
        barcode_format: existingProduct.barcode_format,
        barcode_image: existingProduct.barcode_image,
        barcode_image_key: existingProduct.barcode_image_key,
        // Phase F+H — additive fields wired from admin StepOne / ProductUpdate.
        ...buildPhaseFHFields(requestData),
      };

      if (!productData?.main_image) {
        delete productData.main_image;
        delete productData.main_image_key;
      }
      if (!productData?.size_chart) {
        delete productData.size_chart;
        delete productData.size_chart_key;
      }

      if (!productData?.main_video) {
        delete productData.main_video;
        delete productData.main_video_key;
      }

      // console.log(JSON.stringify(productData, null, 2));
      // console.log(JSON.stringify(requestData, null, 2));
      // name বদলে থাকলে পুরনো slug history তে push করো
      const slugChanged = existingProduct.product_slug !== updatedSlug;
      if (existingProduct.product_name !== requestData.product_name) {
        await ProductModel.updateOne(
          { _id: requestData._id },
          {
            $push: {
              product_slug_history: existingProduct.product_slug,
            },
          },
        );
      }

      // Save product in the database
      const newProduct: any = await updateProductServices(
        requestData?._id,
        productData,
      );

      // QR regen when slug changes (URL → new) OR when product never had QR.
      // qr_short_code is immutable per product, but legacy docs may not have
      // it yet — backfill on first save after migration.
      if (newProduct && (slugChanged || !existingProduct.qr_code_image || !existingProduct.qr_short_code)) {
        let shortCode = existingProduct?.qr_short_code;
        if (!shortCode) {
          shortCode = await generateUniqueShortCode();
          await ProductModel.updateOne(
            { _id: requestData?._id },
            { $set: { qr_short_code: shortCode } },
          );
        }
        await persistQrForProduct(requestData?._id, shortCode, updatedSlug);
      }

      if (newProduct) {
        if (
          requestData.is_variation == "true" &&
          requestData?.againAddNewVariation == "false"
        ) {
          const variation_details = req.body.variation_details;
          // Phase 0.5 V2 — same 500 cap as postProduct.
          const _vdArr = Array.isArray(variation_details)
            ? variation_details
            : Object.values(variation_details ?? {});
          if (_vdArr.length > 500) {
            throw new ApiError(
              400,
              `Too many variations (${_vdArr.length}). Maximum allowed is 500 per product.`,
            );
          }
          const updatedVariation_details = [];
          // Variation gen settings (same conventions as parent).
          const updSkuSettings: any = await SettingModel.findOne()
            .select("sku_prefix barcode_auto_generate barcode_default_format")
            .lean();
          const updSkuPrefix = updSkuSettings?.sku_prefix || "FS";
          const updAutoGenBc = updSkuSettings?.barcode_auto_generate !== false;
          const updDefaultBcFormat =
            updSkuSettings?.barcode_default_format || "CODE128";
          const updParentHash =
            existingProduct.product_sku_hash || undefined;
          const updSavedVariantAxes = existingProduct.variant_axes || [];

          // Path A Q4 — pre-fetch ALL existing variation immutability data in
          // ONE bulk query (vs per-row findById). NEW rows have no _id and
          // skip this.
          const existingIds = variation_details
            .map((p: any) => p?._id)
            .filter(Boolean);
          const existingVarMap = new Map<string, any>();
          if (existingIds.length > 0) {
            const existingVars: any[] = await VariationModel.find({
              _id: { $in: existingIds },
            })
              .select(
                "variation_sku variation_barcode variation_barcode_format variation_barcode_image variation_barcode_image_key",
              )
              .lean();
            for (const v of existingVars) {
              existingVarMap.set(String(v._id), v);
            }
          }

          // Path A Q4 — pre-generate batch barcodes + axis codes for ALL
          // NEW rows (those without _id). Existing rows preserve their codes.
          const newRows = variation_details.filter((p: any) => !p?._id);
          const newRowsBarcodes =
            updAutoGenBc && newRows.length
              ? await generateUniqueBarcodesBatch(
                  newRows.length,
                  "variation",
                  // updateProduct currently doesn't use a transaction session;
                  // pass undefined so we hit the default read concern. Still
                  // bulk-batched.
                  undefined,
                )
              : [];
          const newRowsAxisCodes = newRows.length
            ? await buildVariationAxisCodesBatch(
                newRows,
                updSavedVariantAxes,
                requestData?._id,
                undefined,
              )
            : [];
          // Map new-row reference → its index in the new-only arrays for
          // O(1) lookup inside the main loop.
          const newRowIndexMap = new Map<any, number>();
          newRows.forEach((row: any, i: number) =>
            newRowIndexMap.set(row, i),
          );

          for (let index = 0; index < variation_details.length; index++) {
            let product = variation_details[index];
            product.product_id = requestData?._id;
            const matchingFiles = files.filter(
              (file) =>
                file.fieldname ===
                `variation_details[${index}][variation_image]`,
            );
            const matchingVideos = files.filter(
              (file) =>
                file.fieldname ===
                `variation_details[${index}][variation_video]`,
            );

            // STRICT IMMUTABILITY: existing variation rows always preserve
            // their SKU/barcode/format. NEW rows (no _id, e.g. admin added a
            // fresh combination via axis change) get backend-generated codes.
            const existingVar = product._id
              ? existingVarMap.get(String(product._id))
              : null;

            if (existingVar) {
              // Existing row — carry forward everything immutable. Ignore any
              // values arriving in the request body (stale-client safety).
              product.variation_sku = existingVar.variation_sku;
              product.variation_barcode = existingVar.variation_barcode;
              product.variation_barcode_format = existingVar.variation_barcode_format;
              product.variation_barcode_image = existingVar.variation_barcode_image;
              product.variation_barcode_image_key = existingVar.variation_barcode_image_key;
            } else {
              // New row — pull from pre-batched codes (no per-row DB calls).
              const newIdx = newRowIndexMap.get(product) ?? -1;
              product.variation_sku = buildSku({
                prefix: updSkuPrefix,
                hash: updParentHash,
                axisCodes: newRowsAxisCodes[newIdx] || [],
              });
              if (updAutoGenBc) {
                product.variation_barcode = newRowsBarcodes[newIdx];
                product.variation_barcode_format = updDefaultBcFormat;
              }
            }

            for (const file of matchingFiles) {
              const imageUpload = await FileUploadHelper.uploadToSpaces(file);
              product.variation_image = imageUpload.Location;
              product.variation_image_key = imageUpload.Key;
            }
            for (const file of matchingVideos) {
              const videoUpload = await FileUploadHelper.VideoUploader(file);
              product.variation_video = videoUpload.Location;
              product.variation_video_key = videoUpload.Key;
            }
            // Multi-image processing (now internally parallel-chunked Q5-3).
            await processVariationImages(product, index, files);

            updatedVariation_details.push(product);
          }

          // Path A Q4-5 — split into update vs insert paths. Updates stay
          // per-row (admin rarely bulk-edits many existing rows; runValidators
          // is needed). NEW rows use insertMany for the bulk-create benefit.
          // Phase A MOD #3 — empty-string weights to null for BOTH paths
          // (update path runs runValidators too, which casts NaN → throws).
          sanitizeVariationWeights(updatedVariation_details);
          const successVariationUpload: any = [];
          const toUpdate = updatedVariation_details.filter(
            (v: any) => v._id,
          );
          const toInsert = updatedVariation_details.filter(
            (v: any) => !v._id,
          );

          for (const v of toUpdate) {
            const result: any = await VariationModel.updateOne(
              { _id: v._id },
              v,
              { runValidators: true },
            );
            if (result) successVariationUpload.push(result);
          }

          if (toInsert.length > 0) {
            // Defensive: blank string _id from a stale form would get bulk-
            // inserted as a literal string; strip before insertMany.
            toInsert.forEach((v: any) => {
              if (!v._id) delete v._id;
              v.product_id = requestData?._id;
            });
            const created: any = await VariationModel.insertMany(toInsert, {
              ordered: true,
            });
            if (!created || created.length !== toInsert.length) {
              throw new ApiError(
                500,
                `Variation insertMany count mismatch (update path): expected ${toInsert.length}, got ${created?.length || 0}`,
              );
            }
            successVariationUpload.push(...created);
          }

          // ── Variation-row deletion (matrix shrink) ──
          // The admin may have removed rows from the matrix (axis change,
          // explicit delete). Anything that existed BEFORE but isn't in the
          // submitted updatedVariation_details now → hard delete. The
          // subsequent cleanupOrphanedProductMedia pass picks up the orphan
          // S3 keys.
          const submittedVariationIds = new Set(
            updatedVariation_details
              .map((v: any) => v._id && String(v._id))
              .filter(Boolean),
          );
          const removedVariationIds = existingVariations
            .map((v: any) => String(v._id))
            .filter((id: string) => !submittedVariationIds.has(id));
          if (removedVariationIds.length > 0) {
            await VariationModel.deleteMany({
              _id: { $in: removedVariationIds },
            });
          }

          // Orphan-cleanup S3 pass (Batch 2 D wire-in).
          try {
            await cleanupOrphanedProductMedia(
              existingProduct,
              existingVariations,
              requestData?._id,
            );
          } catch (e) {
            console.warn("[product update] orphan cleanup failed", e);
          }

          if (successVariationUpload.length > 0) {
            return sendResponse(res, {
              statusCode: 200,
              success: true,
              message: "Product created successfully!",
            });
          }
        }

        // No-variation path — still need orphan cleanup for main_image / video
        // / size_chart / other_images swaps. Variation diff resolves to empty
        // (both prev and next have no variations) so only product-level keys
        // are evaluated.
        try {
          await cleanupOrphanedProductMedia(
            existingProduct,
            existingVariations,
            requestData?._id,
          );
        } catch (e) {
          console.warn("[product update] orphan cleanup failed", e);
        }

        return sendResponse(res, {
          statusCode: 200,
          success: true,
          message: "Product created successfully!",
        });
      }
    } else {
      throw new ApiError(400, "Image Upload Failed");
    }
  } catch (error) {
    next(error);
  }
};

// Find Related Product
export const findRelatedProduct: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<IProductInterface | any> => {
  try {
    const { product_slug }: any = req.query;
    const result: IProductInterface[] | any =
      await findRelatedProductServices(product_slug);

    return sendResponse<IProductInterface>(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Product Found Successfully !",
      data: result,
    });
  } catch (error: any) {
    next(error);
  }
};

// Find All dashboard Product
export const findAllDashboardProduct: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<IProductInterface | any> => {
  try {
    const {
      page = 1,
      limit = 10,
      searchTerm,
      category_id,
      brand_id,
      stock_filter,
    } = req.query;
    const pageNumber = Number(page);
    const limitNumber = Number(limit);
    const skip = (pageNumber - 1) * limitNumber;
    const result: IProductInterface[] | any =
      await findAllDashboardProductServices(
        limitNumber,
        skip,
        searchTerm,
        category_id as string | undefined,
        brand_id as string | undefined,
        stock_filter as string | undefined,
      );

    // Build the same where condition for accurate total count
    const andCondition: any[] = [];
    if (searchTerm) {
      andCondition.push({
        $or: productSearchableField.map((field) => ({
          [field]: { $regex: searchTerm, $options: "i" },
        })),
      });
    }
    if (category_id) andCondition.push({ category_id });
    if (brand_id) andCondition.push({ brand_id });
    if (stock_filter === "in_stock") {
      andCondition.push({ product_quantity: { $gt: 0 } });
    } else if (stock_filter === "low_stock") {
      andCondition.push({ product_quantity: { $gt: 0, $lte: 10 } });
    }

    const whereCondition =
      andCondition.length > 0 ? { $and: andCondition } : {};
    const total = await ProductModel.countDocuments(whereCondition);
    return sendResponse<IProductInterface>(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Product Found Successfully !",
      data: result,
      totalData: total,
    });
  } catch (error: any) {
    next(error);
  }
};

// A2 (2026-06-04) — operational dashboard list endpoint. Adds annotated
// fields (variation_count, stock_total, low/out flags, flag tags, has_theme,
// has_page_content) the new product list page needs. Original /dashboard is
// left untouched so other consumers keep working.
export const findAllDashboardProductRich: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<IProductInterface | any> => {
  try {
    const {
      page = 1,
      limit = 10,
      searchTerm,
      status,
      stock,
      has_variation,
      category_id,
      brand_id,
      has_theme,
      product_type,
      sort = "new",
    } = req.query as Record<string, string>;
    const pageNumber = Number(page);
    const limitNumber = Number(limit);
    const skip = (pageNumber - 1) * limitNumber;

    const filters = {
      status,
      stock,
      has_variation,
      category_id,
      brand_id,
      has_theme,
      product_type,
    };

    const [result, total] = await Promise.all([
      findAllDashboardProductRichServices(
        limitNumber,
        skip,
        searchTerm,
        filters,
        sort,
      ),
      countDashboardProductRichServices(searchTerm, filters),
    ]);

    return sendResponse<IProductInterface>(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Product list (rich) fetched",
      data: result,
      totalData: total,
    });
  } catch (error: any) {
    next(error);
  }
};

// A2 — whitelisted partial update for the quick toggles + per-column edit
// modals. Goes around the full-rebuild `PATCH /product` flow that wipes
// fields not in the payload.
export const patchProductQuick: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<any> => {
  try {
    const { _id, ...body } = req.body;
    const result = await patchProductQuickServices(
      _id,
      body,
      (req as any).user?._id,
    );
    return sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Product updated",
      data: result,
    });
  } catch (error: any) {
    next(error);
  }
};

// A2 — Images modal endpoint: swap main / add to other / reorder / remove.
// Mode + payload come from req.body; files come from multer.any() (because
// the field names are fixed: main_image, other_images).
export const patchProductImages: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<any> => {
  try {
    const { _id, mode, removed_keys, ordered_keys } = req.body;
    // multer .any() returns an array; group by fieldname for the service.
    const filesArr = (req.files as any[]) || [];
    const grouped: any = { main_image: [], other_images: [], main_video: [] };
    filesArr.forEach((f) => {
      if (f.fieldname === "main_image") grouped.main_image.push(f);
      else if (f.fieldname === "other_images") grouped.other_images.push(f);
      else if (f.fieldname === "main_video") grouped.main_video.push(f);
    });
    const parsedRemoved = Array.isArray(removed_keys)
      ? removed_keys
      : removed_keys
        ? JSON.parse(removed_keys)
        : [];
    const parsedOrdered = Array.isArray(ordered_keys)
      ? ordered_keys
      : ordered_keys
        ? JSON.parse(ordered_keys)
        : [];
    const result = await patchProductImagesServices(
      _id,
      mode,
      grouped,
      { removed_keys: parsedRemoved, ordered_keys: parsedOrdered },
      (req as any).user?._id,
    );
    return sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Product images updated",
      data: result,
    });
  } catch (error: any) {
    next(error);
  }
};

// Distinct FAQ placeholder keys across the catalog (for the admin chip picker).
export const findFaqPlaceholderKeys: RequestHandler = async (
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<any> => {
  try {
    const result = await listFaqPlaceholderKeysService();
    return sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Placeholder keys fetched",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// Find A dashboard Product
export const findADashboardProduct: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<IProductInterface | any> => {
  try {
    const _id = req?.params?._id;
    const result: IProductInterface[] | any =
      await findADashboardProductServices(_id);
    // No totalData on single-fetch — the previous countDocuments() call was a
    // wasted full-collection scan on every admin product edit open.
    return sendResponse<IProductInterface>(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Product Found Successfully !",
      data: result,
    });
  } catch (error: any) {
    next(error);
  }
};

// Find A dashboard Product
export const findAProductDetails: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<IProductInterface | any> => {
  try {
    const product_slug = req.params.product_slug;
    const result: any = await findAProductDetailsServices(product_slug);

    // redirect_slug আসলে 301 পাঠাও
    if (result?.redirect_slug && !result?.data) {
      return res.status(301).json({
        statusCode: 301,
        success: true,
        message: "Product moved permanently",
        redirect_slug: result.redirect_slug,
      });
    }

    // ✅ result.data unwrap — double nesting fix
    return res.status(200).json({
      statusCode: 200,
      success: true,
      message: "Product Found Successfully !",
      data: result?.data,
    });
  } catch (error: any) {
    next(error);
  }
};

// export const findAProductDetails: RequestHandler = async (
//   req: Request,
//   res: Response,
//   next: NextFunction,
// ): Promise<IProductInterface | any> => {
//   try {
//     const product_slug = req.params.product_slug;
//     const result: IProductInterface[] | any =
//       await findAProductDetailsServices(product_slug);
//     return sendResponse<IProductInterface>(res, {
//       statusCode: httpStatus.OK,
//       success: true,
//       message: "Product Found Successfully !",
//       data: result,
//     });
//   } catch (error: any) {
//     next(error);
//   }
// };

// Find cart Product
export const findCartProduct: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<IProductInterface | any> => {
  try {
    const products = req?.body?.products;
    const result: IProductInterface[] | any =
      await findCartProductServices(products);
    return sendResponse<IProductInterface>(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Product Found Successfully !",
      data: result,
    });
  } catch (error: any) {
    next(error);
  }
};

// Find Compare Product
export const findCompareProduct: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<IProductInterface | any> => {
  try {
    const products = req?.query?.products;
    const result: IProductInterface[] | any =
      await findCompareProductServices(products);
    return sendResponse<IProductInterface>(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Product Found Successfully !",
      data: result,
    });
  } catch (error: any) {
    next(error);
  }
};

// delete A Product item
export const deleteAProductInfo = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const _id = req.body?._id;
    const findProductInOrderExist: boolean | null | undefined | any =
      await OrderProductModel.exists({
        product_id: _id,
      });
    if (findProductInOrderExist) {
      throw new ApiError(400, "Already Added In Order !");
    }
    // Phase B — offer orders now live in orderproducts too, so the order guard
    // above already covers them (the separate offerOrder guard was removed).
    const findProductInOfferExist: boolean | null | undefined | any =
      await OfferModel.exists({
        "offer_products.offer_product_id": _id,
      });
    if (findProductInOfferExist) {
      throw new ApiError(400, "Already Added In Offer !");
    }
    const result = await deleteProductServices(_id);
    if (result?.deletedCount > 0) {
      await VariationModel.deleteMany({ product_id: _id });
      return sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Product Delete successfully !",
      });
    } else {
      throw new ApiError(400, "Product delete failed !");
    }
  } catch (error) {
    next(error);
  }
};

// ================================================================
// GET Low-Stock Products & Variations (Phase B, B4)
// ================================================================
export const findLowStock: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<any> => {
  try {
    const result = await findLowStockServices();
    return sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Low stock items found successfully !",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// ================================================================
// POST Generate QR (Phase F)
// ================================================================
// Phase 0.5+ Option 1 — ensure a barcode IMAGE exists for a product or
// variation, generating + S3-uploading lazily on first request.
//
// Body: { kind: "product" | "variation", id: string }
// Response: { data: { barcode, barcode_image, barcode_format } }
//
// The admin Print Label modal calls this when it has the barcode NUMBER but
// the image URL is null (which is the new default after the lazy-generation
// rollout). Subsequent requests for the same line return the cached URL —
// no regen. Why lazy: bwip-js render + S3 PUT was ~1-2 sec per row inside
// the variation save loop and timed out the parent Mongo transaction past a
// few hundred rows. Print is the only consumer of the image, so we generate
// at print time — 99% of variation images would otherwise never be used.
export const ensureBarcodeImage: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<any> => {
  try {
    const { kind, id } = (req.body || {}) as { kind?: string; id?: string };
    if (!kind || !id) throw new ApiError(400, "kind and id required");
    if (kind !== "product" && kind !== "variation") {
      throw new ApiError(400, 'kind must be "product" or "variation"');
    }

    const Model: any = kind === "product" ? ProductModel : VariationModel;
    const numberField =
      kind === "product" ? "barcode" : "variation_barcode";
    const imageField =
      kind === "product" ? "barcode_image" : "variation_barcode_image";
    const imageKeyField =
      kind === "product" ? "barcode_image_key" : "variation_barcode_image_key";
    const formatField =
      kind === "product" ? "barcode_format" : "variation_barcode_format";

    const doc: any = await Model.findById(id).select(
      `${numberField} ${imageField} ${imageKeyField} ${formatField}`,
    );
    if (!doc) throw new ApiError(404, `${kind} not found`);

    const barcodeNumber = doc[numberField];
    if (!barcodeNumber) {
      throw new ApiError(
        400,
        `${kind} has no barcode number — nothing to render.`,
      );
    }

    // Already cached → return immediately. Most-frequent path after first
    // print. No regen, no S3 call.
    if (doc[imageField]) {
      return sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Barcode image ready",
        data: {
          barcode: barcodeNumber,
          barcode_image: doc[imageField],
          barcode_format: doc[formatField] || "CODE128",
        },
      });
    }

    // First print → render + upload + persist.
    const format = doc[formatField] || "CODE128";
    const img = await renderBarcodeImage(barcodeNumber, format);
    doc[imageField] = img.Location;
    doc[imageKeyField] = img.Key;
    await doc.save();

    return sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Barcode image generated",
      data: {
        barcode: barcodeNumber,
        barcode_image: img.Location,
        barcode_format: format,
      },
    });
  } catch (error: any) {
    next(error);
  }
};

// ================================================================
// Body: { product_id? OR text? } — generates a QR data-URL. If product_id is
// passed, also persists it onto the product as `qr_code_image` so the next
// PDP fetch already has it. Lets the admin click "Generate QR" once.
export const generateProductQr: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<any> => {
  try {
    const { product_id, text } = req.body || {};
    if (!product_id && !text) {
      throw new ApiError(400, "product_id or text required");
    }

    let payload: string;
    let product: any = null;
    if (product_id) {
      product = await ProductModel.findById(product_id).select(
        "product_slug qr_code qr_short_code",
      );
      if (!product) throw new ApiError(404, "Product not found");
      // Backfill short_code on legacy docs that pre-date the /q/ pattern.
      if (!product.qr_short_code) {
        product.qr_short_code = await generateUniqueShortCode();
        await ProductModel.updateOne(
          { _id: product._id },
          { $set: { qr_short_code: product.qr_short_code } },
        );
      }
      payload = await buildQrPayload(product.qr_short_code);
    } else {
      payload = text as string;
    }

    let dataUrl: string;
    if (product) {
      const qr = await renderQrImage(payload, product.product_slug);
      await ProductModel.updateOne(
        { _id: product._id },
        {
          $set: {
            qr_code: payload,
            qr_code_image: qr.Location,
            qr_code_image_key: qr.Key,
            qr_code_updated_at: new Date(),
          },
        },
      );
      dataUrl = qr.Location;
    } else {
      dataUrl = await QRCode.toDataURL(payload);
    }
    return sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "QR generated.",
      data: { qr_code: payload, qr_code_image: dataUrl },
    });
  } catch (error) {
    next(error);
  }
};

// ================================================================
// POST Bump View Count (Phase F)
// ================================================================
// Lightweight public endpoint storefront PDP calls fire-and-forget after a
// page view. No throttling at the DB layer — relies on FE deduping per session.
/**
 * Public lookup by qr_short_code — used by the storefront /q/<code> route to
 * resolve a printed QR back to the current product slug. Returns only what's
 * needed to construct the redirect URL (slug + status). Variation-aware Phase 2.
 */
export const lookupProductByQrCode: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<any> => {
  try {
    const { code } = req.params;
    if (!code) throw new ApiError(400, "Short code required");
    const product: any = await ProductModel.findOne({ qr_short_code: code })
      .select("product_slug product_status")
      .lean();
    if (!product) throw new ApiError(404, "Product not found");
    if (product.product_status !== "active") {
      throw new ApiError(410, "Product no longer available");
    }
    return sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Lookup successful",
      data: { product_slug: product.product_slug },
    });
  } catch (error) {
    next(error);
  }
};

export const bumpProductViewCount: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<any> => {
  try {
    const { product_id } = req.body || {};
    if (!product_id) throw new ApiError(400, "product_id required");
    await ProductModel.updateOne(
      { _id: product_id },
      { $inc: { view_count: 1 } },
    );
    return sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "View counted.",
    });
  } catch (error) {
    next(error);
  }
};

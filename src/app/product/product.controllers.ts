import {
  NextFunction,
  request,
  Request,
  RequestHandler,
  Response,
} from "express";
import { FileUploadHelper } from "../../helpers/image.upload";
import sendResponse from "../../shared/sendResponse";
import ApiError from "../../errors/ApiError";
import ProductModel from "./product.model";
import { IProductInterface, productSearchableField } from "./product.interface";
import {
  deleteProductServices,
  findADashboardProductServices,
  findAllDashboardProductServices,
  findAProductDetailsServices,
  findBrandMatchProductServices,
  findCartProductServices,
  findCompareProductServices,
  findECommerceChoiceProductServices,
  findJustForYouProductServices,
  findPopularProductServices,
  findRelatedProductServices,
  findTrendingProductServices,
  postProductServices,
  updateProductServices,
  updateProductPageContentServices,
  findLowStockServices,
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
import OrderProductModel from "../orderProducts/orderProduct.model";
import OfferOrderModel from "../offerOrder/offerOrder.model";
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

  if (r?.warehouse_id !== undefined && r.warehouse_id !== "") {
    out.warehouse_id = r.warehouse_id;
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
      const requestData = req.body;
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

      // Generate a unique slug for the product
      const product_slug = await generateUniqueSlug(requestData?.product_name);
      requestData.product_slug = product_slug;
      requestData.is_variation = requestData?.showProductVariation;

      let barcode: any;

      // if (requestData?.showProductVariation == "false") {
      //   barcode = await generateQRCode();
      //   requestData.barcode = requestData?.barcode
      //     ? requestData?.barcode
      //     : barcode;
      //   requestData.barcode_image = await QRCode.toDataURL(
      //     requestData?.barcode ? requestData?.barcode : barcode
      //   );
      // }
      // Resolve the nested-tree category_path for the chosen leaf category:
      // full chain root → … → leaf (inclusive), so subtree filtering by any
      // ancestor id matches this product. See category_path convention in 0.2.
      const category_path = await resolveProductCategoryPath(
        requestData?.category_id,
      );

      // Create product object
      const productData: any = {
        product_name: requestData?.product_name,
        product_slug: requestData?.product_slug,
        // product_sku: requestData?.product_sku,
        product_status: requestData?.product_status as "active" | "in-active",
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
        // barcode: requestData?.barcode ?? "",
        // barcode_image: requestData?.barcode_image ?? "",
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
        // Process variation_details images
        const updatedVariation_details: any = [];
        for (let index = 0; index < variation_details.length; index++) {
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

          // let v_barcode: any;
          // v_barcode = await generateQRCode();
          // product.variation_barcode = product.variation_barcode
          //   ? product.variation_barcode
          //   : v_barcode;
          // product.variation_barcode_image = await QRCode.toDataURL(
          //   product.variation_barcode
          // );
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

          updatedVariation_details.push(product);
        }

        const successVariationUpload: any = [];
        // Loop through each state in the array
        for (const variationDetails of updatedVariation_details) {
          // Call the service to save the state with merged data
          const result: IVariationInterface | {} = await VariationModel.create(
            [variationDetails],
            { session },
          );
          if (result) {
            successVariationUpload.push(result);
          }
        }
        if (successVariationUpload.length > 0) {
          // Commit transaction
          await session.commitTransaction();
          session.endSession();
          return sendResponse(res, {
            statusCode: 200,
            success: true,
            message: "Product created successfully!",
          });
        }
      }

      // Commit transaction
      await session.commitTransaction();
      session.endSession();
      return sendResponse(res, {
        statusCode: 200,
        success: true,
        message: "Product created successfully!",
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
      const requestData = req.body;
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

      let updatedSlug = existingProduct.product_slug; // default পুরনো slug

      if (existingProduct.product_name !== requestData.product_name) {
        // name বদলেছে — নতুন slug বানাও
        updatedSlug = await generateUniqueSlug(requestData.product_name);
      }

      requestData.is_variation = requestData?.is_variation;

      // Recompute category_path on update (PATCH /product is a full rebuild —
      // see [[product-update-route-is-full-rebuild]]), so the chosen leaf's
      // ancestor chain is re-derived each save.
      const category_path = await resolveProductCategoryPath(
        requestData.category_id,
      );

      // Create product object
      const productData: any = {
        product_name: requestData.product_name,
        product_slug: updatedSlug,
        // product_sku: requestData.product_sku,
        product_status: requestData.product_status as "active" | "in-active",
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
        // barcode: requestData?.barcode ? requestData?.barcode : barcode,
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

      if (newProduct) {
        if (
          requestData.is_variation == "true" &&
          requestData?.againAddNewVariation == "false"
        ) {
          const variation_details = req.body.variation_details;
          const updatedVariation_details = [];
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
            // let v_barcode: any;
            // v_barcode = await generateQRCode();
            // product.variation_barcode =
            //   product.variation_barcode != "undefined" &&
            //   product.variation_barcode != "null" &&
            //   product.variation_barcode != null &&
            //   product.variation_barcode != undefined &&
            //   product.variation_barcode != ""
            //     ? product.variation_barcode
            //     : v_barcode;
            // product.variation_barcode_image = await QRCode.toDataURL(
            //   product.variation_barcode
            // );

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

            updatedVariation_details.push(product);
          }

          const successVariationUpload: any = [];
          // Loop through each state in the array
          for (const variationDetails of updatedVariation_details) {
            // Call the service to save the state with merged data
            const result: IVariationInterface | {} | any =
              await VariationModel.updateOne(
                { _id: variationDetails._id },
                variationDetails,
                { runValidators: true },
              );
            if (result) {
              successVariationUpload.push(result);
            }
          }
          if (successVariationUpload.length > 0) {
            return sendResponse(res, {
              statusCode: 200,
              success: true,
              message: "Product created successfully!",
            });
          }
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
    const { page = 1, limit = 10, searchTerm } = req.query;
    const pageNumber = Number(page);
    const limitNumber = Number(limit);
    const skip = (pageNumber - 1) * limitNumber;
    const result: IProductInterface[] | any =
      await findAllDashboardProductServices(limitNumber, skip, searchTerm);
    const andCondition = [];
    if (searchTerm) {
      andCondition.push({
        $or: productSearchableField.map((field) => ({
          [field]: {
            $regex: searchTerm,
            $options: "i",
          },
        })),
      });
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
    const total = await ProductModel.countDocuments();
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
    const products = req?.query?.products;
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
    const findProductInOfferOrderExist: boolean | null | undefined | any =
      await OfferOrderModel.exists({
        "offer_products.offer_product_id": _id,
      });
    if (findProductInOfferOrderExist) {
      throw new ApiError(400, "Already Added In Offer Order !");
    }
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
    let payload = text as string | undefined;
    let product: any = null;
    if (product_id) {
      product = await ProductModel.findById(product_id).select(
        "product_slug qr_code",
      );
      if (!product) throw new ApiError(404, "Product not found");
      payload = product.qr_code || product.product_slug;
    }
    if (!payload) throw new ApiError(400, "product_id or text required");
    const dataUrl = await QRCode.toDataURL(payload);
    if (product) {
      await ProductModel.updateOne(
        { _id: product._id },
        { $set: { qr_code: payload, qr_code_image: dataUrl } },
      );
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

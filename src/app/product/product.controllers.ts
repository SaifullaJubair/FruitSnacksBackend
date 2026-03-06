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

// Path to the upload folder
const uploadDir = path.join(__dirname, "../../../uploads");

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
      // Create product object
      const productData: any = {
        product_name: requestData?.product_name,
        product_slug: requestData?.product_slug,
        // product_sku: requestData?.product_sku,
        product_status: requestData?.product_status as "active" | "in-active",
        category_id: requestData?.category_id,
        sub_category_id: requestData?.sub_category_id
          ? requestData?.sub_category_id
          : undefined,
        child_category_id: requestData?.child_category_id
          ? requestData?.child_category_id
          : undefined,
        brand_id: requestData?.brand_id ? requestData?.brand_id : undefined,
        specifications:
          requestData?.specifications?.map(
            (spec?: { specification_id: any; specification_values: any }) => ({
              specification_id: spec?.specification_id,
              specification_values:
                spec?.specification_values?.map(
                  (value: { specification_value_id: any }) => ({
                    specification_value_id: value?.specification_value_id
                      ? value?.specification_value_id
                      : undefined,
                  }),
                ) ?? [],
            }),
          ) ?? [],
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

      const files = req?.files as Express.Multer.File[];

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

      // Create product object
      const productData: any = {
        product_name: requestData.product_name,
        product_slug: updatedSlug,
        // product_sku: requestData.product_sku,
        product_status: requestData.product_status as "active" | "in-active",
        category_id: requestData.category_id,
        sub_category_id: requestData.sub_category_id
          ? requestData.sub_category_id
          : undefined,
        child_category_id: requestData.child_category_id
          ? requestData.child_category_id
          : undefined,
        brand_id: requestData.brand_id ? requestData.brand_id : undefined,
        specifications:
          requestData.specifications?.map(
            (spec: { specification_id: any; specification_values: any }) => ({
              specification_id: spec.specification_id,
              specification_values:
                spec.specification_values?.map(
                  (value: { specification_value_id: any }) => ({
                    specification_value_id: value.specification_value_id
                      ? value.specification_value_id
                      : undefined,
                  }),
                ) ?? [],
            }),
          ) ?? [],
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

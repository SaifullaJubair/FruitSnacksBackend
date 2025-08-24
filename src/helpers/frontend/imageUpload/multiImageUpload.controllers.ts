import { NextFunction, Request, RequestHandler, Response } from "express";
import { FileUploadHelper } from "../../image.upload";
import sendResponse from "../../../shared/sendResponse";

// Post multiple images with product data
export const postMultipleImageUploads: RequestHandler = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const products = req.body.products;
      const files = req.files as Express.Multer.File[];
  
      const updatedProducts = [];
  
      // Process each product and attach the corresponding image URL if provided
      for (let index = 0; index < products.length; index++) {
        let product = products[index];
  
        // Find the file corresponding to the product based on the field name
        const matchingFiles = files.filter(
          (file) => file.fieldname === `products[${index}][image]`
        );
  
        if (matchingFiles.length > 0) {
          // Upload the first matching file for the product
          const imageUpload = await FileUploadHelper.uploadToSpaces(
            matchingFiles[0]
          );
          product.image = imageUpload.Location;
        }
  
        updatedProducts.push(product);
      }
  
      return sendResponse(res, {
        statusCode: 200,
        success: true,
        message: "Products with images uploaded successfully!",
        data: updatedProducts,
      });
    } catch (error) {
      next(error);
    }
  };
  

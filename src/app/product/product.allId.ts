import ProductModel from "./product.model";
import fs from "fs";
import path from "path";

// Function to delete all files in the upload folder
export const deleteAllFilesInDirectory = (directoryPath: string) => {
  fs.readdir(directoryPath, (err, files) => {
    if (err) {
      // console.error("Error reading the upload directory:", err);
      return;
    }

    // Loop over each file in the directory
    files.forEach((file) => {
      const filePath = path.join(directoryPath, file);

      fs.unlink(filePath, (unlinkErr) => {
        if (unlinkErr) {
          // console.error(`Error deleting file ${file}:`, unlinkErr);
        } else {
          // console.log(`File deleted: ${file}`);
        }
      });
    });
  });
};

export const generateQRCode = async () => {
  let isUnique = false;
  let uniqueBarcode;

  while (!isUnique) {
    // Generate a random alphanumeric string of length 8
    uniqueBarcode = Array.from({ length: 8 }, () =>
      "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789".charAt(
        Math.floor(Math.random() * 62)
      )
    ).join("");

    // Check if the generated barcode is unique in the database
    const existingOrder = await ProductModel.findOne({
      barcode: uniqueBarcode,
    });

    // If no existing order found, mark the barcode as unique
    if (!existingOrder) {
      isUnique = true;
    }
  }

  return uniqueBarcode;
};

// Helper function to generate a random string
export function generateRandomString(length: number): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Function to generate a unique slug
export async function generateUniqueSlug(productName: string): Promise<string> {
  const sanitizedProductName = productName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  let uniqueSlug = `${sanitizedProductName}-${generateRandomString(5)}`;
  let slugExists = await ProductModel.findOne({ product_slug: uniqueSlug });

  while (slugExists) {
    uniqueSlug = `${sanitizedProductName}-${generateRandomString(5)}`;
    slugExists = await ProductModel.findOne({ product_slug: uniqueSlug });
  }

  return uniqueSlug;
}

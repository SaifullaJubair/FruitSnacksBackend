import ProductModel from "./product.model";
import fs from "fs";
import path from "path";
import anyAscii from "../../helpers/anyAscii";

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

/**
 * Build a clean URL slug from any product name (English, Bangla, mixed, etc.).
 *   "Premium Wallet"           → "premium-wallet"
 *   "প্রিমিয়াম পাঞ্জাবী"            → "primium-panjabi"     (via any-ascii)
 *   "  s s  "                  → "s-s"
 *   "🔥 hot deal!! 100% off"   → "hot-deal-100-off"
 *
 * Pure transformation — no DB hit. Use generateUniqueSlug() for the
 * collision-safe version that returns a URL that's actually free.
 */
export function slugify(productName: string): string {
  const ascii = anyAscii(productName || "");
  return ascii
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Generate a clean, unique product slug — Shopify/WooCommerce pattern.
 *
 *   First product:          "premium-wallet"
 *   Second (same name):     "premium-wallet-2"
 *   Third:                  "premium-wallet-3"
 *   …
 *   100th:                  "premium-wallet-100"
 *
 * No random hash suffix in the common case — keeps URLs clean, keyword-rich,
 * memorable, shareable. Bangla / Hindi / Arabic / emoji names are first
 * transliterated to ASCII (any-ascii) so we don't end up with %E0%A6… URLs.
 *
 * @param productName   raw product name (any script, may include whitespace)
 * @param excludeId     when updating an existing product, pass its _id so we
 *                      don't treat the product's OWN current slug as a clash
 */
export async function generateUniqueSlug(
  productName: string,
  excludeId?: string,
): Promise<string> {
  const base = slugify(productName);

  // Edge case: name is purely emoji / unsupported script → ascii strip gives
  // empty string. Fall back to a short hash so the URL is at least valid.
  // Won't collide because the hash is random.
  if (!base) {
    return `product-${generateRandomString(5)}`;
  }

  const excludeFilter = excludeId
    ? { _id: { $ne: excludeId } }
    : {};

  // Try the bare slug first — clean URL, no suffix.
  const baseTaken = await ProductModel.exists({
    product_slug: base,
    ...excludeFilter,
  });
  if (!baseTaken) return base;

  // Bare slug taken — walk -2, -3, -4 … Realistically owner clients won't hit
  // 50+ same-name products; if they do we still terminate, just with a
  // longer numeric suffix. No upper bound is needed (10k loop is still ms).
  let n = 2;
  // Safety cap to prevent runaway in pathological cases (broken index, etc.)
  while (n < 10000) {
    const candidate = `${base}-${n}`;
    const taken = await ProductModel.exists({
      product_slug: candidate,
      ...excludeFilter,
    });
    if (!taken) return candidate;
    n++;
  }
  // Astronomical — fall back to a hash to guarantee uniqueness.
  return `${base}-${generateRandomString(5)}`;
}

import sharp from "sharp";
import * as fs from "fs";
import * as path from "path";

// ================= Server-side image optimisation ===========================
//
// Uploads used to reach S3 exactly as they arrived — image.upload.ts said so
// plainly: "nothing is re-encoded here (raw passthrough to S3)". That is fine
// until a shop owner uploads a photo straight off their phone: a 4000x3000, 5 MB
// JPEG, to be shown in a 350px card. The storefront then pays for that on every
// single view, and no amount of front-end tuning can undo it.
//
// So we re-encode once, here, at upload time:
//   - cap the longest edge (a product shot never needs to be larger)
//   - convert to WebP, materially smaller than JPEG/PNG at the same quality
//   - strip metadata (orientation is applied first, so photos don't come out sideways)
//
// Videos and PDFs pass through untouched — sharp is for images only.

// Product images render at ~350-600px. 1600 leaves room for the PDP zoom and for
// retina screens, without carrying phone-camera dimensions around forever.
const MAX_EDGE = 1600;
const WEBP_QUALITY = 80;

// HEIC/HEIF are in here deliberately: an iPhone photo arrives as .heic, which
// most browsers still cannot display. Converting it to WebP is what makes it
// renderable at all — not merely smaller.
const OPTIMISABLE = /\.(jpe?g|png|webp|avif|heic|heif)$/i;

const isOptimisableImage = (filename: string) => OPTIMISABLE.test(filename);

/**
 * Re-encode an uploaded image in place: resize to MAX_EDGE, convert to WebP,
 * drop metadata. Mutates `file.filename`/`file.path` so the existing S3 upload
 * helpers pick up the new file with no further changes at the call sites.
 *
 * Never throws. If sharp cannot read the file we leave the original alone and
 * return it untouched — a strange-but-valid upload should still reach S3 rather
 * than fail an entire product save.
 */
const optimiseImageInPlace = async (file: any): Promise<void> => {
  if (!file?.filename || !isOptimisableImage(file.filename)) return;

  const dir = path.dirname(file.path);
  const base = path.basename(file.filename, path.extname(file.filename));
  const outName = `${base}.webp`;
  const outPath = path.join(dir, outName);

  const isHeic = /\.(heic|heif)$/i.test(file.filename);

  try {
    const before = fs.statSync(file.path).size;

    await sharp(file.path)
      // Phone photos carry an EXIF orientation flag. Without this they come out
      // rotated once the metadata is stripped.
      .rotate()
      .resize(MAX_EDGE, MAX_EDGE, {
        fit: "inside", // preserve aspect ratio
        withoutEnlargement: true, // never upscale a small image
      })
      .webp({ quality: WEBP_QUALITY })
      .toFile(outPath);

    const after = fs.statSync(outPath).size;

    // Re-encoding is not always a win, and it took a measurement to see it: a
    // 211 KB 800x800 JPEG — already small, already compressed, exactly what a
    // careful shop owner uploads — came out of WebP at 322 KB. Overwriting it
    // would have made the storefront slower, which is the opposite of the point.
    // So we only keep the new file when it actually won.
    //
    // HEIC/HEIF are the one exception: they get converted at any size, because
    // browsers cannot display them at all. Bigger-but-visible beats smaller-and-blank.
    if (after >= before && !isHeic) {
      fs.unlinkSync(outPath); // discard the re-encode; keep what was uploaded
      return;
    }

    fs.unlinkSync(file.path); // drop the original; the WebP replaces it
    file.filename = outName;
    file.path = outPath;
  } catch {
    // Unreadable/corrupt image — ship the original rather than fail the upload.
    // (If it is genuinely broken, it was broken before this change too.)
    try {
      if (fs.existsSync(outPath)) fs.unlinkSync(outPath);
    } catch {}
  }
};

export const ImageOptimizeHelper = {
  optimiseImageInPlace,
  isOptimisableImage,
  MAX_EDGE,
  WEBP_QUALITY,
};

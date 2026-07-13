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
// (Verified against the storefront: the PDP magnifier is ZOOM=2.8 over a ~500-600px
// container, so it needs ~1400-1700 source px. 1600 sits in that band.)
const MAX_EDGE = 1600;
const WEBP_QUALITY = 80;

// HEIC/HEIF are in here deliberately: an iPhone photo arrives as .heic, which
// most browsers still cannot display. Converting it to WebP is what makes it
// renderable at all — not merely smaller.
const OPTIMISABLE = /\.(jpe?g|png|webp|avif|heic|heif)$/i;

const isOptimisableImage = (filename: string) => OPTIMISABLE.test(filename);

// ================= Upload profiles ==========================================
//
// One rule does not fit every slot. A favicon is not a product photo:
//
//   - `favicon` KEEPS PNG. **Safari — macOS and iOS — does not render a WebP
//     favicon at all.** It is also what `apple-touch-icon` points at, so a WebP
//     favicon means a blank icon on an iPhone home screen. A favicon is drawn at
//     16-32px (180px for apple-touch-icon), so 256px is already generous and the
//     PNG stays tiny. Correctness beats the last few KB here.
//   - `logo` renders in a ~160px-wide header slot; 512px covers retina. Quality is
//     raised to 90 because flat brand art shows WebP artefacts far more readily
//     than a photograph does.
//   - `product` is the default and is exactly the behaviour that shipped before
//     profiles existed — every existing call site inherits it unchanged.
//
// `format: "keep"` means "resize and strip metadata, but do not re-encode to WebP".
type ImageProfile = {
  maxEdge: number;
  quality: number;
  format: "webp" | "keep";
};

const PROFILES: Record<string, ImageProfile> = {
  product: { maxEdge: MAX_EDGE, quality: WEBP_QUALITY, format: "webp" },
  banner: { maxEdge: 1920, quality: WEBP_QUALITY, format: "webp" },
  logo: { maxEdge: 512, quality: 90, format: "webp" },
  avatar: { maxEdge: 512, quality: 80, format: "webp" },
  icon: { maxEdge: 256, quality: 90, format: "webp" },
  favicon: { maxEdge: 256, quality: 90, format: "keep" }, // Safari: no WebP favicons
};

const resolveProfile = (name?: string): ImageProfile =>
  (name && PROFILES[name]) || PROFILES.product;

/**
 * Re-encode an uploaded image in place: resize to MAX_EDGE, convert to WebP,
 * drop metadata. Mutates `file.filename`/`file.path` so the existing S3 upload
 * helpers pick up the new file with no further changes at the call sites.
 *
 * Never throws. If sharp cannot read the file we leave the original alone and
 * return it untouched — a strange-but-valid upload should still reach S3 rather
 * than fail an entire product save.
 */
const optimiseImageInPlace = async (
  file: any,
  profileName?: string,
): Promise<void> => {
  if (!file?.filename || !isOptimisableImage(file.filename)) return;

  const profile = resolveProfile(profileName);
  const ext = path.extname(file.filename);
  const isHeic = /\.(heic|heif)$/i.test(file.filename);

  // A HEIC/HEIF file must be re-encoded whatever the profile says: no browser
  // can display it. `keep` cannot mean "keep .heic" — it would be invisible.
  const toWebp = profile.format === "webp" || isHeic;

  const dir = path.dirname(file.path);
  const base = path.basename(file.filename, ext);
  const outName = toWebp ? `${base}.webp` : `${base}${ext}`;
  const outPath = path.join(dir, toWebp ? outName : `opt-${outName}`);

  try {
    const before = fs.statSync(file.path).size;

    let pipeline = sharp(file.path)
      // Phone photos carry an EXIF orientation flag. Without this they come out
      // rotated once the metadata is stripped.
      .rotate()
      .resize(profile.maxEdge, profile.maxEdge, {
        fit: "inside", // preserve aspect ratio
        withoutEnlargement: true, // never upscale a small image
      });

    if (toWebp) {
      pipeline = pipeline.webp({ quality: profile.quality });
    } else if (/\.png$/i.test(ext)) {
      // Favicon path. Stay PNG — Safari will not render a WebP favicon, and this
      // same file is the apple-touch-icon. Palette mode + max compression keeps a
      // 256px icon at a few KB, so nothing is lost by not going WebP.
      pipeline = pipeline.png({ compressionLevel: 9, palette: true });
    } else {
      pipeline = pipeline.jpeg({ quality: profile.quality, mozjpeg: true });
    }

    await pipeline.toFile(outPath);

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

    fs.unlinkSync(file.path); // drop the original; the re-encode replaces it

    if (toWebp) {
      // Extension changed (.jpg -> .webp), so the temp file already carries the
      // final name.
      file.filename = outName;
      file.path = outPath;
    } else {
      // Same extension, so the re-encode was written to a scratch path
      // (`opt-<name>`) to avoid sharp reading and writing one file at once.
      // Move it onto the original path: `filename` must keep matching the file
      // that uploadToSpaces streams, or the S3 key names a file that is not there.
      fs.renameSync(outPath, file.path);
      file.filename = outName;
    }
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

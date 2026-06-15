/**
 * Demo-seed image helper.
 *
 * Demo products need real-looking photos. We DON'T ship binary assets in the
 * repo; instead each demo image is declared as a stable remote stock-photo URL
 * (see food.ts SOURCE_IMAGES) plus a deterministic slug. On seed we:
 *
 *   1. Build the deterministic S3 key  →  demo/<niche>/<slug>.<ext>
 *   2. If that key already exists in the bucket  →  reuse it (idempotent; a
 *      re-run or a future client of the same niche shares the same upload).
 *   3. Otherwise download the remote photo into memory and push it to S3.
 *
 * Returns { Location, Key } exactly like uploadToSpaces, so the seed stores the
 * permanent CDN URL + key on the product/banner/etc. The remote source URL is
 * NEVER stored — once uploaded the shop is self-hosted and won't break if the
 * stock-photo URL rots.
 *
 * The `demo/<niche>/` folder is intentionally shared across clients of the same
 * niche and is NOT deleted by "Clear demo data" (that only removes DB rows).
 */

import { FileUploadHelper } from "../../helpers/image.upload";

const { objectExists, uploadBufferToSpaces } = FileUploadHelper;

// One place to change when adding a niche (fashion/electronics/…). Keeps the
// "food" string from scattering across the seed files (MULTI-NICHE-DEBT note).
export const DEMO_NICHE = "food";
export const DEMO_S3_PREFIX = `demo/${DEMO_NICHE}/`;

// Map a content-type / URL to a file extension for the deterministic key.
const extFromContentType = (ct: string | null, url: string): string => {
  if (ct?.includes("png")) return "png";
  if (ct?.includes("webp")) return "webp";
  if (ct?.includes("gif")) return "gif";
  if (ct?.includes("jpeg") || ct?.includes("jpg")) return "jpg";
  // fall back to the URL extension, else jpg
  const m = url.split("?")[0].match(/\.(png|webp|gif|jpe?g)$/i);
  return m ? m[1].toLowerCase().replace("jpeg", "jpg") : "jpg";
};

const contentTypeFromExt = (ext: string): string => {
  switch (ext) {
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "gif":
      return "image/gif";
    default:
      return "image/jpeg";
  }
};

/**
 * Resolve a demo image to a permanent S3 URL, downloading + uploading only if
 * it isn't already in the bucket.
 *
 * @param remoteUrl  stock-photo source URL (only fetched on first run)
 * @param slug       stable, unique-per-niche slug → drives the S3 key
 */
export const resolveDemoImage = async (
  remoteUrl: string,
  slug: string,
): Promise<{ Location: string; Key: string }> => {
  // Extension is derived from the URL up front so the key is stable across
  // runs even before we fetch (HEAD only needs the key).
  const guessedExt = extFromContentType(null, remoteUrl);
  const key = `${DEMO_S3_PREFIX}${slug}.${guessedExt}`;

  // Idempotency: already uploaded → reuse without re-downloading.
  if (await objectExists(key)) {
    const encodedKey = key.split("/").map(encodeURIComponent).join("/");
    const Location = `${process.env.S3_PUBLIC_URL}:${process.env.S3_BUCKET}/${encodedKey}`;
    return { Location, Key: key };
  }

  // First run for this slug — download into memory.
  const res = await fetch(remoteUrl);
  if (!res.ok) {
    throw new Error(
      `Demo image download failed (${res.status}) for slug "${slug}" ← ${remoteUrl}`,
    );
  }
  const ct = res.headers.get("content-type");
  const finalExt = extFromContentType(ct, remoteUrl);
  const finalKey = `${DEMO_S3_PREFIX}${slug}.${finalExt}`;
  const arrayBuf = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuf);

  return uploadBufferToSpaces(buffer, finalKey, contentTypeFromExt(finalExt));
};

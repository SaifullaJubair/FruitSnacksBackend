import {
  DeleteObjectCommand,
  HeadObjectCommand,
  ObjectCannedACL,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import multer from "multer";
import * as fs from "fs";
import ApiError from "../errors/ApiError";
import { ImageOptimizeHelper } from "./image.optimize";
const path = require("path");
import { randomUUID } from "crypto";

// ================= S3-compatible storage (Contabo / DigitalOcean Spaces) =====
// All credentials come from env — never hardcode keys here (F009b: removed a
// real access/secret key pair that was left in comments).
const region = process.env.S3_REGION!;
const endpoint = process.env.S3_ENDPOINT!;
const s3 = new S3Client({
  region,
  endpoint,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY!,
    secretAccessKey: process.env.S3_SECRET_KEY!,
  },
});

const SpaceName = process.env.S3_BUCKET!;
// ================= Multer Config ===================
const storage = multer.diskStorage({
  destination: "uploads/",
  filename: function (req, file, cb) {
    const uniqueSuffix = randomUUID();
    cb(null, uniqueSuffix + "-" + file?.originalname);
  },
});

// F009 — whitelist the extensions we actually serve. Previously the filter
// accepted EVERYTHING (cb(null, true)), so an .exe / .html / .svg (stored XSS)
// could be uploaded and served from the public bucket. We allow images + the
// doc/video types getContentType() already knows; anything else is rejected
// before it ever touches disk or S3.
//
// avif/heic/heif added 2026-07-10: these are what a phone or a modern browser
// hands you by default now — an iPhone photo is .heic, and "Save image as" in
// Chrome on many sites yields .avif. Rejecting them meant the admin picked a
// perfectly ordinary image and got "Unsupported file type". Safe to allow:
// nothing is re-encoded here (raw passthrough to S3) and next/image re-encodes
// on the storefront anyway. `.svg` stays out on purpose — it can carry script.
const ALLOWED_UPLOAD_EXT =
  /\.(webp|avif|heic|heif|png|jpe?g|gif|mp4|mov|avi|webm|m4v|mkv|pdf)$/i;

const ImageUpload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (ALLOWED_UPLOAD_EXT.test(file.originalname)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          "Unsupported file type. Allowed: images, mp4/mov/avi/webm/m4v/mkv, pdf.",
        ),
      );
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB limit
  },
});

// Image-ONLY upload (seed review images). Reuses the same disk storage + 10 MB
// cap as ImageUpload but rejects pdf/video — a review image must be an image.
const SEED_IMAGE_EXT = /\.(webp|png|jpe?g|gif)$/i;
const SeedImageUpload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (SEED_IMAGE_EXT.test(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error("Only image files allowed (webp, png, jpg, jpeg, gif)."));
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB
  },
});

// Media upload for the product Images/Video modal route (PATCH /product/images).
// Same extension whitelist as ImageUpload but a 20 MB cap so main_video swaps
// (which can exceed the 10 MB image limit) go through the SAME safe partial
// route instead of the full-rebuild /product PATCH.
const MediaUpload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (ALLOWED_UPLOAD_EXT.test(file.originalname)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          "Unsupported file type. Allowed: images, mp4/mov/avi/webm/m4v/mkv, pdf.",
        ),
      );
    }
  },
  limits: {
    fileSize: 20 * 1024 * 1024, // 20 MB — accommodates short product videos
  },
});

// ================= Content-Type Checker ===================
// Must know every extension ALLOWED_UPLOAD_EXT lets through: the default here
// is application/octet-stream, which makes the browser DOWNLOAD the file rather
// than render it.
const getContentType = (filename: string) => {
  const extension = path.extname(filename).toLowerCase();
  switch (extension) {
    // Image types
    case ".webp":
      return "image/webp";
    case ".avif":
      return "image/avif";
    case ".heic":
      return "image/heic";
    case ".heif":
      return "image/heif";
    case ".png":
      return "image/png";
    case ".jpg":
      return "image/jpeg";
    case ".jpeg":
      return "image/jpeg";
    case ".gif":
      return "image/gif";

    // Video types
    case ".mp4":
      return "video/mp4";
    case ".mov":
      return "video/quicktime";
    case ".avi":
      return "video/x-msvideo";
    case ".webm":
      return "video/webm";
    case ".m4v":
      return "video/x-m4v";
    case ".mkv":
      return "video/x-matroska";

    // Document types
    case ".pdf":
      return "application/pdf";

    // (There used to be a second, uppercase copy of every case here. `extension`
    // is already lower-cased above, so none of them could ever match — and they
    // invited anyone adding a format to add it twice.)

    default:
      return "application/octet-stream";
  }
};

// ================= Upload Image to DigitalOcean Spaces ===================
// `keyPrefix` lets callers route uploads to a different S3 folder than the
// default `fruit_snacks_images/`. The demo-seed script passes e.g. "demo/food/"
// so demo assets live in their own niche-namespaced folder (shared across
// clients of the same niche, NOT deleted when a client clears demo data).
// Trailing slash is normalized so both "demo/food" and "demo/food/" work.
const uploadToSpaces = async (file: any, keyPrefix = "fruit_snacks_images/") => {
  // Re-encode before the bytes leave the box: cap the dimensions, convert to
  // WebP, strip EXIF. This sits INSIDE uploadToSpaces on purpose — every image
  // in the system goes through here, so no call site can forget it and quietly
  // put a 5 MB phone photo on the storefront. Videos/PDFs are passed over.
  // Mutates file.filename/file.path, which is why it must run before either is
  // read below.
  await ImageOptimizeHelper.optimiseImageInPlace(file);

  const fileStream = fs.createReadStream(file.path);
  const contentType = getContentType(file.filename);

  const prefix = keyPrefix.endsWith("/") ? keyPrefix : `${keyPrefix}/`;
  const uploadParams = {
    Bucket: SpaceName,
    Key: `${prefix}${file.filename}`, // DO তে ফোল্ডার + filename
    Body: fileStream,
    ACL: "public-read" as ObjectCannedACL, // Public read access
    ContentType: contentType,
  };

  try {
    const data = await s3.send(new PutObjectCommand(uploadParams));
    const httpStatusCode = data?.$metadata?.httpStatusCode;
    const { Key } = uploadParams;

    // ✅ CDN URL ব্যবহার করছি (origin বাদ দিয়ে)
    // const Location = `https://${SpaceName}.${region}.cdn.digitaloceanspaces.com/${Key}`;

    // const Location = `${process.env.S3_ENDPOINT}/${SpaceName}/${Key}`;
    const Location = `${process.env.S3_PUBLIC_URL}:${process.env.S3_BUCKET}/${Key}`;
    const sendData = {
      Location, // frontend এ use হবে
      Key, // future delete এর জন্য দরকার
    };

    // লোকাল uploads ফোল্ডার থেকে ফাইল delete করে দিচ্ছি
    const normalizedPath = path.normalize(file.path);
    fs.unlinkSync(normalizedPath);

    if (httpStatusCode == 200) return sendData;
    else throw new ApiError(400, "Image upload failed");
  } catch (error) {
    throw error;
  }
};

// ================= Delete File from DigitalOcean Spaces ===================
const deleteFromSpaces = async (key: any) => {
  const deleteParams = {
    Bucket: SpaceName,
    Key: key,
  };

  try {
    const data = await s3.send(new DeleteObjectCommand(deleteParams));
    const httpStatusCode = data?.$metadata?.httpStatusCode;
    if (httpStatusCode == 204) return true;
    else throw new ApiError(400, "File Delete failed"); // সাধারণ error message
  } catch (error) {
    throw error;
  }
};

// ================= S3 object existence check ===================
// Returns true if `key` already exists in the bucket. Used by the demo-seed
// image helper for idempotency — a demo image already uploaded (same
// deterministic key) is reused instead of re-uploaded, so re-running the seed
// doesn't create duplicate S3 objects.
const objectExists = async (key: string): Promise<boolean> => {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: SpaceName, Key: key }));
    return true;
  } catch (err: any) {
    // 404 / NotFound / NoSuchKey → genuinely absent. Anything else (403, network)
    // re-throws so the caller doesn't silently treat an outage as "absent" and
    // overwrite. The AWS SDK surfaces missing objects as name "NotFound".
    const code = err?.name || err?.Code;
    if (code === "NotFound" || code === "NoSuchKey" || err?.$metadata?.httpStatusCode === 404) {
      return false;
    }
    throw err;
  }
};

// ================= Upload an in-memory buffer to S3 ===================
// Like uploadToSpaces but takes a Buffer + an explicit S3 key (no local temp
// file, no multer). Used by the demo-seed image helper which downloads remote
// stock photos into memory and pushes them to a deterministic `demo/<niche>/`
// key. Idempotent at the call site via objectExists().
const uploadBufferToSpaces = async (
  buffer: Buffer,
  key: string,
  contentTypeOverride?: string,
): Promise<{ Location: string; Key: string }> => {
  const contentType = contentTypeOverride || getContentType(key);
  const data = await s3.send(
    new PutObjectCommand({
      Bucket: SpaceName,
      Key: key,
      Body: buffer,
      ACL: "public-read" as ObjectCannedACL,
      ContentType: contentType,
    }),
  );
  if (data?.$metadata?.httpStatusCode !== 200) {
    throw new ApiError(400, `Buffer upload failed for ${key}`);
  }
  const encodedKey = key.split("/").map(encodeURIComponent).join("/");
  const Location = `${process.env.S3_PUBLIC_URL}:${process.env.S3_BUCKET}/${encodedKey}`;
  return { Location, Key: key };
};

// ================= Video Upload ===================
const VideoUpload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const supportedVideo = /mp4|mov|avi|webm/i; // ✅ Support more formats
    const extension = path.extname(file.originalname);

    if (supportedVideo.test(extension)) {
      cb(null, true);
    } else {
      cb(new Error("Must be a supported video format (mp4, mov, avi, webm)"));
    }
  },
  limits: {
    fileSize: 20 * 1024 * 1024, // ✅ Changed to 20MB for videos
  },
});

const VideoUploader = async (file: any) => {
  const fileStream = fs.createReadStream(file.path);
  const contentType = getContentType(file.filename); // ডাইনামিক কনটেন্ট টাইপ

  const uploadParams = {
    Bucket: SpaceName,
    Key: `fruit_snacks_videos/${file.filename}`, // ✅ ভিডিও ফোল্ডারে সেভ হবে
    Body: fileStream,
    ACL: "public-read" as ObjectCannedACL,
    ContentType: contentType, // ✅ ডাইনামিক কনটেন্ট টাইপ
  };

  try {
    const data = await s3.send(new PutObjectCommand(uploadParams));
    const httpStatusCode = data?.$metadata?.httpStatusCode;
    const { Key } = uploadParams;

    // ✅ Use the SAME public URL pattern as uploadToSpaces above. The old
    // DigitalOcean Spaces CDN hostname (`<bucket>.<region>.cdn.digitalocean
    // spaces.com`) was retired when the project migrated to Contabo Storage;
    // hardcoding it here was leaving every video URL pointing at a domain
    // that no longer resolves (browser → ERR_NAME_NOT_RESOLVED).
    //
    // Path segments are URL-encoded so filenames with spaces / commas /
    // unicode (e.g. "Flow - May 22, 01-29 AM.mp4") resolve correctly. Slashes
    // are preserved by splitting first.
    const encodedKey = Key.split("/").map(encodeURIComponent).join("/");
    const Location = `${process.env.S3_PUBLIC_URL}:${process.env.S3_BUCKET}/${encodedKey}`;

    fs.unlinkSync(file.path);
    const sendData = {
      Location,
      Key,
    };
    if (httpStatusCode == 200) return sendData;
    else throw new ApiError(400, "Video upload failed");
  } catch (error) {
    throw error;
  }
};

// ================= Path A Q5-1 Parallel Chunk Uploader ===================
/**
 * Upload N files to S3 in parallel chunks. Default chunk size 10 matches the
 * AWS S3 SDK default connection pool — going higher risks ECONNRESET /
 * throttling on slow networks; lower wastes parallelism.
 *
 * Order is preserved INDEX-FOR-INDEX between input `files` and output array,
 * so callers can map result[i] → input[i] without bookkeeping. This is the
 * critical invariant flagged by the edge audit (HIGH H3).
 *
 * Throws if any single upload fails — caller is expected to handle (the
 * parent Mongo transaction aborts on throw, rolling back the product save).
 */
const uploadFilesInChunks = async (
  files: any[],
  chunkSize = 10,
): Promise<Array<{ Location: string; Key: string }>> => {
  if (!files?.length) return [];
  const out: Array<{ Location: string; Key: string }> = new Array(files.length);
  for (let i = 0; i < files.length; i += chunkSize) {
    const slice = files.slice(i, i + chunkSize);
    const results = await Promise.all(slice.map((f) => uploadToSpaces(f)));
    // Place results back at the correct absolute index so order is preserved
    // across multiple chunks.
    results.forEach((r, j) => {
      out[i + j] = r;
    });
  }
  // Ordering invariant — should be impossible to fail given the write
  // pattern above, but defense-in-depth catches an SDK regression early.
  if (out.length !== files.length || out.some((r) => !r)) {
    throw new ApiError(500, "Parallel upload result/order invariant violated");
  }
  return out;
};

// ================= Export Helper ===================
export const FileUploadHelper = {
  ImageUpload,
  SeedImageUpload,
  MediaUpload,
  uploadToSpaces,
  uploadFilesInChunks,
  uploadBufferToSpaces, // demo-seed: push an in-memory buffer to a fixed S3 key
  objectExists, // demo-seed: idempotency check before re-uploading
  deleteFromSpaces, // এই ফাংশন এখন যেকোন ফাইল ডিলিট করতে পারবে
  VideoUploader,
  VideoUpload,
};

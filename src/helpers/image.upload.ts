import {
  DeleteObjectCommand,
  ObjectCannedACL,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import multer from "multer";
import * as fs from "fs";
import ApiError from "../errors/ApiError";
const path = require("path");
const uuid = require("uuid");

// ================= AWS Config (DigitalOcean Spaces) ===================
// Digital Ocean space object
// const region = "sgp1"; // তোমার space এর region
// const endpoint = "https://sgp1.digitaloceanspaces.com"; // DO এর endpoint
// accessKeyId: "DO00UEML8FLHCBP94G6M", // তোমার DO Access Key
// secretAccessKey: "yMPeWzDhxgAL81luOgSE/Hzx+n0IabVbYJqAwSIxYS0", // তোমার DO Secret Key
// const SpaceName = "fruit-snacks";
// const Location = `https://${SpaceName}.${region}.cdn.digitaloceanspaces.com/${Key}`;

const region = process.env.S3_REGION!;
const endpoint = process.env.S3_ENDPOINT!;
const s3 = new S3Client({
  region,
  endpoint,
  forcePathStyle: true,
  credentials: {
    // accessKeyId: "DO00UEML8FLHCBP94G6M", // তোমার DO Access Key
    // secretAccessKey: "yMPeWzDhxgAL81luOgSE/Hzx+n0IabVbYJqAwSIxYS0", // তোমার DO Secret Key
    accessKeyId: process.env.S3_ACCESS_KEY!,
    secretAccessKey: process.env.S3_SECRET_KEY!,
  },
});

// তোমার Space name
// const SpaceName = "fruit-snacks";
const SpaceName = process.env.S3_BUCKET!;
// ================= Multer Config ===================
const storage = multer.diskStorage({
  destination: "uploads/",
  filename: function (req, file, cb) {
    const uniqueSuffix = uuid.v4();
    cb(null, uniqueSuffix + "-" + file?.originalname);
  },
});

const ImageUpload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    cb(null, true);
  },
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB limit
  },
});

// ================= Content-Type Checker ===================
const getContentType = (filename: string) => {
  const extension = path.extname(filename).toLowerCase();
  switch (extension) {
    // Image types
    case ".webp":
      return "image/webp";
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

    // Uppercase versions
    case ".WEBP":
      return "image/webp";
    case ".PNG":
      return "image/png";
    case ".JPG":
      return "image/jpeg";
    case ".JPEG":
      return "image/jpeg";
    case ".GIF":
      return "image/gif";
    case ".MP4":
      return "video/mp4";
    case ".MOV":
      return "video/quicktime";
    case ".AVI":
      return "video/x-msvideo";
    case ".WEBM":
      return "video/webm";
    case ".PDF":
      return "application/pdf";

    default:
      return "application/octet-stream";
  }
};

// ================= Upload Image to DigitalOcean Spaces ===================
const uploadToSpaces = async (file: any) => {
  const fileStream = fs.createReadStream(file.path);
  const contentType = getContentType(file.filename);

  const uploadParams = {
    Bucket: SpaceName,
    Key: `fruit_snacks_images/${file.filename}`, // DO তে ফোল্ডার + filename
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
  uploadToSpaces,
  uploadFilesInChunks,
  deleteFromSpaces, // এই ফাংশন এখন যেকোন ফাইল ডিলিট করতে পারবে
  VideoUploader,
  VideoUpload,
};

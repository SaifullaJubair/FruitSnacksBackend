import bwipjs from "bwip-js";
import QRCode from "qrcode";
import {
  ObjectCannedACL,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import ApiError from "../errors/ApiError";

const region = process.env.S3_REGION!;
const endpoint = process.env.S3_ENDPOINT!;
const SpaceName = process.env.S3_BUCKET!;
const s3 = new S3Client({
  region,
  endpoint,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY!,
    secretAccessKey: process.env.S3_SECRET_KEY!,
  },
});

const buildPublicUrl = (key: string) => {
  const encodedKey = key.split("/").map(encodeURIComponent).join("/");
  return `${process.env.S3_PUBLIC_URL}:${process.env.S3_BUCKET}/${encodedKey}`;
};

const uploadBufferToS3 = async (
  buffer: Buffer,
  key: string,
  contentType: string,
) => {
  const params = {
    Bucket: SpaceName,
    Key: key,
    Body: buffer,
    ACL: "public-read" as ObjectCannedACL,
    ContentType: contentType,
  };
  const data = await s3.send(new PutObjectCommand(params));
  if (data?.$metadata?.httpStatusCode !== 200) {
    throw new ApiError(400, "Code image upload failed");
  }
  return { Location: buildPublicUrl(key), Key: key };
};

const bwipFormatMap: Record<string, string> = {
  CODE128: "code128",
  EAN13: "ean13",
  UPC: "upca",
  ITF14: "itf14",
  CUSTOM: "code128",
};

export const renderBarcodeImage = async (
  text: string,
  format: string = "CODE128",
) => {
  const bcid = bwipFormatMap[format] || "code128";
  const png: Buffer = await bwipjs.toBuffer({
    bcid,
    text,
    scale: 3,
    height: 12,
    includetext: true,
    textxalign: "center",
  });
  const safe = text.replace(/[^A-Za-z0-9_-]/g, "_");
  const key = `fruit_snacks_codes/barcodes/${Date.now()}-${safe}.png`;
  return uploadBufferToS3(png, key, "image/png");
};

export const renderQrImage = async (payload: string, slug: string) => {
  const png: Buffer = await QRCode.toBuffer(payload, {
    errorCorrectionLevel: "M",
    width: 600,
    margin: 2,
  });
  const safe = (slug || "qr").replace(/[^A-Za-z0-9_-]/g, "_");
  const key = `fruit_snacks_codes/qrs/${Date.now()}-${safe}.png`;
  return uploadBufferToS3(png, key, "image/png");
};

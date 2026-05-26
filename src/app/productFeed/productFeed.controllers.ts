/**
 * productFeed.controllers.ts — Phase G4.
 *
 * Public XML feed endpoint compatible with Facebook Catalog + Google Merchant
 * Center. Both accept the same RSS 2.0 + `g:` namespace shape. We stream
 * active products only and resolve the image / availability / price fields
 * the way the merchant aggregators expect.
 *
 * Endpoint: GET /api/v1/product-feed/feed.xml
 */

import { Request, RequestHandler, Response, NextFunction } from "express";
import ProductModel from "../product/product.model";
import SettingModel from "../setting/setting.model";

const escapeXml = (s: any): string =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const cdata = (s: any): string =>
  `<![CDATA[${String(s ?? "").replace(/\]\]>/g, "]]]]><![CDATA[>")}]]>`;

export const productFeedXml: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<any> => {
  try {
    const setting: any = await SettingModel.findOne({}).lean();
    const siteUrl =
      process.env.FRONTEND_PUBLIC_URL ||
      process.env.SITE_URL ||
      "https://fruitsnacksbd.com";
    const siteTitle = setting?.title || process.env.SITE_TITLE || "FruitSnacks";
    const currency = setting?.currency_code || "BDT";

    // Stream-light: take active in-stock products in batches via .lean()
    const products: any[] = await ProductModel.find({ product_status: "active" })
      .select(
        "product_name product_slug description short_description main_image " +
          "product_price product_discount_price product_quantity brand_id " +
          "condition video_link product_weight_grams",
      )
      .populate({ path: "brand_id", model: "brands", select: "brand_name" })
      .lean();

    const items = products
      .map((p) => {
        const link = `${siteUrl}/products/${p.product_slug}`;
        const finalPrice =
          typeof p.product_discount_price === "number" &&
          p.product_discount_price > 0
            ? p.product_discount_price
            : p.product_price;
        const availability =
          (p.product_quantity ?? 0) > 0 ? "in stock" : "out of stock";
        const brand = (p.brand_id as any)?.brand_name || siteTitle;
        const desc =
          p.short_description || (p.description || "").replace(/<[^>]+>/g, "");

        return `
    <item>
      <g:id>${escapeXml(p._id)}</g:id>
      <title>${cdata(p.product_name)}</title>
      <description>${cdata(desc)}</description>
      <link>${escapeXml(link)}</link>
      <g:image_link>${escapeXml(p.main_image || "")}</g:image_link>
      <g:availability>${availability}</g:availability>
      <g:price>${Number(p.product_price) || 0}.00 ${currency}</g:price>
      ${
        typeof p.product_discount_price === "number" &&
        p.product_discount_price > 0
          ? `<g:sale_price>${p.product_discount_price}.00 ${currency}</g:sale_price>`
          : ""
      }
      <g:condition>${escapeXml(p.condition || "new")}</g:condition>
      <g:brand>${cdata(brand)}</g:brand>
      ${
        p.product_weight_grams
          ? `<g:shipping_weight>${p.product_weight_grams} g</g:shipping_weight>`
          : ""
      }
    </item>`;
      })
      .join("");

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>${cdata(siteTitle)}</title>
    <link>${escapeXml(siteUrl)}</link>
    <description>${cdata(siteTitle)} product feed</description>${items}
  </channel>
</rss>`;

    res.set("Content-Type", "application/xml; charset=utf-8");
    res.set("Cache-Control", "public, max-age=900"); // 15 min CDN-friendly
    return res.send(xml);
  } catch (e) {
    next(e);
  }
};

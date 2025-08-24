import CampaignModel from "../campaign/campaign.model";
import CouponModel from "../coupon/coupon.model";
import ProductModel from "../product/product.model";
import VariationModel from "../variation/variation.model";

export const validateOrder = async (orderData: any) => {
  const {
    sub_total_amount,
    shipping_cost,
    grand_total_amount,
    discount_amount,
    coupon_id,
    order_products,
  } = orderData;
  let failedProducts: any[] = [];
  let successProducts: any[] = [];

  for (const orderProduct of order_products) {
    const { product_id, variation_id, campaign_id } = orderProduct;
    const product_unit_price = orderProduct?.product_unit_final_price;

    const product: any = await ProductModel.findById(product_id);
    if (!product) {
      failedProducts?.push({
        product_id,
        variation_id,
        reason: "Product not found",
      });
      continue;
    }

    let productVariation;
    // ভ্যারিয়েশন প্রোডাক্ট যাচাই
    if (product?.is_variation && variation_id) {
      productVariation = await VariationModel.findOne({
        _id: variation_id,
        product_id,
      });
    }

    let productCampaign;
    let productCampaignPrice;
    // ক্যাম্পেইন যাচাই
    if (campaign_id) {
      productCampaign = await CampaignModel.findById(campaign_id);
      const campaignProduct = productCampaign?.campaign_products?.find(
        (cp) => String(cp?.campaign_product_id) === String(product_id)
      );
      if (campaignProduct) {
        productCampaignPrice = campaignProduct?.campaign_product_price;
      }
    }

    let coupon: any;

    // কুপন যাচাই
    if (coupon_id) {
      coupon = await CouponModel.findById(coupon_id);
      if (!coupon) {
        failedProducts?.push({
          product_id,
          coupon_id,
          reason: "Coupon not found",
          variation_id,
        });
        continue;
      }

      // কুপনের ধরন অনুযায়ী যাচাই
      if (coupon && coupon?.coupon_product_type === "specific") {
        if (coupon?.coupon_type === "percent") {
          const discountPrice = Math.round(
            (productCampaignPrice
              ? productCampaignPrice
              : productVariation
              ? productVariation?.variation_discount_price
                ? productVariation?.variation_discount_price
                : productVariation?.variation_price
              : (product?.product_discount_price
                  ? product?.product_discount_price
                  : product?.product_price) * coupon?.coupon_amount) / 100
          );
          if (discountPrice > coupon?.coupon_max_amount) {
            if (
              productCampaignPrice
                ? productCampaignPrice
                : productVariation
                ? productVariation?.variation_discount_price
                  ? productVariation?.variation_discount_price
                  : productVariation?.variation_price
                : (product?.product_discount_price
                    ? product?.product_discount_price
                    : product?.product_price) -
                    coupon?.coupon_max_amount !==
                  product_unit_price
            ) {
              failedProducts?.push({
                product_id,
                coupon_id,
                reason: "Coupon percent discount price mismatch",
                variation_id,
              });
              continue;
            } else {
              successProducts?.push({
                product_id,
                coupon_id,
                reason: "Coupon percent discount price mismatch",
                variation_id,
              });
            }
          } else if (
            productCampaignPrice
              ? productCampaignPrice
              : productVariation
              ? productVariation?.variation_price
              : (product?.product_discount_price
                  ? product?.product_discount_price
                  : product?.product_price) -
                  discountPrice !==
                product_unit_price
          ) {
            failedProducts?.push({
              product_id,
              coupon_id,
              reason: "Coupon percent discount price mismatch",
              variation_id,
            });
            continue;
          }
        } else if (coupon?.coupon_type === "fixed") {
          if (
            coupon?.coupon_specific_product?.some(
              (cp: any) => cp?.product_id?.toString() === product_id?.toString()
            )
          ) {
            // Proceed with further validation only if the product_id is in coupon_specific_product
            if (
              (productCampaignPrice
                ? productCampaignPrice
                : productVariation
                ? productVariation?.variation_discount_price
                  ? productVariation?.variation_discount_price
                  : productVariation?.variation_price
                : product?.product_discount_price
                ? product?.product_discount_price
                : product?.product_price) -
                coupon?.coupon_amount !==
              product_unit_price
            ) {
              failedProducts?.push({
                product_id,
                coupon_id,
                reason: "Coupon fixed discount price mismatch",
                variation_id,
              });
              continue;
            } else {
              successProducts?.push({
                product_id,
                coupon_id,
                reason: "Coupon fixed discount price mismatch",
                variation_id,
              });
            }
          }
        }
      }
    }

    // ক্যাম্পেইন যাচাই
    if (campaign_id) {
      const campaignProduct = productCampaign?.campaign_products?.find(
        (cp) => String(cp?.campaign_product_id) === String(product_id)
      );
      if (campaignProduct?.campaign_product_price !== product_unit_price) {
        if (
          successProducts?.find(
            (cp: any) => String(cp?.product_id) === String(product_id)
          )
        ) {
          continue;
        }
        failedProducts?.push({
          product_id,
          campaign_id,
          reason: "Campaign product price mismatch",
          variation_id,
        });
        continue;
      } else {
        successProducts?.push({
          product_id,
          campaign_id,
          reason: "Campaign product price mismatch",
          variation_id,
        });
      }
    }

    // ভ্যারিয়েশন প্রোডাক্ট যাচাই
    if (product?.is_variation && variation_id) {
      const variation = await VariationModel.findOne({
        _id: variation_id,
        product_id,
      });
      if (
        (variation?.variation_discount_price
          ? variation?.variation_discount_price
          : variation?.variation_price) !== product_unit_price
      ) {
        if (
          successProducts?.find(
            (cp: any) =>
              String(cp?.product_id) === String(product_id) &&
              String(cp?.variation_id) === String(variation_id)
          )
        ) {
          continue;
        }
        failedProducts?.push({
          product_id,
          variation_id,
          reason: "Variation price mismatch",
        });
        continue;
      }
    } else if (
      (product?.product_discount_price
        ? product?.product_discount_price
        : product?.product_price) !== product_unit_price &&
      !campaign_id
    ) {
      if (
        successProducts?.find(
          (cp: any) => String(cp?.product_id) === String(product_id)
        )
      ) {
        continue;
      }
      failedProducts?.push({
        product_id,
        reason: "Product price mismatch",
        variation_id,
      });
      continue;
    }
  }

  // সকল শপের মিলে গ্র্যান্ড টোটাল যাচাই
  const allShopGrandTotal = order_products?.reduce(
    (acc: any, shop: any) => acc + shop?.shop?.product_grand_total_price,
    0
  );

  if (allShopGrandTotal !== sub_total_amount - discount_amount) {
    failedProducts?.push({ reason: "Overall subtotal mismatch" });
  }

  if (allShopGrandTotal + shipping_cost !== grand_total_amount) {
    failedProducts?.push({ reason: "Overall grand total mismatch" });
  }

  if (failedProducts?.length === 0) {
    return [];
  } else {
    return failedProducts;
  }
};

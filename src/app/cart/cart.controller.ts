import { NextFunction, Request, RequestHandler, Response } from "express";
import httpStatus from "http-status";
import sendResponse from "../../shared/sendResponse";
import ApiError from "../../errors/ApiError";
import {
  clearCartService,
  getCartByUserIdService,
  syncCartService,
  updateCartService,
} from "./cart.services";

// GET /cart — user এর cart আনো
export const getCart: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const user_id = (req as any).user?.id;
    if (!user_id) throw new ApiError(401, "Unauthorized");

    const cart = await getCartByUserIdService(user_id);

    // cart_products এখন product_slug সহ আসে (slug-enriched by service)
    return sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Cart found successfully",
      data: (cart as any)?.cart_products || [],
    });
  } catch (error) {
    next(error);
  }
};

// POST /cart/sync — login এর পরে localStorage cart DB তে sync করো
export const syncCart: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const user_id = (req as any).user?.id;
    if (!user_id) throw new ApiError(401, "Unauthorized");

    const { products } = req.body;
    if (!Array.isArray(products)) {
      throw new ApiError(400, "Products must be an array");
    }

    // Validate করো
    const validProducts = products
      .filter((p) => p?.product_id && p?.quantity > 0)
      .map((p) => ({
        product_id: p.product_id,
        variation_id: p.variation_id || null,
        quantity: parseInt(p.quantity) || 1,
      }));

    const cart = await syncCartService(user_id, validProducts);

    return sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Cart synced successfully",
      data: cart?.cart_products || [],
    });
  } catch (error) {
    next(error);
  }
};

// PUT /cart — পুরো cart update করো (add/remove/quantity change)
export const updateCart: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const user_id = (req as any).user?.id;
    if (!user_id) throw new ApiError(401, "Unauthorized");

    const { products } = req.body;
    if (!Array.isArray(products)) {
      throw new ApiError(400, "Products must be an array");
    }

    const validProducts = products
      .filter((p) => p?.product_id && p?.quantity > 0)
      .map((p) => ({
        product_id: p.product_id,
        variation_id: p.variation_id || null,
        quantity: parseInt(p.quantity) || 1,
      }));

    const cart = await updateCartService(user_id, validProducts);

    return sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Cart updated successfully",
      data: cart?.cart_products || [],
    });
  } catch (error) {
    next(error);
  }
};

// DELETE /cart — cart clear করো (order complete হলে)
export const clearCart: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const user_id = (req as any).user?.id;
    if (!user_id) throw new ApiError(401, "Unauthorized");

    await clearCartService(user_id);

    return sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Cart cleared successfully",
      data: [],
    });
  } catch (error) {
    next(error);
  }
};

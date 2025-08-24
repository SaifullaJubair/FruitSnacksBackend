import { NextFunction, Request, RequestHandler, Response } from "express";
import sendResponse from "../../shared/sendResponse";
import ApiError from "../../errors/ApiError";
import { IOrderInterface, orderSearchableField } from "./order.interface";
import httpStatus from "http-status";
import {
  getACustomerAllOrderServices,
  getAOrderWithOrderProductsServices,
  getDashboardOrderServices,
  getOrderTrackingInfoService,
  postOrderServices,
  updateOrderServices,
} from "./order.service";
import OrderProductModel from "../orderProducts/orderProduct.model";
import mongoose from "mongoose";
import OrderModel from "./order.model";
import CouponUsedModel from "../coupon/coupon_used/coupon.used.model";
import { createCouponUsedCustomer } from "../coupon/coupon_used/coupon.used.services";
import CouponModel from "../coupon/coupon.model";
import { IUserInterface } from "../user/user.interface";
import { postSingleOrderUserServices } from "../user/user.services";
import UserModel from "../user/user.model";
import ProductModel from "../product/product.model";
import VariationModel from "../variation/variation.model";
const bcrypt = require("bcryptjs");
const saltRounds = 10;

// create a invoice
export const generateInvoiceId = async () => {
  let isUnique = false;
  let uniqueInvoiceId;

  while (!isUnique) {
    // Generate a random alphanumeric string of length 6
    uniqueInvoiceId = Array.from({ length: 6 }, () =>
      "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789".charAt(
        Math.floor(Math.random() * 36) // Use 36 characters: A-Z and 0-9
      )
    ).join("");

    // Check if the generated invoice_id is unique in the database
    const existingOrder = await OrderModel.findOne({
      invoice_id: uniqueInvoiceId,
    });

    // If no existing order found, mark the invoice_id as unique
    if (!existingOrder) {
      isUnique = true;
    }
  }

  return uniqueInvoiceId;
};
// post order
export const postOrder: any = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const requestData = req.body;

    if (requestData?.need_user_create == true) {
      try {
        const userCheck: any = await UserModel.findOne({
          user_phone: requestData?.customer_phone,
        }).session(session);

        if (userCheck) {
          requestData.customer_id = userCheck?._id?.toString();
          // throw new ApiError(400, "Already Added This Number Please Login using this Number and placed order or use another Number !");
        } else {
          const userCreateData: any = {
            user_name: requestData?.customer_name,
            user_phone: requestData?.customer_phone,
            user_country: requestData?.billing_country,
            user_division: requestData?.billing_state,
            user_district: requestData?.billing_city,
            user_address: requestData?.billing_address,
            user_status: "active",
            wallet_amount: 0,
          };

          let hash;
          if (requestData?.user_password) {
            // Hash the password and wait for it to complete
            hash = await new Promise<string>((resolve, reject) => {
              bcrypt.hash(
                requestData.user_password,
                saltRounds,
                (err: any, hash: any) => {
                  if (err) reject(err);
                  else resolve(hash);
                }
              );
            });
          }

          const data: any = {
            ...userCreateData,
          };

          if (hash) {
            data.user_password = hash;
          }

          // Create the user within the transaction
          const result: IUserInterface | {} | any =
            await postSingleOrderUserServices(data, session);

          if (!result) {
            throw new ApiError(400, "User Added Failed !");
          }
          requestData.customer_id = result?._id?.toString();
        }
      } catch (error) {
        next(error);
      }
    }

    const invoice_id: any = await generateInvoiceId();
    requestData.invoice_id = invoice_id;
    const result: IOrderInterface | {} | any = await postOrderServices(
      requestData,
      session
    );
    if (!result) throw new ApiError(400, "Order Create Failed !");
    // Use for...of instead of map to await each operation
    for (const productDetails of requestData?.order_products || []) {
      const sendData = {
        order_id: result?._id,
        invoice_id: invoice_id,
        product_id: productDetails?.product_id,
        variation_id: productDetails?.variation_id,
        product_unit_price: productDetails?.product_unit_price,
        product_unit_final_price: productDetails?.product_unit_final_price,
        product_quantity: productDetails?.product_quantity,
        product_grand_total_price: productDetails?.product_grand_total_price,
        campaign_id: productDetails?.campaign_id,
        product_main_price: productDetails?.product_main_price,
        product_main_discount_price:
          productDetails?.product_main_discount_price,
        customer_id: requestData?.customer_id,
      };

      const orderDetails = await OrderProductModel.create([sendData], {
        session,
      });
      if (!orderDetails) {
        throw new ApiError(400, "Order Create Failed!");
      }
    }

    if (requestData?.coupon_id) {
      const checkCouponIsUsed: IOrderInterface | null | any =
        await CouponUsedModel.findOne({
          coupon_id: requestData?.coupon_id,
          customer_id: requestData?.customer_id,
        }).session(session);

      if (!checkCouponIsUsed) {
        const couponSendData = {
          coupon_id: new mongoose.Types.ObjectId(
            requestData?.coupon_id.toString()
          ),
          customer_id: new mongoose.Types.ObjectId(
            requestData?.customer_id.toString()
          ),
          used: 1,
        };
        const createCouponUsed = await createCouponUsedCustomer(
          couponSendData,
          session
        );
        if (!createCouponUsed) {
          throw new ApiError(400, "Order Create Failed!");
        }
      } else {
        const couponUsedUpdate = await CouponUsedModel.updateOne(
          {
            coupon_id: requestData?.coupon_id,
            customer_id: requestData?.customer_id,
          },
          {
            $inc: {
              used: +1,
            },
          },
          {
            session,
            runValidators: true,
          }
        );
        if (couponUsedUpdate.modifiedCount === 0) {
          throw new ApiError(400, "Order Create Failed!");
        }
      }

      const mainCouponUpdate = await CouponModel.updateOne(
        {
          _id: requestData?.coupon_id,
        },
        {
          $inc: {
            coupon_available: -1,
          },
        },
        {
          session,
          runValidators: true,
        }
      );
      if (mainCouponUpdate.modifiedCount === 0) {
        throw new ApiError(400, "Order Create Failed!");
      }
    }

    const userUpdateData = {
      user_country: requestData?.billing_country,
      user_division: requestData?.billing_city,
      user_district: requestData?.billing_state,
      user_address: requestData?.billing_address,
    };

    const userUpdate = await UserModel.updateOne(
      {
        _id: requestData?.customer_id,
      },
      {
        $set: userUpdateData,
      },
      {
        session,
        runValidators: true,
      }
    );
    if (userUpdate.modifiedCount === 0) {
      throw new ApiError(400, "Order Create Failed!");
    }

    // Commit transaction
    await session.commitTransaction();
    session.endSession();
    return sendResponse<IOrderInterface>(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Order Create Successfully !",
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    next(error);
  }
};

// post single order
export const postSingleOrder: any = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const requestData = req.body;

    if (requestData?.need_user_create == true) {
      try {
        const userCheck: any = await UserModel.findOne({
          user_phone: requestData?.customer_phone,
        }).session(session);

        if (userCheck) {
          requestData.customer_id = userCheck?._id?.toString();
          // throw new ApiError(400, "Already Added This Number Please Login using this Number and placed order or use another Number !");
        } else {
          const userCreateData: any = {
            user_name: requestData?.user_name,
            user_phone: requestData?.customer_phone,
            user_country: requestData?.billing_country,
            user_division: requestData?.billing_state,
            user_district: requestData?.billing_city,
            user_address: requestData?.billing_address,
            user_status: "active",
            wallet_amount: 0,
          };

          let hash;
          if (requestData?.user_password) {
            // Hash the password and wait for it to complete
            hash = await new Promise<string>((resolve, reject) => {
              bcrypt.hash(
                requestData.user_password,
                saltRounds,
                (err: any, hash: any) => {
                  if (err) reject(err);
                  else resolve(hash);
                }
              );
            });
          }

          const data: any = {
            ...userCreateData,
          };

          if (hash) {
            data.user_password = hash;
          }

          // Create the user within the transaction
          const result: IUserInterface | {} | any =
            await postSingleOrderUserServices(data, session);

          if (!result) {
            throw new ApiError(400, "User Added Failed !");
          }
          requestData.customer_id = result?._id?.toString();
        }
      } catch (error) {
        next(error);
      }
    }

    const invoice_id: any = await generateInvoiceId();
    requestData.invoice_id = invoice_id;
    const result: IOrderInterface | {} | any = await postOrderServices(
      requestData,
      session
    );
    if (!result) throw new ApiError(400, "Order Create Failed !");
    // Use for...of instead of map to await each operation
    for (const productDetails of requestData?.order_products || []) {
      const sendData = {
        order_id: result?._id,
        invoice_id: invoice_id,
        product_id: productDetails?.product_id,
        variation_id: productDetails?.variation_id,
        product_unit_price: productDetails?.product_unit_price,
        product_unit_final_price: productDetails?.product_unit_final_price,
        product_quantity: productDetails?.product_quantity,
        product_grand_total_price: productDetails?.product_grand_total_price,
        campaign_id: productDetails?.campaign_id,
        product_main_price: productDetails?.product_main_price,
        product_main_discount_price:
          productDetails?.product_main_discount_price,
        customer_id: requestData?.customer_id,
      };

      const orderDetails = await OrderProductModel.create([sendData], {
        session,
      });
      if (!orderDetails) {
        throw new ApiError(400, "Order Create Failed!");
      }
    }

    if (requestData?.coupon_id) {
      const checkCouponIsUsed: IOrderInterface | null =
        await CouponUsedModel.findOne({
          coupon_id: requestData?.coupon_id,
          customer_id: requestData?.customer_id,
        });

      if (!checkCouponIsUsed) {
        const couponSendData = {
          coupon_id: new mongoose.Types.ObjectId(
            requestData?.coupon_id.toString()
          ),
          customer_id: new mongoose.Types.ObjectId(
            requestData?.customer_id.toString()
          ),
          used: 1,
        };
        const createCouponUsed = await createCouponUsedCustomer(
          couponSendData,
          session
        );
        if (!createCouponUsed) {
          throw new ApiError(400, "Order Create Failed!");
        }
      } else {
        const couponUsedUpdate = await CouponUsedModel.updateOne(
          {
            coupon_id: requestData?.coupon_id,
            customer_id: requestData?.customer_id,
          },
          {
            $inc: {
              used: +1,
            },
          },
          {
            session,
            runValidators: true,
          }
        );
        if (couponUsedUpdate.modifiedCount === 0) {
          throw new ApiError(400, "Order Create Failed!");
        }
      }

      const mainCouponUpdate = await CouponModel.updateOne(
        {
          _id: requestData?.coupon_id,
        },
        {
          $inc: {
            coupon_available: -1,
          },
        },
        {
          session,
          runValidators: true,
        }
      );
      if (mainCouponUpdate.modifiedCount === 0) {
        throw new ApiError(400, "Order Create Failed!");
      }
    }

    // Commit transaction
    await session.commitTransaction();
    session.endSession();
    return sendResponse<IOrderInterface>(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Order Create Successfully !",
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    next(error);
  }
};

// Order tracking
export const getOrderTrackingInfo = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<IOrderInterface | any> => {
  try {
    const { order_id } = req.body;
    if (!order_id) {
      throw new ApiError(400, "Must submit order id !");
    }
    const result: any = await getOrderTrackingInfoService(order_id);
    if (result) {
      return sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Order get successfully !",
        data: result,
      });
    } else {
      throw new ApiError(400, "Order found failed !");
    }
  } catch (error) {
    next(error);
  }
};

// get a Customer all order
export const getACustomerAllOrder: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<IOrderInterface | any> => {
  try {
    const { page, limit, searchTerm, customer_id }: any = req.query;
    const pageNumber = Number(page);
    const limitNumber = Number(limit);
    const skip = (pageNumber - 1) * limitNumber;
    if (!customer_id) {
      throw new ApiError(400, "Customer id is required");
    }
    const result: IOrderInterface[] | any = await getACustomerAllOrderServices(
      limitNumber,
      skip,
      searchTerm,
      customer_id
    );
    const andCondition = [];
    if (searchTerm) {
      andCondition.push({
        $or: orderSearchableField?.map((field) => ({
          [field]: {
            $regex: searchTerm,
            $options: "i",
          },
        })),
      });
    }
    andCondition.push({ customer_id });
    const whereCondition =
      andCondition.length > 0 ? { $and: andCondition } : {};
    const total = await OrderModel.countDocuments(whereCondition);
    return sendResponse<IOrderInterface>(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Order Found Successfully !",
      data: result,
      totalData: total,
    });
  } catch (error: any) {
    next(error);
  }
};

// get Dashboard  order
export const getDashboardOrder: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<IOrderInterface | any> => {
  try {
    const { page, limit, searchTerm, order_status }: any = req.query;
    const pageNumber = Number(page);
    const limitNumber = Number(limit);
    const skip = (pageNumber - 1) * limitNumber;
    const result: IOrderInterface[] | any = await getDashboardOrderServices(
      limitNumber,
      skip,
      searchTerm,
      order_status
    );
    const andCondition = [];
    if (searchTerm) {
      andCondition.push({
        $or: orderSearchableField?.map((field) => ({
          [field]: {
            $regex: searchTerm,
            $options: "i",
          },
        })),
      });
    }
    if (
      order_status !== "" &&
      order_status !== undefined &&
      order_status !== null &&
      order_status !== "undefined" &&
      order_status !== "null"
    ) {
      andCondition.push({ order_status: order_status });
    }
    const whereCondition =
      andCondition.length > 0 ? { $and: andCondition } : {};
    const total = await OrderModel.countDocuments(whereCondition);
    return sendResponse<IOrderInterface>(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Order Found Successfully !",
      data: result,
      totalData: total,
    });
  } catch (error: any) {
    next(error);
  }
};

// get a order details with order products
export const getAOrderWithOrderProducts: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<IOrderInterface | any> => {
  try {
    const { order_id }: any = req.params;
    const result: IOrderInterface | any =
      await getAOrderWithOrderProductsServices(order_id);
    return sendResponse<IOrderInterface>(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Order Found Successfully !",
      data: result,
    });
  } catch (error: any) {
    next(error);
  }
};

// Update A Order
export const updateOrder: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<IOrderInterface | any> => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const requestData = req.body;
    if (requestData?.order_status === "shipped") {
      const response = await fetch(
        "https://api-hermes.pathao.com/aladdin/api/v1/issue-token",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            client_id: "8mepZDpbMy", // Replace with actual client_id
            client_secret: "GaE4FmJo3SEHSN04r2owFOdID4H9u6SPO9kQJYKQ", // Replace with actual client_secret
            grant_type: "password",
            username: "mumufariha21@gmail.com", // Replace with your email
            password: "Aa95580", // Replace with your password
          }),
        }
      );

      const tokenResult = await response.json();
      // console.log(tokenResult);

      let item_quantity = 0;
      for (const order_product of requestData?.order?.order_products) {
        item_quantity += order_product?.product_quantity;
      }

      const rawPhone = requestData?.order?.customer_id?.user_phone;
      const formattedPhone = rawPhone?.startsWith("+880")
        ? "0" + rawPhone.slice(4)
        : rawPhone;

      const data = {
        store_id: 22125, // Replace with actual store ID (number)
        merchant_order_id: requestData?.order?.invoice_id, // Replace with actual order ID (string)
        recipient_name: requestData?.order?.customer_id?.user_name,
        recipient_phone: formattedPhone, // Replace with actual phone number
        recipient_address: requestData?.order?.customer_id?.user_address,
        recipient_city: requestData?.order?.pathao_city_id, // Replace with actual city ID (number)
        recipient_zone: requestData?.order?.pathao_zone_id, // Replace with actual zone ID (number)
        delivery_type: 12,
        item_type: 2,
        item_quantity: item_quantity,
        item_weight: "1",
        amount_to_collect: requestData?.order?.grand_total_amount,
      };

      const createOrder = await fetch(
        "https://api-hermes.pathao.com/aladdin/api/v1/orders",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${tokenResult?.access_token}`, // Replace access_token with actual token
          },
          body: JSON.stringify(data),
        }
      );

      // Parse createOrder
      const orderResult = await createOrder.json();

      if (orderResult?.code !== 200 || orderResult?.type !== "success") {
        throw new ApiError(400, "Order Update Failed !");
      }

      const updateOrderData: any = {
        _id: requestData?._id,
        order_status: requestData?.order_status,
        order_updated_by: requestData?.order_updated_by,
        consignment_id: orderResult?.data?.consignment_id,
        delivery_fee: orderResult?.data?.delivery_fee,
      };

      // handle order status
      const result: IOrderInterface | any = await updateOrderServices(
        updateOrderData,
        updateOrderData?._id,
        session
      );

      if (result?.modifiedCount == 0) {
        throw new ApiError(400, "Order Update Failed !");
      }

      // Commit transaction
      await session.commitTransaction();
      session.endSession();
      return sendResponse<IOrderInterface>(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Order Update Successfully !",
      });
    }

    // handle order status

    const result: IOrderInterface | any = await updateOrderServices(
      requestData,
      requestData?._id,
      session
    );

    if (result?.modifiedCount == 0) {
      throw new ApiError(400, "Order Update Failed !");
    }

    if (requestData?.order_status == "delivered") {
      const { order_products } = requestData;
      if (order_products?.length > 0) {
        for (const order_product of order_products) {
          if (!order_product?.variation_id) {
            const productQuantityUpdate = await ProductModel.updateOne(
              {
                _id: order_product?.product_id,
              },
              {
                $inc: {
                  product_quantity: -order_product?.product_quantity,
                },
              },
              {
                session,
                runValidators: true,
              }
            );
            if (productQuantityUpdate.modifiedCount === 0) {
              throw new ApiError(400, "Order Create Failed!");
            }
          } else {
            const productVariationQuantityUpdate =
              await VariationModel.updateOne(
                {
                  _id: order_product?.variation_id,
                  product_id: order_product?.product_id,
                },
                {
                  $inc: {
                    variation_quantity: -order_product?.product_quantity,
                  },
                },
                {
                  session,
                  runValidators: true,
                }
              );
            if (productVariationQuantityUpdate.modifiedCount === 0) {
              throw new ApiError(400, "Order Create Failed!");
            }
          }
        }
      }
    }

    // Commit transaction
    await session.commitTransaction();
    session.endSession();
    return sendResponse<IOrderInterface>(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Order Update Successfully !",
    });
  } catch (error: any) {
    await session.abortTransaction();
    session.endSession();
    next(error);
  }
};

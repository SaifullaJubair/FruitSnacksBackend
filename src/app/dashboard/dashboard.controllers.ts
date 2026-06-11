import { NextFunction, Request, RequestHandler, Response } from "express";
import sendResponse from "../../shared/sendResponse";
import httpStatus from "http-status";
import OrderModel from "../order/order.model";
import ReviewModel from "../review/review.model";
import UserModel from "../user/user.model";
import ProductModel from "../product/product.model";
import AdminModel from "../adminRegLog/admin.model";
import CategoryModel from "../category/category.model";
import BrandModel from "../brand/brand.model";
import OrderProductModel from "../orderProducts/orderProduct.model";

// D9: BST (Asia/Dhaka = UTC+6) start-of-day for "today" boundary
const getBstDayBoundaries = (daysBack: number): { start: Date; end: Date } => {
  const BST_OFFSET_MS = 6 * 60 * 60 * 1000;
  const nowUtc = Date.now();
  const nowBst = nowUtc + BST_OFFSET_MS;
  // Midnight of today in BST (as a UTC timestamp)
  const todayBstMidnightUtc =
    Math.floor(nowBst / 86_400_000) * 86_400_000 - BST_OFFSET_MS;
  const start = new Date(todayBstMidnightUtc - (daysBack - 1) * 86_400_000);
  const end = new Date(todayBstMidnightUtc + 86_400_000); // end of today BST
  return { start, end };
};

// HIGH 4: revenue excludes cancelled + returned orders
const REVENUE_STATUS_EXCLUDE = ["cancel", "return"];

// get dashboard summary cards
export const findDashboardDataServices: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const [
      totalOrder,
      totalUser,
      totalProduct,
      totalStaff,
      totalReview,
      totalCategory,
      totalBrand,
    ] = await Promise.all([
      OrderModel.countDocuments({}),
      UserModel.countDocuments({}),
      ProductModel.countDocuments({}),
      AdminModel.countDocuments({}),
      ReviewModel.countDocuments({}),
      CategoryModel.countDocuments({}),
      BrandModel.countDocuments({}),
    ]);

    const sendData = [
      { url_link: "/order", title: "Total Orders", number: totalOrder },
      { url_link: "/customer", title: "Total Customers", number: totalUser },
      {
        url_link: "/product/product-list",
        title: "Total Products",
        number: totalProduct,
      },
      { url_link: "/all-staff", title: "Total Staffs", number: totalStaff },
      { url_link: "/review", title: "Total Reviews", number: totalReview },
      { url_link: "/category", title: "Total Categories", number: totalCategory },
      { url_link: "/brand-category", title: "Total Brands", number: totalBrand },
    ];

    return sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Dashboard Data successfully !",
      data: sendData,
    });
  } catch (error) {
    next(error);
  }
};

// E20 HIGH 3: top-selling per period via orderProducts + $lookup to orders
// Aggregates orderProducts joined with orders to filter by date range and
// exclude cancelled/returned. Returns top 5 products by qty sold.
export const findTopSellingWidgetController: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const days = Math.min(Number(req.query.days) || 7, 365);
    const { start, end } = getBstDayBoundaries(days);

    const result = await OrderProductModel.aggregate([
      {
        $lookup: {
          from: "orders",
          localField: "order_id",
          foreignField: "_id",
          as: "order",
        },
      },
      { $unwind: "$order" },
      {
        $match: {
          "order.createdAt": { $gte: start, $lt: end },
          "order.order_status": { $nin: REVENUE_STATUS_EXCLUDE },
        },
      },
      {
        $group: {
          _id: "$product_id",
          total_qty: { $sum: "$product_quantity" },
          total_revenue: { $sum: "$product_grand_total_price" },
        },
      },
      { $sort: { total_qty: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "_id",
          as: "product",
        },
      },
      { $unwind: "$product" },
      {
        $project: {
          _id: 1,
          total_qty: 1,
          total_revenue: 1,
          product_name: "$product.product_name",
          product_thumbnail: "$product.main_image",
        },
      },
    ]);

    return sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Top selling data fetched",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// E20: orders grouped by status for the selected period
// HIGH 4 note: all statuses shown in the chart (including cancel/return)
// so admin can see cancellation trends — only revenue excludes them.
export const findOrdersByStatusWidgetController: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const days = Math.min(Number(req.query.days) || 7, 365);
    const { start, end } = getBstDayBoundaries(days);

    // Orders-by-status count + revenue (excl. cancel/return) in one pass
    const [statusCounts, revenueAgg] = await Promise.all([
      OrderModel.aggregate([
        { $match: { createdAt: { $gte: start, $lt: end } } },
        { $group: { _id: "$order_status", count: { $sum: 1 } } },
        { $project: { name: "$_id", value: "$count", _id: 0 } },
        { $sort: { name: 1 } },
      ]),
      OrderModel.aggregate([
        {
          $match: {
            createdAt: { $gte: start, $lt: end },
            order_status: { $nin: REVENUE_STATUS_EXCLUDE },
          },
        },
        {
          $group: {
            _id: null,
            total_revenue: { $sum: "$grand_total_amount" },
            total_orders: { $sum: 1 },
          },
        },
      ]),
    ]);

    return sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Orders by status data fetched",
      data: {
        statusCounts,
        total_revenue: revenueAgg[0]?.total_revenue ?? 0,
        total_orders: revenueAgg[0]?.total_orders ?? 0,
        period_days: days,
      },
    });
  } catch (error) {
    next(error);
  }
};

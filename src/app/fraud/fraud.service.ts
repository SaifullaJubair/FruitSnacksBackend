import axios from "axios";
import OrderModel from "../order/order.model";

const FRAUDBD_API_KEY = process.env.FRAUDBD_API_KEY || "";
const FRAUDBD_BASE_URL = "https://fraudbd.com";

// ── FraudBD API call ─────────────────────────────────────────
const checkFraudBD = async (phone_number: string) => {
  try {
    const response = await axios.post(
      `${FRAUDBD_BASE_URL}/api/check-courier-info`,
      { phone_number },
      {
        headers: {
          "Content-Type": "application/json",
          api_key: FRAUDBD_API_KEY,
        },
      },
    );
    return response.data;
  } catch (error: any) {
    console.error("FraudBD API error:", error.response?.data);
    return null;
  }
};

// ── আমাদের DB থেকে customer history ─────────────────────────
const getCustomerHistory = async (phone_number: string) => {
  // phone number different format এ থাকতে পারে
  // +8801XXXXXXXXX, 01XXXXXXXXX, 8801XXXXXXXXX
  const cleaned = phone_number.replace(/^\+?88/, "");
  const variants = [cleaned, `+88${cleaned}`, `88${cleaned}`];

  const orders = await OrderModel.find({
    customer_phone: { $in: variants },
  })
    .select(
      "invoice_id order_status courier_type grand_total_amount pathao_status steadfast_status createdAt",
    )
    .sort({ createdAt: -1 })
    .limit(20);

  const total = orders.length;
  const delivered = orders.filter(
    (o: any) => o.order_status === "delivered",
  ).length;
  const cancelled = orders.filter(
    (o: any) => o.order_status === "cancel",
  ).length;
  const returned = orders.filter(
    (o: any) => o.order_status === "return",
  ).length;
  const processing = orders.filter(
    (o: any) => o.order_status === "processing",
  ).length;
  const pending = orders.filter(
    (o: any) => o.order_status === "pending",
  ).length;

  const successRate = total > 0 ? Math.round((delivered / total) * 100) : 0;
  const cancelRate = total > 0 ? Math.round((cancelled / total) * 100) : 0;

  return {
    total,
    delivered,
    cancelled,
    returned,
    processing,
    pending,
    successRate,
    cancelRate,
    orders,
  };
};

// ── Risk level calculate ──────────────────────────────────────
const calculateRiskLevel = (
  fraudBDData: any,
  dbHistory: any,
): { level: string; color: string; reason: string } => {
  // FraudBD total summary
  const summary = fraudBDData?.data?.totalSummary;
  const cancelRate = summary?.cancelRate || 0;

  // DB history
  const dbCancelRate = dbHistory.cancelRate || 0;
  const dbReturned = dbHistory.returned || 0;

  // Pathao rating check
  const pathaoData = fraudBDData?.data?.Summaries?.Pathao;
  const pathaoRisk = pathaoData?.risk_level;

  if (pathaoRisk === "very_high" || cancelRate >= 50 || dbCancelRate >= 50) {
    return {
      level: "High Risk",
      color: "red",
      reason: "Cancel rate অনেক বেশি",
    };
  }

  if (
    pathaoRisk === "high" ||
    cancelRate >= 30 ||
    dbCancelRate >= 30 ||
    dbReturned >= 2
  ) {
    return {
      level: "Medium Risk",
      color: "orange",
      reason: "Cancel/Return history আছে",
    };
  }

  if (dbHistory.total === 0 && !summary?.total) {
    return {
      level: "New Customer",
      color: "blue",
      reason: "কোনো আগের order নেই",
    };
  }

  return { level: "Low Risk", color: "green", reason: "ভালো delivery history" };
};

// ── Main fraud check service ──────────────────────────────────
export const fraudCheckService = async (phone_number: string) => {
  // phone number clean করো
  const cleanedPhone = phone_number.replace(/^\+?88/, "").trim();

  if (!cleanedPhone.match(/^01[3-9]\d{8}$/)) {
    throw new Error("Invalid Bangladeshi phone number. Format: 01XXXXXXXXX");
  }

  // Parallel call — FraudBD + DB
  const [fraudBDResult, dbHistory] = await Promise.all([
    checkFraudBD(cleanedPhone),
    getCustomerHistory(phone_number),
  ]);

  const riskLevel = calculateRiskLevel(fraudBDResult, dbHistory);

  return {
    phone: cleanedPhone,
    riskLevel,
    fraudBD: fraudBDResult?.data || null,
    fraudBDStatus: fraudBDResult?.status || false,
    dbHistory,
  };
};

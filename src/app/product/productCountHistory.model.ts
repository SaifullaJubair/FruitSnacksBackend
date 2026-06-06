import { Schema, model } from "mongoose";

// Audit trail for admin-seeded sold_count / view_count changes.
// Each row = one PATCH /product/quick that touched sold_count or view_count.
// TTL: 90 days — old seed audit logs auto-expire.
const productCountHistorySchema = new Schema(
  {
    product_id: { type: Schema.Types.ObjectId, ref: "products", required: true, index: true },
    changed_by: { type: Schema.Types.ObjectId, ref: "admins" },
    changes: {
      type: Map,
      of: Schema.Types.Mixed,
    },
  },
  { timestamps: true },
);

productCountHistorySchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 });

const ProductCountHistoryModel = model("product_count_history", productCountHistorySchema);
export default ProductCountHistoryModel;

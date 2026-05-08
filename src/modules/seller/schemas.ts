import { z } from "zod";

export const createProductListingSchema = z.object({
  category_id: z.string().uuid(),
  title_tr: z.string().min(1).max(255),
  title_en: z.string().max(255).optional(),
  description_tr: z.string().optional(),
  description_en: z.string().optional(),
  merchant_sku: z.string().max(128).optional(),
  base_price: z.coerce.number().nonnegative(),
  currency: z.enum(["TRY", "USD"]).default("TRY"),
  stock_quantity: z.coerce.number().int().min(0).default(0),
  min_order_quantity: z.coerce.number().int().min(1).default(1),
  unit: z.string().min(1).max(50),
  lead_time_days: z.coerce.number().int().min(0).nullable().optional(),
});

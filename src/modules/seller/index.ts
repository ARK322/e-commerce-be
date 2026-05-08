import type { FastifyPluginAsync } from "fastify";
import type { Sql } from "../../db/client.js";
import { createProductListingSchema } from "./schemas.js";

async function getSellerProfileId(sql: Sql, userId: string): Promise<string | null> {
  const rows = await sql<{ id: string }[]>`
    SELECT id FROM seller_profiles WHERE user_id = ${userId} LIMIT 1
  `;
  return rows[0]?.id ?? null;
}

export const sellerRoutes: FastifyPluginAsync = async (app) => {
  app.post(
    "/seller/product-listings",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      if (request.user.role !== "seller") {
        return reply.code(403).send({ error: "forbidden" });
      }

      const parsed = createProductListingSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: "invalid_body", details: parsed.error.flatten() });
      }

      const sellerProfileId = await getSellerProfileId(app.sql, request.user.sub);
      if (!sellerProfileId) {
        return reply.code(403).send({ error: "seller_profile_missing" });
      }

      const b = parsed.data;

      const [row] = await app.sql<{ id: string }[]>`
        INSERT INTO product_listings (
          seller_profile_id,
          category_id,
          title_tr,
          title_en,
          description_tr,
          description_en,
          merchant_sku,
          base_price,
          currency,
          stock_quantity,
          min_order_quantity,
          unit,
          lead_time_days,
          listing_status
        )
        VALUES (
          ${sellerProfileId},
          ${b.category_id},
          ${b.title_tr},
          ${b.title_en ?? null},
          ${b.description_tr ?? null},
          ${b.description_en ?? null},
          ${b.merchant_sku ?? null},
          ${b.base_price},
          ${b.currency},
          ${b.stock_quantity},
          ${b.min_order_quantity},
          ${b.unit},
          ${b.lead_time_days ?? null},
          'draft'
        )
        RETURNING id
      `;

      return reply.code(201).send({ id: row.id });
    },
  );
};

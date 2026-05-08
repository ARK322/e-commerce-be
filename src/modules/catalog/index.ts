import type { FastifyPluginAsync } from "fastify";
import { paginationSchema, productListQuerySchema } from "./schemas.js";

export const catalogRoutes: FastifyPluginAsync = async (app) => {
  app.get("/catalog/product-listings", async (request, reply) => {
    const parsed = productListQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_query", details: parsed.error.flatten() });
    }

    const { page, limit, categoryId, q } = parsed.data;
    const offset = (page - 1) * limit;

    const searchTerm = q?.trim() || null;

    const countRows = await app.sql<{ count: string }[]>`
      SELECT COUNT(*)::text AS count
      FROM product_listings pl
      WHERE pl.listing_status = 'active'
        AND (${categoryId}::uuid IS NULL OR pl.category_id = ${categoryId ?? null})
        AND (
          COALESCE(${searchTerm}, '') = ''
          OR pl.search_vector @@ plainto_tsquery('simple', ${searchTerm})
        )
    `;
    const total = Number(countRows[0]?.count ?? 0);

    const rows = await app.sql<
      {
        id: string;
        seller_profile_id: string;
        category_id: string;
        title_tr: string;
        title_en: string | null;
        base_price: string;
        currency: string;
        available_quantity: number | null;
        min_order_quantity: number;
        unit: string;
        lead_time_days: number | null;
        created_at: Date;
      }[]
    >`
      SELECT
        pl.id,
        pl.seller_profile_id,
        pl.category_id,
        pl.title_tr,
        pl.title_en,
        pl.base_price::text,
        pl.currency::text,
        pl.available_quantity,
        pl.min_order_quantity,
        pl.unit,
        pl.lead_time_days,
        pl.created_at
      FROM product_listings pl
      WHERE pl.listing_status = 'active'
        AND (${categoryId}::uuid IS NULL OR pl.category_id = ${categoryId ?? null})
        AND (
          COALESCE(${searchTerm}, '') = ''
          OR pl.search_vector @@ plainto_tsquery('simple', ${searchTerm})
        )
      ORDER BY pl.visibility_score DESC, pl.created_at DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `;

    return {
      items: rows,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    };
  });

  app.get("/catalog/product-listings/:id", async (request, reply) => {
    const id = (request.params as { id: string }).id;
    const rows = await app.sql<
      {
        id: string;
        seller_profile_id: string;
        category_id: string;
        title_tr: string;
        title_en: string | null;
        description_tr: string | null;
        description_en: string | null;
        merchant_sku: string | null;
        base_price: string;
        currency: string;
        stock_quantity: number;
        stock_reserved: number;
        available_quantity: number | null;
        min_order_quantity: number;
        unit: string;
        lead_time_days: number | null;
        listing_status: string;
        created_at: Date;
      }[]
    >`
      SELECT
        id,
        seller_profile_id,
        category_id,
        title_tr,
        title_en,
        description_tr,
        description_en,
        merchant_sku,
        base_price::text,
        currency::text,
        stock_quantity,
        stock_reserved,
        available_quantity,
        min_order_quantity,
        unit,
        lead_time_days,
        listing_status::text,
        created_at
      FROM product_listings
      WHERE id = ${id}
        AND listing_status = 'active'
      LIMIT 1
    `;

    const listing = rows[0];
    if (!listing) {
      return reply.code(404).send({ error: "not_found" });
    }

    const media = await app.sql<
      { id: string; url: string; media_type: string; is_cover: boolean; sort_order: number }[]
    >`
      SELECT id, url, media_type::text, is_cover, sort_order
      FROM listing_media
      WHERE listing_type = 'product'
        AND product_listing_id = ${id}
      ORDER BY sort_order ASC, uploaded_at ASC
    `;

    return { listing, media };
  });

  app.get("/catalog/production-listings", async (request, reply) => {
    const parsed = productListQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_query", details: parsed.error.flatten() });
    }

    const { page, limit, categoryId, q } = parsed.data;
    const offset = (page - 1) * limit;
    const searchTerm = q?.trim() || null;

    const countRows = await app.sql<{ count: string }[]>`
      SELECT COUNT(*)::text AS count
      FROM production_listings pl
      WHERE pl.listing_status = 'active'
        AND (${categoryId}::uuid IS NULL OR pl.category_id = ${categoryId ?? null})
        AND (
          COALESCE(${searchTerm}, '') = ''
          OR pl.search_vector @@ plainto_tsquery('simple', ${searchTerm})
        )
    `;
    const total = Number(countRows[0]?.count ?? 0);

    const rows = await app.sql<
      {
        id: string;
        seller_profile_id: string;
        category_id: string;
        title_tr: string;
        title_en: string | null;
        estimated_price_min: string | null;
        estimated_price_max: string | null;
        currency: string;
        created_at: Date;
      }[]
    >`
      SELECT
        pl.id,
        pl.seller_profile_id,
        pl.category_id,
        pl.title_tr,
        pl.title_en,
        pl.estimated_price_min::text,
        pl.estimated_price_max::text,
        pl.currency::text,
        pl.created_at
      FROM production_listings pl
      WHERE pl.listing_status = 'active'
        AND (${categoryId}::uuid IS NULL OR pl.category_id = ${categoryId ?? null})
        AND (
          COALESCE(${searchTerm}, '') = ''
          OR pl.search_vector @@ plainto_tsquery('simple', ${searchTerm})
        )
      ORDER BY pl.visibility_score DESC, pl.created_at DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `;

    return {
      items: rows,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    };
  });

  app.get("/catalog/production-listings/:id", async (request, reply) => {
    const id = (request.params as { id: string }).id;
    const rows = await app.sql<
      {
        id: string;
        seller_profile_id: string;
        category_id: string;
        title_tr: string;
        title_en: string | null;
        description_tr: string | null;
        description_en: string | null;
        estimated_price_min: string | null;
        estimated_price_max: string | null;
        currency: string;
        min_order_quantity: number | null;
        unit: string | null;
        lead_time_days: number | null;
        listing_status: string;
        created_at: Date;
      }[]
    >`
      SELECT
        id,
        seller_profile_id,
        category_id,
        title_tr,
        title_en,
        description_tr,
        description_en,
        estimated_price_min::text,
        estimated_price_max::text,
        currency::text,
        min_order_quantity,
        unit,
        lead_time_days,
        listing_status::text,
        created_at
      FROM production_listings
      WHERE id = ${id}
        AND listing_status = 'active'
      LIMIT 1
    `;

    const listing = rows[0];
    if (!listing) {
      return reply.code(404).send({ error: "not_found" });
    }

    const media = await app.sql<
      { id: string; url: string; media_type: string; is_cover: boolean; sort_order: number }[]
    >`
      SELECT id, url, media_type::text, is_cover, sort_order
      FROM listing_media
      WHERE listing_type = 'production'
        AND production_listing_id = ${id}
      ORDER BY sort_order ASC, uploaded_at ASC
    `;

    return { listing, media };
  });
};

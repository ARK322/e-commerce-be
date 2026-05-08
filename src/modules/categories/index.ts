import type { FastifyPluginAsync } from "fastify";

export const categoriesRoutes: FastifyPluginAsync = async (app) => {
  app.get("/categories", async () => {
    const rows = await app.sql<
      {
        id: string;
        parent_id: string | null;
        name_tr: string;
        name_en: string;
        slug: string;
        sort_order: number;
      }[]
    >`
      SELECT id, parent_id, name_tr, name_en, slug, sort_order
      FROM categories
      WHERE is_active = true
      ORDER BY sort_order ASC, name_tr ASC
    `;
    return { items: rows };
  });
};

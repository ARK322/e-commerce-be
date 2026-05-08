import type { Sql } from "../../db/client.js";
import { hashPassword, verifyPassword } from "../../lib/password.js";
import type { RegisterBody } from "./schemas.js";

export async function registerUser(sql: Sql, body: RegisterBody) {
  const password_hash = await hashPassword(body.password);

  try {
    return await sql.begin(async (tx) => {
      const [user] = await tx<{ id: string }[]>`
        INSERT INTO users (email, password_hash, role)
        VALUES (${body.email}, ${password_hash}, ${body.role})
        RETURNING id
      `;

      if (body.role === "buyer") {
        await tx`
          INSERT INTO buyer_profiles (
            user_id, company_name, contact_full_name, phone, country, city,
            address, industry, tax_number
          )
          VALUES (
            ${user.id}, ${body.company_name}, ${body.contact_full_name},
            ${body.phone}, ${body.country}, ${body.city},
            ${body.address ?? null}, ${body.industry ?? null}, ${body.tax_number ?? null}
          )
        `;
      } else {
        await tx`
          INSERT INTO seller_profiles (
            user_id, seller_type, company_name, contact_full_name, phone,
            country, city, address, tax_number, company_description
          )
          VALUES (
            ${user.id}, ${body.seller_type}, ${body.company_name},
            ${body.contact_full_name}, ${body.phone}, ${body.country}, ${body.city},
            ${body.address ?? null}, ${body.tax_number ?? null},
            ${body.company_description ?? null}
          )
        `;
      }

      return { userId: user.id, role: body.role };
    });
  } catch (e: unknown) {
    const err = e as { code?: string };
    if (err.code === "23505") {
      return null;
    }
    throw e;
  }
}

export async function authenticateUser(
  sql: Sql,
  email: string,
  password: string,
): Promise<{ id: string; role: string } | null> {
  const rows = await sql<{ id: string; password_hash: string; role: string; status: string }[]>`
    SELECT id, password_hash, role, status FROM users WHERE email = ${email}
  `;
  const user = rows[0];
  if (!user || user.status !== "active") return null;
  const ok = await verifyPassword(user.password_hash, password);
  if (!ok) return null;
  return { id: user.id, role: user.role };
}

export async function getMe(sql: Sql, userId: string) {
  const users = await sql<
    {
      id: string;
      email: string;
      role: string;
      status: string;
      preferred_language: string;
      preferred_currency: string;
      email_verified: boolean;
      created_at: Date;
    }[]
  >`
    SELECT id, email, role, status, preferred_language, preferred_currency,
           email_verified, created_at
    FROM users WHERE id = ${userId}
  `;
  const user = users[0];
  if (!user) return null;

  if (user.role === "buyer") {
    const profiles = await sql<
      {
        id: string;
        company_name: string;
        contact_full_name: string;
        phone: string;
        country: string;
        city: string;
        address: string | null;
      }[]
    >`
      SELECT id, company_name, contact_full_name, phone, country, city, address
      FROM buyer_profiles WHERE user_id = ${userId}
    `;
    return { user, buyerProfile: profiles[0] ?? null, sellerProfile: null };
  }

  if (user.role === "seller") {
    const profiles = await sql<
      {
        id: string;
        seller_type: string;
        company_name: string;
        verification_status: string;
      }[]
    >`
      SELECT id, seller_type, company_name, verification_status
      FROM seller_profiles WHERE user_id = ${userId}
    `;
    return { user, buyerProfile: null, sellerProfile: profiles[0] ?? null };
  }

  return { user, buyerProfile: null, sellerProfile: null };
}

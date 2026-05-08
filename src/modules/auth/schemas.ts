import { z } from "zod";

export const loginBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const registerBuyerSchema = z.object({
  role: z.literal("buyer"),
  email: z.string().email(),
  password: z.string().min(8),
  company_name: z.string().min(1).max(255),
  contact_full_name: z.string().min(1).max(255),
  phone: z.string().min(1).max(30),
  country: z.string().min(1).max(100),
  city: z.string().min(1).max(100),
  address: z.string().max(5000).optional(),
  industry: z.string().max(100).optional(),
  tax_number: z.string().max(50).optional(),
});

export const registerSellerSchema = z.object({
  role: z.literal("seller"),
  email: z.string().email(),
  password: z.string().min(8),
  seller_type: z.enum(["manufacturer", "wholesaler"]),
  company_name: z.string().min(1).max(255),
  contact_full_name: z.string().min(1).max(255),
  phone: z.string().min(1).max(30),
  country: z.string().min(1).max(100),
  city: z.string().min(1).max(100),
  address: z.string().max(5000).optional(),
  tax_number: z.string().max(50).optional(),
  company_description: z.string().max(20000).optional(),
});

export const registerBodySchema = z.discriminatedUnion("role", [
  registerBuyerSchema,
  registerSellerSchema,
]);

export type RegisterBody = z.infer<typeof registerBodySchema>;

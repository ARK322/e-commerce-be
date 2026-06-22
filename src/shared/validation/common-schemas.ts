import { z } from 'zod';

const hasMongoOperator = (value: string) => /^\$/.test(value) || value.includes('.$');

export const objectIdSchema = z
  .string()
  .trim()
  .regex(/^[a-f\d]{24}$/i, 'Geçersiz kimlik');

export const uuidSchema = z
  .string()
  .trim()
  .uuid('Geçersiz kullanıcı kimliği');

export const safeString = (options: {
  min: number;
  max: number;
  label?: string;
  pattern?: RegExp;
  patternMessage?: string;
}) => {
  const label = options.label ?? 'Alan';

  let schema = z
    .string()
    .trim()
    .min(options.min, `${label} en az ${options.min} karakter olmalı`)
    .max(options.max, `${label} en fazla ${options.max} karakter olabilir`)
    .refine((value) => !hasMongoOperator(value), 'Geçersiz karakter içeriyor');

  if (options.pattern) {
    schema = schema.regex(
      options.pattern,
      options.patternMessage ?? `${label} geçersiz format`
    );
  }

  return schema;
};

export const optionalSafeString = (options: {
  min: number;
  max: number;
  label?: string;
}) =>
  safeString(options).optional();

export const safeUrlSchema = z
  .string()
  .trim()
  .url('Geçerli bir URL olmalı')
  .max(2048, 'URL çok uzun')
  .refine((value) => !hasMongoOperator(value), 'Geçersiz URL');

export const optionalSafeUrlSchema = safeUrlSchema.optional();

export const phoneSchema = safeString({
  min: 10,
  max: 20,
  label: 'Telefon numarası',
  pattern: /^\+?[0-9\s()-]{10,20}$/,
  patternMessage: 'Telefon numarası geçersiz',
});

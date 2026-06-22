import { z } from 'zod';

export const emailSchema = z
  .string({ error: 'E-posta adresi zorunlu' })
  .trim()
  .toLowerCase()
  .min(1, 'E-posta adresi zorunlu')
  .max(46, 'E-posta adresi çok uzun')
  .email('Geçerli bir e-posta adresi girin');

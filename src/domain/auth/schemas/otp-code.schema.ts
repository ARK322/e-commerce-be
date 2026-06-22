import { z } from 'zod';

export const otpCodeSchema = z
  .string({ error: 'Doğrulama kodu zorunlu' })
  .trim()
  .regex(/^\d{6}$/, 'Doğrulama kodu 6 haneli olmalı');

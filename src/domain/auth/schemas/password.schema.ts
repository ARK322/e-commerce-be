import { z } from 'zod';

const WEAK_PASSWORDS = [
  'password',
  '12345678',
  '123456789',
  'qwerty123',
  'abcdefgh',
  '11111111',
];

export const passwordSchema = z
  .string({ error: 'Şifre zorunlu' })
  .min(8, 'Şifre en az 8 karakter olmalı')
  .max(16, 'Şifre en fazla 16 karakter olabilir')
  .regex(/[A-Za-z]/, 'Şifre en az bir harf içermeli')
  .regex(/[0-9]/, 'Şifre en az bir rakam içermeli')
  .refine((value) => !/\s/.test(value), 'Şifre boşluk içeremez')
  .refine(
    (value) => !WEAK_PASSWORDS.includes(value.toLowerCase()),
    'Bu şifre çok yaygın, daha güçlü bir şifre seçin'
  );

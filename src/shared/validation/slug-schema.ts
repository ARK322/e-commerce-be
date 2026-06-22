import { safeString } from '@/shared/validation/common-schemas';

export const slugSchema = safeString({
  min: 1,
  max: 200,
  label: 'Slug',
  pattern: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
  patternMessage: 'Slug sadece küçük harf, rakam ve tire içerebilir',
}).transform((value) => value.toLowerCase());

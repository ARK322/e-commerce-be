const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const validateEmail = (value: string) => EMAIL_REGEX.test(value);

export const trimStringValidator = {
  trim: true,
  maxlength: [500, 'Alan çok uzun'],
} as const;

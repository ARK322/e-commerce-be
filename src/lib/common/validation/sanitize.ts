const isDangerousKey = (key: string) => key.startsWith('$') || key.includes('.');

export const sanitizeValue = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }

  if (value === null || typeof value !== 'object') {
    return value;
  }

  const sanitized: Record<string, unknown> = {};

  for (const [key, nestedValue] of Object.entries(value)) {
    if (isDangerousKey(key)) {
      continue;
    }

    sanitized[key] = sanitizeValue(nestedValue);
  }

  return sanitized;
};

export const sanitizeRequestBody = (body: unknown) => sanitizeValue(body);

import { describe, expect, it } from 'vitest';
import { escapeRegex } from '@/internal/common/validation/escape-regex';

describe('escapeRegex', () => {
  it('regex özel karakterlerini kaçırır', () => {
    expect(escapeRegex('kulaklık.*')).toBe('kulaklık\\.\\*');
  });
});

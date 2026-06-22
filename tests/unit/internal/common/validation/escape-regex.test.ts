import { describe, expect, it } from 'vitest';
import { escapeRegex } from '@/shared/validation/escape-regex';

describe('escapeRegex', () => {
  it('regex özel karakterlerini kaçırır', () => {
    expect(escapeRegex('kulaklık.*')).toBe('kulaklık\\.\\*');
  });
});

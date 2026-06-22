import { describe, expect, it } from 'vitest';
import { slugify } from '@/domains/catalog/application/category/slugify';

describe('slugify', () => {
  it('Türkçe karakterleri dönüştürür', () => {
    expect(slugify('Ev & Yaşam')).toBe('ev-yasam');
  });

  it('boş slug üretilemez', () => {
    expect(slugify('!!!')).toBe('');
  });
});

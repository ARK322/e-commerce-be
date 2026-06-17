import { describe, expect, it } from 'vitest';
import { createProductSchema } from '@/features/ecommerce/product/create-product.schema';

describe('createProductSchema', () => {
  it('images alanı kabul etmez', () => {
    const parsed = createProductSchema.safeParse({
      categoryId: '660e8400-e29b-41d4-a716-446655440001',
      name: 'Kulaklık',
      price: 999,
      stock: 5,
      images: ['https://example.com/a.jpg'],
    });

    expect(parsed.success).toBe(false);
  });

  it('fotoğraf olmadan ürün oluşturmayı kabul eder', () => {
    const parsed = createProductSchema.safeParse({
      categoryId: '660e8400-e29b-41d4-a716-446655440001',
      name: 'Kulaklık',
      price: 999,
      stock: 5,
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data).not.toHaveProperty('images');
      expect(parsed.data.categoryId).toBe('660e8400-e29b-41d4-a716-446655440001');
    }
  });
});

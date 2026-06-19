import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { signAuthToken } from '@/internal/auth/tokens/access-token';
import { buildApp } from '@/app/app';

const mockUploadSellerDocument = vi.fn();
const mockUserFindById = vi.fn();
const mockRevokedTokenExists = vi.fn();

vi.mock('@/internal/auth/profile/documents', () => ({
  uploadSellerDocument: (...args: unknown[]) => mockUploadSellerDocument(...args),
}));

vi.mock('@/integrations/mongo', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/integrations/mongo')>();
  return {
    ...actual,
    User: {
      ...actual.User,
      findById: (...args: unknown[]) => mockUserFindById(...args),
    },
    RevokedToken: {
      ...actual.RevokedToken,
      exists: (...args: unknown[]) => mockRevokedTokenExists(...args),
    },
  };
});

const sellerId = '550e8400-e29b-41d4-a716-446655440000';
const boundary = '----cursor-test-boundary';

const buildMultipart = (
  fields: Record<string, string>,
  file?: { field: string; filename: string; contentType: string; data: Buffer }
) => {
  const chunks: Buffer[] = [];

  for (const [name, value] of Object.entries(fields)) {
    chunks.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`
      )
    );
  }

  if (file) {
    chunks.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="${file.field}"; filename="${file.filename}"\r\nContent-Type: ${file.contentType}\r\n\r\n`
      )
    );
    chunks.push(file.data);
    chunks.push(Buffer.from('\r\n'));
  }

  chunks.push(Buffer.from(`--${boundary}--\r\n`));
  return Buffer.concat(chunks);
};

const mockVerifiedSeller = () => {
  mockUserFindById.mockImplementation((id: string) => {
    if (id === sellerId) {
      return {
        select: vi.fn().mockResolvedValue({
          _id: sellerId,
          role: 'seller',
          isEmailVerified: true,
          passwordChangedAt: null,
          sessionsRevokedAt: null,
        }),
      };
    }

    return {
      select: vi.fn().mockResolvedValue({ isEmailVerified: true, role: 'seller' }),
    };
  });
};

describe('profile documents routes integration', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'integration-test-secret';
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockRevokedTokenExists.mockResolvedValue(null);
  });

  it('POST /auth/profile/documents token olmadan 401 döner', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/auth/profile/documents',
      payload: {},
    });

    expect(response.statusCode).toBe(401);
  });

  it('POST /auth/profile/documents dosya olmadan 400 döner', async () => {
    const token = signAuthToken(sellerId, 'seller');
    mockVerifiedSeller();

    const response = await app.inject({
      method: 'POST',
      url: '/auth/profile/documents',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      payload: buildMultipart({ docType: 'taxCertificate' }),
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ message: 'Dosya zorunlu' });
  });

  it('POST /auth/profile/documents docType olmadan 400 döner', async () => {
    const token = signAuthToken(sellerId, 'seller');
    mockVerifiedSeller();

    const response = await app.inject({
      method: 'POST',
      url: '/auth/profile/documents',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      payload: buildMultipart({}, {
        field: 'file',
        filename: 'tax.pdf',
        contentType: 'application/pdf',
        data: Buffer.from('%PDF-1.4'),
      }),
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ message: 'docType zorunlu' });
  });

  it('POST /auth/profile/documents geçerli yükleme ile belge kaydeder', async () => {
    const token = signAuthToken(sellerId, 'seller');
    mockVerifiedSeller();
    mockUploadSellerDocument.mockResolvedValue({
      docType: 'taxCertificate',
      url: 'https://storage.example.com/tax.pdf',
    });

    const response = await app.inject({
      method: 'POST',
      url: '/auth/profile/documents',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      payload: buildMultipart(
        { docType: 'taxCertificate' },
        {
          field: 'file',
          filename: 'tax.pdf',
          contentType: 'application/pdf',
          data: Buffer.from('%PDF-1.4'),
        }
      ),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      message: 'Belge yüklendi',
      docType: 'taxCertificate',
      url: 'https://storage.example.com/tax.pdf',
    });
    expect(mockUploadSellerDocument).toHaveBeenCalledWith(
      expect.objectContaining({ userId: sellerId, role: 'seller' }),
      expect.objectContaining({ docType: 'taxCertificate', mimeType: 'application/pdf' })
    );
  });
});

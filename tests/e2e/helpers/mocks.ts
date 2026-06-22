import { vi } from 'vitest';

export const mockCompleteIyzicoCheckout = vi.fn();

vi.mock('@/domain/auth/mail/send-verification', () => ({
  sendUserVerificationEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/infrastructure/resend/send', () => ({
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/infrastructure/iyzico/initialize-checkout', () => ({
  initializeIyzicoCheckout: vi.fn().mockResolvedValue({
    token: 'e2e-checkout-token',
    paymentPageUrl: 'https://sandbox-cpp.iyzipay.com?token=e2e',
    checkoutFormContent: null,
  }),
}));

vi.mock('@/infrastructure/iyzico/retrieve-checkout', () => ({
  completeIyzicoCheckout: (...args: unknown[]) => mockCompleteIyzicoCheckout(...args),
}));

vi.mock('@/infrastructure/iyzico/create-submerchant', () => ({
  createIyzicoSubMerchant: vi.fn().mockResolvedValue('e2e-sub-merchant-key'),
}));

vi.mock('@/domain/auth/admin/mail/send-seller-notifications', () => ({
  sendSellerApprovedEmail: vi.fn().mockResolvedValue(undefined),
  sendSellerRejectedEmail: vi.fn().mockResolvedValue(undefined),
}));

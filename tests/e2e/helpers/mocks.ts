import { vi } from 'vitest';

export const mockCompleteIyzicoCheckout = vi.fn();

vi.mock('@/domains/identity/application/mail/send-verification', async () => {
  const { createUserId } = await import('@/shared/ids');
  const { createAuthOtp } = await import('@/domains/identity/application/otp/otp');
  const { updateUserById } = await import(
    '@/domains/identity/infrastructure/repositories/auth/user.repository'
  );

  return {
    sendUserVerificationEmail: vi.fn(async (userId: string) => {
      const jti = createUserId();
      await createAuthOtp(userId, 'email_verify');
      await updateUserById(userId, { $set: { activeEmailVerifyJti: jti } });
      return jti;
    }),
  };
});

vi.mock('@/integrations/resend/send', () => ({
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/integrations/iyzico/initialize-checkout', () => ({
  initializeIyzicoCheckout: vi.fn().mockResolvedValue({
    token: 'e2e-checkout-token',
    paymentPageUrl: 'https://sandbox-cpp.iyzipay.com?token=e2e',
    checkoutFormContent: null,
  }),
}));

vi.mock('@/integrations/iyzico/retrieve-checkout', () => ({
  completeIyzicoCheckout: (...args: unknown[]) => mockCompleteIyzicoCheckout(...args),
}));

vi.mock('@/integrations/iyzico/create-submerchant', () => ({
  createIyzicoSubMerchant: vi.fn().mockResolvedValue('e2e-sub-merchant-key'),
}));

vi.mock('@/domains/identity/application/admin/mail/send-seller-notifications', () => ({
  sendSellerApprovedEmail: vi.fn().mockResolvedValue(undefined),
  sendSellerRejectedEmail: vi.fn().mockResolvedValue(undefined),
}));

export { connectDB } from '@/integrations/mongo/connection';

export { User } from '@/integrations/mongo/models/auth/user.model';
export { Buyer } from '@/integrations/mongo/models/auth/buyer.model';
export { Seller, SELLER_APPROVAL_STATUSES } from '@/integrations/mongo/models/auth/seller.model';
export type { SellerApprovalStatus } from '@/integrations/mongo/models/auth/seller.model';
export { SellerMember } from '@/integrations/mongo/models/auth/seller-member.model';
export {
  SellerRole,
  SELLER_SYSTEM_OWNER_ROLE_SLUG,
} from '@/integrations/mongo/models/auth/seller-role.model';
export { Admin } from '@/integrations/mongo/models/auth/admin.model';
export { AdminRole, SYSTEM_OWNER_ROLE_SLUG } from '@/integrations/mongo/models/auth/admin-role.model';
export {
  AdminAuditLog,
  ADMIN_AUDIT_ACTIONS,
} from '@/integrations/mongo/models/auth/admin-audit-log.model';
export type { AdminAuditAction } from '@/integrations/mongo/models/auth/admin-audit-log.model';
export { RevokedToken } from '@/integrations/mongo/models/auth/revoked-token.model';
export { AuthOtp, AUTH_OTP_PURPOSES, buildAuthOtpId } from '@/integrations/mongo/models/auth/auth-otp.model';
export type { AuthOtpPurpose } from '@/integrations/mongo/models/auth/auth-otp.model';
export {
  AuthEmailCooldown,
  AUTH_EMAIL_COOLDOWN_PURPOSES,
  buildAuthEmailCooldownId,
} from '@/integrations/mongo/models/auth/auth-email-cooldown.model';
export type { AuthEmailCooldownPurpose } from '@/integrations/mongo/models/auth/auth-email-cooldown.model';

export { Category } from '@/integrations/mongo/models/ecommerce/category.model';
export {
  Product,
  PRODUCT_CURRENCIES,
} from '@/integrations/mongo/models/ecommerce/product.model';
export type { ProductCurrency } from '@/integrations/mongo/models/ecommerce/product.model';
export { Cart } from '@/integrations/mongo/models/ecommerce/cart.model';
export {
  Order,
  ORDER_STATUSES,
  ORDER_CURRENCIES,
} from '@/integrations/mongo/models/ecommerce/order.model';
export type { OrderStatus, OrderCurrency, ItemFulfillmentStatus } from '@/integrations/mongo/models/ecommerce/order.model';
export {
  Payment,
  PAYMENT_STATUSES,
  PAYMENT_CURRENCIES,
} from '@/integrations/mongo/models/ecommerce/payment.model';
export type { PaymentStatus, PaymentCurrency } from '@/integrations/mongo/models/ecommerce/payment.model';
export {
  PaymentSplit,
  PAYMENT_SPLIT_APPROVAL_STATUSES,
} from '@/integrations/mongo/models/ecommerce/payment-split.model';
export type { PaymentSplitApprovalStatus } from '@/integrations/mongo/models/ecommerce/payment-split.model';
export {
  SellerWallet,
  SELLER_WALLET_CURRENCIES,
} from '@/integrations/mongo/models/ecommerce/seller-wallet.model';
export type { SellerWalletCurrency } from '@/integrations/mongo/models/ecommerce/seller-wallet.model';
export {
  SellerWalletLedger,
  SELLER_WALLET_LEDGER_ENTRY_TYPES,
} from '@/integrations/mongo/models/ecommerce/seller-wallet-ledger.model';
export type { SellerWalletLedgerEntryType } from '@/integrations/mongo/models/ecommerce/seller-wallet-ledger.model';

export {
  PaymentAuditLog,
} from '@/integrations/mongo/models/ecommerce/payment-audit-log.model';

export {
  OutboxEvent,
  OUTBOX_EVENT_STATUSES,
} from '@/integrations/mongo/models/common/outbox-event.model';
export type { OutboxEventStatus } from '@/integrations/mongo/models/common/outbox-event.model';

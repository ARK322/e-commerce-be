export { connectDB } from '@/infrastructure/mongo/connection';

export { User } from '@/infrastructure/mongo/models/auth/user.model';
export { Buyer } from '@/infrastructure/mongo/models/auth/buyer.model';
export { Seller, SELLER_APPROVAL_STATUSES } from '@/infrastructure/mongo/models/auth/seller.model';
export type { SellerApprovalStatus } from '@/infrastructure/mongo/models/auth/seller.model';
export { SellerMember } from '@/infrastructure/mongo/models/auth/seller-member.model';
export {
  SellerRole,
  SELLER_SYSTEM_OWNER_ROLE_SLUG,
} from '@/infrastructure/mongo/models/auth/seller-role.model';
export { Admin } from '@/infrastructure/mongo/models/auth/admin.model';
export { AdminRole, SYSTEM_OWNER_ROLE_SLUG } from '@/infrastructure/mongo/models/auth/admin-role.model';
export {
  AdminAuditLog,
  ADMIN_AUDIT_ACTIONS,
} from '@/infrastructure/mongo/models/auth/admin-audit-log.model';
export type { AdminAuditAction } from '@/infrastructure/mongo/models/auth/admin-audit-log.model';
export { RevokedToken } from '@/infrastructure/mongo/models/auth/revoked-token.model';
export { AuthOtp, AUTH_OTP_PURPOSES, buildAuthOtpId } from '@/infrastructure/mongo/models/auth/auth-otp.model';
export type { AuthOtpPurpose } from '@/infrastructure/mongo/models/auth/auth-otp.model';
export {
  AuthEmailCooldown,
  AUTH_EMAIL_COOLDOWN_PURPOSES,
  buildAuthEmailCooldownId,
} from '@/infrastructure/mongo/models/auth/auth-email-cooldown.model';
export type { AuthEmailCooldownPurpose } from '@/infrastructure/mongo/models/auth/auth-email-cooldown.model';

export { Category } from '@/infrastructure/mongo/models/ecommerce/category.model';
export {
  Product,
  PRODUCT_CURRENCIES,
} from '@/infrastructure/mongo/models/ecommerce/product.model';
export type { ProductCurrency } from '@/infrastructure/mongo/models/ecommerce/product.model';
export { Cart } from '@/infrastructure/mongo/models/ecommerce/cart.model';
export {
  Order,
  ORDER_STATUSES,
  ORDER_CURRENCIES,
} from '@/infrastructure/mongo/models/ecommerce/order.model';
export type { OrderStatus, OrderCurrency, ItemFulfillmentStatus } from '@/infrastructure/mongo/models/ecommerce/order.model';
export {
  Payment,
  PAYMENT_STATUSES,
  PAYMENT_CURRENCIES,
} from '@/infrastructure/mongo/models/ecommerce/payment.model';
export type { PaymentStatus, PaymentCurrency } from '@/infrastructure/mongo/models/ecommerce/payment.model';
export {
  PaymentSplit,
  PAYMENT_SPLIT_APPROVAL_STATUSES,
} from '@/infrastructure/mongo/models/ecommerce/payment-split.model';
export type { PaymentSplitApprovalStatus } from '@/infrastructure/mongo/models/ecommerce/payment-split.model';
export {
  SellerWallet,
  SELLER_WALLET_CURRENCIES,
} from '@/infrastructure/mongo/models/ecommerce/seller-wallet.model';
export type { SellerWalletCurrency } from '@/infrastructure/mongo/models/ecommerce/seller-wallet.model';
export {
  SellerWalletLedger,
  SELLER_WALLET_LEDGER_ENTRY_TYPES,
} from '@/infrastructure/mongo/models/ecommerce/seller-wallet-ledger.model';
export type { SellerWalletLedgerEntryType } from '@/infrastructure/mongo/models/ecommerce/seller-wallet-ledger.model';

export {
  PaymentAuditLog,
} from '@/infrastructure/mongo/models/ecommerce/payment-audit-log.model';

export {
  OutboxEvent,
  OUTBOX_EVENT_STATUSES,
} from '@/infrastructure/mongo/models/common/outbox-event.model';
export type { OutboxEventStatus } from '@/infrastructure/mongo/models/common/outbox-event.model';

export {
  SupportTicket,
  SUPPORT_TICKET_STATUSES,
  SUPPORT_TICKET_CATEGORIES,
  SUPPORT_AUTHOR_ROLES,
} from '@/infrastructure/mongo/models/support/support-ticket.model';
export type {
  SupportTicketStatus,
  SupportTicketCategory,
  SupportAuthorRole,
} from '@/infrastructure/mongo/models/support/support-ticket.model';
export { SupportMessage } from '@/infrastructure/mongo/models/support/support-message.model';

import { Schema, model } from 'mongoose';

export const ADMIN_AUDIT_ACTIONS = [
  'admin.created',
  'admin.role_updated',
  'admin.deleted',
  'admin.profile_updated',
  'admin_role.created',
  'admin_role.updated',
  'admin_role.deleted',
  'seller.approved',
  'seller.rejected',
  'seller.iyzico_synced',
  'user.deactivated',
  'user.reactivated',
  'support.ticket_updated',
  'support.message_posted',
] as const;

export type AdminAuditAction = (typeof ADMIN_AUDIT_ACTIONS)[number];

const adminAuditLogSchema = new Schema(
  {
    _id: { type: String, required: true },
    actorUserId: { type: String, required: true },
    action: { type: String, enum: ADMIN_AUDIT_ACTIONS, required: true },
    resourceType: { type: String, required: true, trim: true, maxlength: 64 },
    resourceId: { type: String, required: true, trim: true, maxlength: 64 },
    metadata: { type: Schema.Types.Mixed, default: null },
    createdAt: { type: Date, default: Date.now },
  },
  { strict: true }
);

adminAuditLogSchema.index({ actorUserId: 1, createdAt: -1 });
adminAuditLogSchema.index({ resourceType: 1, resourceId: 1, createdAt: -1 });
adminAuditLogSchema.index({ action: 1, createdAt: -1 });

export const AdminAuditLog = model('AdminAuditLog', adminAuditLogSchema);

import { Schema, model } from 'mongoose';

export const SELLER_APPROVAL_STATUSES = ['draft', 'pending', 'approved', 'rejected'] as const;
export type SellerApprovalStatus = (typeof SELLER_APPROVAL_STATUSES)[number];

const stringField = { type: String, trim: true, maxlength: 500 };
const urlField = { type: String, trim: true, maxlength: 2048 };

const sellerSchema = new Schema(
  {
    _id: { type: String, required: true },
    approvalStatus: {
      type: String,
      enum: SELLER_APPROVAL_STATUSES,
      default: 'draft',
    },
    rejectionReason: { type: String, default: null, maxlength: 500, trim: true },
    sellerType: { type: String, enum: ['bireysel', 'kurumsal'] },

    firstName: stringField,
    lastName: stringField,
    phone: { ...stringField, maxlength: 20 },

    authorizedFirstName: stringField,
    authorizedLastName: stringField,
    authorizedPhone: { ...stringField, maxlength: 20 },
    companyPhone: { ...stringField, maxlength: 20 },
    companyType: { type: String, enum: ['ltd', 'as'] },

    companyName: stringField,
    taxNumber: { ...stringField, maxlength: 10 },
    taxOffice: stringField,
    country: stringField,
    city: stringField,
    district: stringField,
    companyAddress: { ...stringField, maxlength: 1000 },
    taxCertificateUrl: urlField,
    signatureCircularUrl: urlField,
    bankName: stringField,
    iban: { ...stringField, maxlength: 26 },
    accountHolderName: stringField,
    companyLogoUrl: urlField,
    companyDescription: { ...stringField, maxlength: 2000 },
    companyWebsite: urlField,
    socialMediaLinks: [{ ...urlField }],
    iyzicoSubMerchantKey: { type: String, trim: true, maxlength: 200, default: null },
  },
  { strict: true }
);

sellerSchema.index({ approvalStatus: 1 });
sellerSchema.index({ taxNumber: 1 });

export const Seller = model('Seller', sellerSchema);

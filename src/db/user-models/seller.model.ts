import { Schema, model, Types } from 'mongoose';

const sellerSchema = new Schema({
  userId: { type: Types.ObjectId, ref: 'User', required: true, unique: true },
  sellerType: { type: String, enum: ['bireysel', 'kurumsal'] },

  firstName: { type: String },
  lastName: { type: String },
  phone: { type: String },

  authorizedFirstName: { type: String },
  authorizedLastName: { type: String },
  authorizedPhone: { type: String },
  companyPhone: { type: String },
  companyType: { type: String, enum: ['ltd', 'as', 'diger'] },

  companyName: { type: String },
  taxNumber: { type: String },
  taxOffice: { type: String },
  country: { type: String },
  city: { type: String },
  district: { type: String },
  companyAddress: { type: String },
  taxCertificateUrl: { type: String },
  signatureCircularUrl: { type: String },
  bankName: { type: String },
  iban: { type: String },
  accountHolderName: { type: String },
  companyLogoUrl: { type: String },
  companyDescription: { type: String },
  companyWebsite: { type: String },
  socialMediaLinks: [{ type: String }],
});

export const Seller = model('Seller', sellerSchema);

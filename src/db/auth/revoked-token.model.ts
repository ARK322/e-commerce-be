import { Schema, model } from 'mongoose';

const revokedTokenSchema = new Schema(
  {
    tokenHash: { type: String, required: true, unique: true, maxlength: 128 },
    expiresAt: { type: Date, required: true, expires: 0 },
  },
  { strict: true }
);

export const RevokedToken = model('RevokedToken', revokedTokenSchema);

import type { AuthOtpPurpose } from '@/integrations/mongo';
import { AuthOtp } from '@/integrations/mongo';

export const upsertAuthOtp = async (
  id: string,
  data: { codeHash: string; expiresAt: Date; attemptCount: number }
) =>
  AuthOtp.findOneAndUpdate(
    { _id: id },
    {
      $set: data,
      $setOnInsert: { _id: id },
    },
    { upsert: true, returnDocument: 'after' }
  );

export const findAuthOtpById = async (id: string) => AuthOtp.findById(id);

export const deleteAuthOtpById = async (id: string) => AuthOtp.findByIdAndDelete(id);

export const saveAuthOtpDocument = async (otp: { save: () => Promise<unknown> }) => otp.save();

export const deleteAuthOtpsByIds = async (ids: string[]) => AuthOtp.deleteMany({ _id: { $in: ids } });

export type { AuthOtpPurpose };

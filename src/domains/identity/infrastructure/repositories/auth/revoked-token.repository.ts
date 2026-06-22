import { RevokedToken } from '@/integrations/mongo';

export const revokedTokenExists = async (tokenHash: string) =>
  RevokedToken.exists({ _id: tokenHash });

export const upsertRevokedToken = async (tokenHash: string, expiresAt: Date) =>
  RevokedToken.updateOne(
    { _id: tokenHash },
    {
      $set: { expiresAt },
      $setOnInsert: { _id: tokenHash },
    },
    { upsert: true }
  );

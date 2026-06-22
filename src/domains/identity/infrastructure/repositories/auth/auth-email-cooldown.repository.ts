import { AuthEmailCooldown } from '@/integrations/mongo';

export const findAuthEmailCooldownById = async (id: string) => AuthEmailCooldown.findById(id);

export const upsertAuthEmailCooldownSentAt = async (id: string, sentAt: Date) =>
  AuthEmailCooldown.findOneAndUpdate(
    { _id: id },
    {
      $set: { sentAt },
      $setOnInsert: { _id: id },
    },
    { upsert: true }
  );

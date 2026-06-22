import { User } from '@/integrations/mongo';

export const findUserByEmail = async (email: string) =>
  User.findOne({ email: email.toLowerCase() });

export const findUserByEmailLean = async (email: string, select?: string) => {
  const query = User.findOne({ email: email.toLowerCase() });

  if (select) {
    query.select(select);
  }

  return query.lean();
};

export const findUserById = async (userId: string) => User.findById(userId);

export const findUserByIdLean = async (
  userId: string,
  select?: string
): Promise<Record<string, unknown> | null> => {
  let query: ReturnType<typeof User.findById> = User.findById(userId);

  if (select) {
    query = query.select(select) as ReturnType<typeof User.findById>;
  }

  if (typeof (query as { lean?: () => Promise<Record<string, unknown> | null> }).lean === 'function') {
    return (query as { lean: () => Promise<Record<string, unknown> | null> }).lean();
  }

  return query as unknown as Promise<Record<string, unknown> | null>;
};

export const findUsersByIdsLean = async (userIds: string[], select: string) =>
  User.find({ _id: { $in: userIds } })
    .select(select)
    .lean();

export const createUser = async (data: Record<string, unknown>) => User.create(data);

export const updateUserById = async (userId: string, update: Record<string, unknown>) =>
  User.findByIdAndUpdate(userId, update);

export const saveUserDocument = async (user: { save: () => Promise<unknown> }) => user.save();

export const deleteUserById = async (userId: string) => User.findByIdAndDelete(userId);

export const listExpiredUnverifiedUsersLean = async (now: Date) =>
  User.find({
    isEmailVerified: false,
    verificationExpiresAt: { $ne: null, $lt: now },
  })
    .select('_id')
    .lean();

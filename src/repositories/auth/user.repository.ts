import { User } from '@/integrations/mongo';

export const findUserByEmail = async (email: string) =>
  User.findOne({ email: email.toLowerCase() });

export const findUserById = async (userId: string) => User.findById(userId);

export const findUserByIdLean = async (userId: string, select?: string) => {
  const query = User.findById(userId);

  if (select) {
    query.select(select);
  }

  return query.lean();
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

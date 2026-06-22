import { connectDB } from '@/infrastructure/mongo';

export const registerDb = async (): Promise<void> => {
  await connectDB();
};

import { signEmailVerificationToken } from '../email-token';
import { sendVerificationEmail } from './send-mail';

export const sendUserVerificationEmail = async (userId: string, email: string) => {
  const token = signEmailVerificationToken(userId);
  await sendVerificationEmail(email, token);
};

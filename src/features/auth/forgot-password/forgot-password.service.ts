import { signPasswordResetToken } from '../../../lib/auth/email-token';
import { sendPasswordResetEmail } from '../../../lib/auth/email/send-mail';
import { User } from '../../../db';

export const forgotPassword = async (email: string) => {
  const user = await User.findOne({ email: email.toLowerCase() });

  if (!user) {
    return;
  }

  const token = signPasswordResetToken(user._id.toString());
  await sendPasswordResetEmail(user.email, token);
};

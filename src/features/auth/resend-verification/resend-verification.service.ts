import { sendUserVerificationEmail } from '../../../lib/auth/email/send-verification';
import { User } from '../../../db';

export const resendVerificationEmail = async (email: string) => {
  const user = await User.findOne({ email: email.toLowerCase() });

  if (!user || user.isEmailVerified) {
    return;
  }

  await sendUserVerificationEmail(user._id.toString(), user.email);
};

import { getResend, getFrontendUrl, getMailFrom } from '@/infrastructure/resend/transporter';
import {
  buildPasswordResetEmailHtml,
  buildVerificationEmailHtml,
} from '@/infrastructure/resend/templates';
import { createLogger } from '@/shared/logging';

const log = createLogger({ module: 'mail' });

type SendMailInput = {
  to: string;
  subject: string;
  html: string;
};

export const sendMail = async ({ to, subject, html }: SendMailInput) => {
  try {
    const { data, error } = await getResend().emails.send({
      from: getMailFrom(),
      to: [to],
      subject,
      html,
    });

    if (error) {
      log.error({ err: error, to, subject }, 'Mail gönderilemedi');
      throw new Error(error.message);
    }

    log.info({ to, subject, messageId: data?.id }, 'Mail gönderildi');
  } catch (error) {
    log.error({ err: error, to, subject }, 'Mail gönderilirken hata oluştu');
    throw error;
  }
};

export const sendVerificationEmail = async (to: string, token: string, code: string) => {
  const verifyUrl = `${getFrontendUrl()}/verify-email?token=${encodeURIComponent(token)}`;

  await sendMail({
    to,
    subject: 'E-posta adresini doğrula',
    html: buildVerificationEmailHtml(verifyUrl, code),
  });
};

export const sendPasswordResetEmail = async (to: string, token: string, code: string) => {
  const resetUrl = `${getFrontendUrl()}/reset-password?token=${encodeURIComponent(token)}`;

  await sendMail({
    to,
    subject: 'Şifre sıfırlama',
    html: buildPasswordResetEmailHtml(resetUrl, code),
  });
};

import { resend, getFrontendUrl, getMailFrom } from './transporter';

type SendMailInput = {
  to: string;
  subject: string;
  html: string;
};

export const sendMail = async ({ to, subject, html }: SendMailInput) => {
  try {
    const { data, error } = await resend.emails.send({
      from: getMailFrom(),
      to: [to],
      subject,
      html,
    });

    if (error) {
      console.error('Mail gönderilemedi:', error);
      throw new Error(error.message);
    }

    console.log('Mail gönderildi:', data?.id);
  } catch (error) {
    console.error('Mail gönderilirken hata oluştu:', error);
    throw error;
  }
};

export const sendVerificationEmail = async (to: string, token: string) => {
  const verifyUrl = `${getFrontendUrl()}/verify-email?token=${encodeURIComponent(token)}`;

  await sendMail({
    to,
    subject: 'E-posta adresini doğrula',
    html: `
      <p>Hesabını oluşturduğun için teşekkürler.</p>
      <p>E-posta adresini doğrulamak için aşağıdaki bağlantıya tıkla:</p>
      <p><a href="${verifyUrl}">${verifyUrl}</a></p>
      <p>Bu bağlantı 24 saat geçerlidir.</p>
    `,
  });
};

export const sendPasswordResetEmail = async (to: string, token: string) => {
  const resetUrl = `${getFrontendUrl()}/reset-password?token=${encodeURIComponent(token)}`;

  await sendMail({
    to,
    subject: 'Şifre sıfırlama',
    html: `
      <p>Şifre sıfırlama talebi aldık.</p>
      <p>Yeni şifre belirlemek için aşağıdaki bağlantıya tıkla:</p>
      <p><a href="${resetUrl}">${resetUrl}</a></p>
      <p>Bu bağlantı 1 saat geçerlidir.</p>
      <p>Bu talebi sen yapmadıysan bu e-postayı yok say.</p>
    `,
  });
};

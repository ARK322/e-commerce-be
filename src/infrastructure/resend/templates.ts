import { actionButton, baseLayout, codeBox, footerNote } from '@/infrastructure/resend/layout';

export const buildVerificationEmailHtml = (verifyUrl: string, code: string) =>
  baseLayout(`
    <h1 style="margin: 0 0 16px; font-size: 22px;">E-posta adresini doğrula</h1>
    <p style="margin: 0;">Hesabını oluşturduğun için teşekkürler. E-posta adresini doğrulamak için aşağıdaki kodu kullan veya bağlantıya tıkla.</p>
    ${codeBox(code)}
    ${actionButton(verifyUrl, 'E-postamı doğrula')}
    <p style="margin: 0; font-size: 14px; color: #52525b;">Bağlantı çalışmazsa tarayıcına şunu yapıştır:</p>
    <p style="margin: 8px 0 0; font-size: 13px; word-break: break-all; color: #71717a;">${verifyUrl}</p>
    ${footerNote('Bu kod ve bağlantı 24 saat geçerlidir. Bu işlemi sen yapmadıysan bu e-postayı yok say.')}
  `);

export const buildPasswordResetEmailHtml = (resetUrl: string, code: string) =>
  baseLayout(`
    <h1 style="margin: 0 0 16px; font-size: 22px;">Şifre sıfırlama</h1>
    <p style="margin: 0;">Şifre sıfırlama talebi aldık. Yeni şifre belirlemek için aşağıdaki kodu kullan veya bağlantıya tıkla.</p>
    ${codeBox(code)}
    ${actionButton(resetUrl, 'Şifremi sıfırla')}
    <p style="margin: 0; font-size: 14px; color: #52525b;">Bağlantı çalışmazsa tarayıcına şunu yapıştır:</p>
    <p style="margin: 8px 0 0; font-size: 13px; word-break: break-all; color: #71717a;">${resetUrl}</p>
    ${footerNote('Bu kod ve bağlantı 1 saat geçerlidir. Bu talebi sen yapmadıysan bu e-postayı yok say.')}
  `);

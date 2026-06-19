import { actionButton, baseLayout, escapeHtml, footerNote, reasonBox } from '@/integrations/resend/layout';

export const buildSellerApprovedEmailHtml = (dashboardUrl: string, companyName?: string) =>
  baseLayout(`
    <h1 style="margin: 0 0 16px; font-size: 22px;">Satıcı hesabın onaylandı</h1>
    <p style="margin: 0;">${companyName ? `<strong>${escapeHtml(companyName)}</strong> satıcı başvurun onaylandı.` : 'Satıcı başvurun onaylandı.'} Artık ürün ekleyebilir ve satış yapabilirsin.</p>
    ${actionButton(dashboardUrl, 'Satıcı paneline git')}
    ${footerNote('Soruların varsa destek ekibimizle iletişime geçebilirsin.')}
  `);

export const buildSellerRejectedEmailHtml = (
  profileUrl: string,
  reason: string,
  companyName?: string
) =>
  baseLayout(`
    <h1 style="margin: 0 0 16px; font-size: 22px;">Satıcı başvurun reddedildi</h1>
    <p style="margin: 0;">${companyName ? `<strong>${escapeHtml(companyName)}</strong> satıcı başvurun incelendi ancak şu an onaylanamadı.` : 'Satıcı başvurun incelendi ancak şu an onaylanamadı.'}</p>
    ${reasonBox(reason)}
    <p style="margin: 0;">Profilindeki eksik veya hatalı bilgileri düzelterek tekrar başvurabilirsin.</p>
    ${actionButton(profileUrl, 'Profilimi güncelle')}
    ${footerNote('Soruların varsa destek ekibimizle iletişime geçebilirsin.')}
  `);

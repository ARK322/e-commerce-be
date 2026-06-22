import { getFrontendUrl } from '@/infrastructure/resend/transporter';
import { sendMail } from '@/infrastructure/resend/send';

export const sendOrderConfirmationEmail = async (
  to: string,
  orderId: string,
  totalAmount: number,
  currency: string
) => {
  const orderUrl = `${getFrontendUrl()}/orders/${orderId}`;

  await sendMail({
    to,
    subject: 'Siparişiniz alındı',
    html: `
      <h2>Ödemeniz başarıyla tamamlandı</h2>
      <p>Sipariş numaranız: <strong>${orderId}</strong></p>
      <p>Toplam tutar: <strong>${totalAmount} ${currency}</strong></p>
      <p><a href="${orderUrl}">Sipariş detaylarını görüntüle</a></p>
    `,
  });
};

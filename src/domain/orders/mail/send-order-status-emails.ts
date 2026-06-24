import { getFrontendUrl } from '@/infrastructure/resend/transporter';
import { sendMail } from '@/infrastructure/resend/send';

export const sendOrderShippedEmail = async (
  to: string,
  orderId: string,
  trackingNumber: string,
  carrier: string
) => {
  const orderUrl = `${getFrontendUrl()}/orders/${orderId}`;

  await sendMail({
    to,
    subject: 'Siparişiniz kargoya verildi',
    html: `
      <h2>Siparişiniz yola çıktı</h2>
      <p>Sipariş numaranız: <strong>${orderId}</strong></p>
      <p>Kargo firması: <strong>${carrier}</strong></p>
      <p>Takip numarası: <strong>${trackingNumber}</strong></p>
      <p><a href="${orderUrl}">Sipariş detaylarını görüntüle</a></p>
    `,
  });
};

export const sendOrderDeliveredEmail = async (to: string, orderId: string) => {
  const orderUrl = `${getFrontendUrl()}/orders/${orderId}`;

  await sendMail({
    to,
    subject: 'Siparişiniz teslim edildi',
    html: `
      <h2>Siparişiniz teslim edildi</h2>
      <p>Sipariş numaranız: <strong>${orderId}</strong></p>
      <p><a href="${orderUrl}">Sipariş detaylarını görüntüle</a></p>
    `,
  });
};

export const sendReturnRequestedEmail = async (to: string, orderId: string, requestId: string) => {
  await sendMail({
    to,
    subject: 'İade/iptal talebiniz alındı',
    html: `
      <h2>Talebiniz inceleniyor</h2>
      <p>Sipariş: <strong>${orderId}</strong></p>
      <p>Talep no: <strong>${requestId}</strong></p>
    `,
  });
};

export const sendReturnResolvedEmail = async (
  to: string,
  orderId: string,
  status: string
) => {
  await sendMail({
    to,
    subject: 'İade/iptal talebiniz güncellendi',
    html: `
      <h2>Talep durumu: ${status}</h2>
      <p>Sipariş: <strong>${orderId}</strong></p>
    `,
  });
};

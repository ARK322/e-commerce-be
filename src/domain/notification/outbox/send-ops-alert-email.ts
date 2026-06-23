import { env } from '@/config/env';
import { sendMail } from '@/infrastructure/resend/send';
import { createLogger } from '@/shared/logging';
import { OUTBOX_EVENT_TYPES } from '@/domain/notification/outbox/enqueue-outbox-event';

const log = createLogger({ module: 'ops-alert-mail' });

const OPS_EVENT_LABELS: Record<string, string> = {
  [OUTBOX_EVENT_TYPES.OPS_PAYMENT_SIDE_EFFECTS_FAILED]: 'Ödeme sonrası yan etki başarısız',
  [OUTBOX_EVENT_TYPES.OPS_PAYMENT_SPLIT_APPROVAL_FAILED]: 'Split onayı başarısız',
};

export const sendOpsAlertEmail = async (
  eventType: string,
  payload: Record<string, unknown>
): Promise<void> => {
  const to = env.opsAlertEmail;

  if (!to) {
    log.warn({ eventType, payload }, 'OPS_ALERT_EMAIL tanımlı değil — operasyon uyarısı e-postası atlanıyor');
    return;
  }

  const label = OPS_EVENT_LABELS[eventType] ?? eventType;
  const details = Object.entries(payload)
    .map(([key, value]) => `<li><strong>${key}:</strong> ${String(value)}</li>`)
    .join('');

  await sendMail({
    to,
    subject: `[E-commerce Ops] ${label}`,
    html: `
      <h2>${label}</h2>
      <p>Manuel müdahale gerekebilir.</p>
      <ul>${details}</ul>
      <p><small>eventType: ${eventType}</small></p>
    `,
  });
};

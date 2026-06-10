import nodemailer from 'nodemailer';

const getSmtpConfig = () => {
  const host = process.env.SMTP_HOST ?? 'smtp.gmail.com';
  const port = Number(process.env.SMTP_PORT) || 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!user || !pass) {
    throw new Error('SMTP_USER ve SMTP_PASS tanımlanmamış');
  }

  return { host, port, user, pass };
};

export const createTransporter = () => {
  const { host, port, user, pass } = getSmtpConfig();

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
};

export const getMailFrom = () =>
  process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@localhost';

export const getFrontendUrl = () =>
  process.env.FRONTEND_URL || 'http://localhost:3000';

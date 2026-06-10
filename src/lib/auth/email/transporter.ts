import nodemailer from 'nodemailer';

const getSmtpConfig = () => {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host) {
    throw new Error('SMTP_HOST tanımlanmamış');
  }

  if (!process.env.SMTP_PORT || Number.isNaN(port)) {
    throw new Error('SMTP_PORT tanımlanmamış veya geçersiz');
  }

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

export const getMailFrom = () => {
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;

  if (!from) {
    throw new Error('SMTP_FROM veya SMTP_USER tanımlanmamış');
  }

  return from;
};

export const getFrontendUrl = () => {
  const frontendUrl = process.env.FRONTEND_URL;

  if (!frontendUrl) {
    throw new Error('FRONTEND_URL tanımlanmamış');
  }

  return frontendUrl;
};

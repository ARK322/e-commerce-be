import { Resend } from 'resend';
import { env } from '@/config/env';

let resendClient: Resend | null = null;

export const getResend = (): Resend => {
  if (!resendClient) {
    resendClient = new Resend(env.resendApiKey);
  }

  return resendClient;
};

export const getMailFrom = () => env.mailFrom;

export const getFrontendUrl = () => env.frontendUrl;

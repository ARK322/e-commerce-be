import { HttpError } from '@/shared/errors';

export class CommerceError extends HttpError {
  readonly details?: unknown;

  constructor(statusCode: number, message: string, details?: unknown) {
    super(statusCode, message);
    this.name = 'CommerceError';
    this.details = details;
  }
}

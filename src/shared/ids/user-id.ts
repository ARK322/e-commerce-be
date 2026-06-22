import { randomUUID } from 'node:crypto';

export const createUserId = (): string => randomUUID();

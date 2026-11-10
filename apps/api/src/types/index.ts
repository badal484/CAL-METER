/* eslint-disable @typescript-eslint/no-namespace */
import type { Logger } from 'pino';

export interface AuthenticatedUser {
  uid: string;
  email?: string;
  emailVerified?: boolean;
  name?: string;
}

declare global {
  namespace Express {
    interface Request {
      id?: string;
      user?: AuthenticatedUser;
      log?: Logger;
    }
  }
}

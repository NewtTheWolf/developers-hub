/**
 * @turbosmtp/sdk — public entry point.
 *
 * Layer 2 (curated facade). The generated Layer 1 lives under `./generated` and
 * is intentionally NOT re-exported here — only the contracted surface is public.
 */
export { TurboSMTPClient } from './client';
export type { TurboSMTPClientOptions, Region } from './client';

export { MailNamespace } from './mail';
export type { SendMessage, Attachment, SendResult } from './mail';

export {
  TurboSMTPError,
  AuthenticationError,
  BadRequestError,
  ValidationError,
  ForbiddenError,
  NotFoundError,
  RateLimitError,
  ApiError,
  NetworkError,
} from './errors';
export type { TurboSMTPErrorInit } from './errors';

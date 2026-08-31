/**
 * TurboSMTP event webhooks — parsing and authentication.
 *
 * TurboSMTP does not sign webhook requests. Authentication is HTTP Basic
 * credentials embedded in the callback URL configured in the dashboard
 * (`https://user:pass@your-host/hook`), which arrive as an `Authorization` header.
 */
import { Buffer } from 'node:buffer';
import { timingSafeEqual } from 'node:crypto';

/** Delivery-related statuses. */
export type DeliveryStatus = 'PROCESSED' | 'DELIVERED' | 'DEFERRED' | 'BOUNCED' | 'DROPPED';

/** Engagement-related statuses. */
export type EngagementStatus = 'OPENED' | 'CLICKED' | 'UNSUBSCRIBED' | 'SPAM';

/** Any known status; unknown values stay allowed so a new event type does not break parsing. */
export type EventStatus = DeliveryStatus | EngagementStatus | (string & {});

export interface TurboSMTPEvent {
  /** Message id, kept as a string — it is a 64-bit snowflake. */
  mid: string;
  email: string;
  /** Status as delivered, which is uppercase despite what the documentation shows. */
  status: EventStatus;
  timestamp: Date;
  subject?: string;
  /** Clicked URL, on `CLICKED` events. */
  url?: string;
  ip?: string;
  userAgent?: string;
  /** The `referenceId` passed at send time, echoed back. */
  referenceId?: string;
  /** The event object as received. */
  raw: Record<string, unknown>;
}

/**
 * Parse a webhook body into typed events.
 *
 * Accepts a parsed object, an array of objects, or a raw JSON string. TurboSMTP
 * sends one flat event object per request and chunks bursts across requests.
 * A parsed object whose numeric `mid` is outside JavaScript's safe integer range
 * is rejected because its original 64-bit value can no longer be recovered.
 *
 * @throws {SyntaxError} if a string body is not valid JSON.
 * @throws {Error} if an event is not an object, is missing a required field, or
 * carries an unsafe numeric `mid`.
 */
export function parseWebhookEvents(body: unknown): TurboSMTPEvent[] {
  const parsed = typeof body === 'string' ? parseBody(body) : body;
  return (Array.isArray(parsed) ? parsed : [parsed]).map(parseEvent);
}

/**
 * Verify a request's HTTP Basic credentials against the configured `user:pass` pair.
 *
 * Compares in constant time. Returns false rather than throwing for any malformed
 * or absent header, so a caller can treat the result as a plain authorization gate.
 */
export function verifyBasicAuth(authorizationHeader: string | null | undefined, secret: string): boolean {
  const header = authorizationHeader ?? '';
  const separator = header.indexOf(' ');
  if (separator === -1 || header.slice(0, separator).toLowerCase() !== 'basic') {
    return false;
  }

  const received = Buffer.from(header.slice(separator + 1));
  const expected = Buffer.from(Buffer.from(secret).toString('base64'));

  // timingSafeEqual throws on a length mismatch, so the lengths are compared first.
  return received.length === expected.length && timingSafeEqual(received, expected);
}

/**
 * `mid` and other id fields are 64-bit and would be silently rounded by JSON.parse
 * above 2^53, so a long integer literal is quoted before parsing.
 *
 * This scans rather than pattern-matches on purpose: a digit run inside a subject
 * or a URL must survive untouched, and a blind text replace would corrupt it into
 * unparseable JSON.
 */
function parseBody(text: string): unknown {
  return JSON.parse(quoteLongIntegers(text));
}

const MAX_SAFE_DIGITS = 16;

function isDigit(char: string | undefined): boolean {
  return char !== undefined && char >= '0' && char <= '9';
}

/** Quote every positive integer literal of 16+ digits that is not inside a string. */
function quoteLongIntegers(text: string): string {
  let out = '';
  let index = 0;
  let inString = false;

  while (index < text.length) {
    const char = text[index] as string;

    if (inString) {
      out += char;
      if (char === '\\') {
        // Consume the escaped character so an escaped quote does not end the string.
        out += text[index + 1] ?? '';
        index += 2;
        continue;
      }
      if (char === '"') {
        inString = false;
      }
      index += 1;
      continue;
    }

    if (char === '"') {
      inString = true;
      out += char;
      index += 1;
      continue;
    }

    if (!isDigit(char)) {
      out += char;
      index += 1;
      continue;
    }

    let end = index;
    while (isDigit(text[end])) {
      end += 1;
    }
    const digits = text.slice(index, end);
    out += isWholeNumberLiteral(out, text[end]) && digits.length >= MAX_SAFE_DIGITS ? `"${digits}"` : digits;
    index = end;
  }

  return out;
}

/**
 * True when a digit run is a standalone non-negative integer, rather than the
 * mantissa, fraction or exponent of a larger numeric literal. Quoting part of one
 * of those would produce invalid JSON.
 */
function isWholeNumberLiteral(emitted: string, next: string | undefined): boolean {
  const previous = emitted[emitted.length - 1];
  const continues = previous === '.' || previous === '-' || previous === 'e' || previous === 'E';
  const extends_ = next === '.' || next === 'e' || next === 'E';
  return !continues && !extends_;
}

function parseEvent(event: unknown): TurboSMTPEvent {
  if (!isRecord(event)) {
    throw new Error('TurboSMTP webhook event is not an object.');
  }

  const { mid, email, status } = event;
  // The delivered key is capitalised; the lowercase form is the documented one.
  const rawTimestamp = event.Timestamp ?? event.timestamp;

  if (mid == null || email == null || status == null || rawTimestamp == null) {
    throw new Error('TurboSMTP webhook event is missing required fields (mid, email, status, timestamp).');
  }

  if (typeof mid === 'number' && !Number.isSafeInteger(mid)) {
    throw new Error(
      'TurboSMTP webhook event has an unsafe numeric mid. Pass the raw JSON body or preserve mid as a string.',
    );
  }

  const seconds = Number(rawTimestamp);
  if (!Number.isFinite(seconds)) {
    throw new Error(`TurboSMTP webhook event has an invalid timestamp: ${String(rawTimestamp)}.`);
  }

  return {
    mid: String(mid),
    email: String(email),
    status: String(status),
    timestamp: new Date(seconds * 1000),
    subject: optionalString(event.subject),
    url: optionalString(event.url),
    ip: optionalString(event.ip),
    userAgent: optionalString(event.useragent),
    referenceId: optionalString(event.reference_id),
    raw: event,
  };
}

function optionalString(value: unknown): string | undefined {
  return value == null || value === '' ? undefined : String(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Typed error hierarchy for the TurboSMTP SDK (client-contract.md §3.4).
 *
 * The generated Layer 1 throws `ResponseError` (any non-2xx) and `FetchError`
 * (transport failure). Layer 2 catches those and normalizes them into this
 * single hierarchy so every SDK surfaces the same, idiomatic error taxonomy.
 */
import { FetchError, ResponseError } from './generated/src';

export interface TurboSMTPErrorInit {
  /** HTTP status code, or null when there was no HTTP response (network failure). */
  status?: number | null;
  /** The undecoded/parsed response body, when available. */
  raw?: unknown;
  /** Underlying error that caused this one (transport error, etc.). */
  cause?: unknown;
}

/** Base class for every error thrown by the SDK. */
export class TurboSMTPError extends Error {
  readonly status: number | null;
  readonly raw: unknown;

  constructor(message: string, init: TurboSMTPErrorInit = {}) {
    super(message);
    this.name = 'TurboSMTPError';
    this.status = init.status ?? null;
    this.raw = init.raw;
    if (init.cause !== undefined) {
      // `cause` is standardized on Error but keep it explicit for older targets.
      (this as { cause?: unknown }).cause = init.cause;
    }
    // Restore the prototype chain so `instanceof` works across TS/ES targets.
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** 401 — bad/missing credentials. Carries the send-specific `errorCode`/`details`. */
export class AuthenticationError extends TurboSMTPError {
  readonly errorCode?: number;
  readonly details?: string;

  constructor(message: string, init: TurboSMTPErrorInit & { errorCode?: number; details?: string } = {}) {
    super(message, init);
    this.name = 'AuthenticationError';
    this.errorCode = init.errorCode;
    this.details = init.details;
  }
}

/** 400 — malformed request. Carries the send `errors[]` array when present. */
export class BadRequestError extends TurboSMTPError {
  readonly errors?: string[];

  constructor(message: string, init: TurboSMTPErrorInit & { errors?: string[] } = {}) {
    super(message, init);
    this.name = 'BadRequestError';
    this.errors = init.errors;
  }
}

/**
 * 400 — input-validation subset of BadRequestError, when distinguishable (§3.4).
 *
 * Unreachable in P0 and deliberately so: `/mail/send` answers 400 with the
 * send-specific `{ message, errors[] }` body, which §3.4 maps to `BadRequestError`.
 * The domain 400 enums that map here arrive with the validation domain (P1).
 */
export class ValidationError extends BadRequestError {
  constructor(message: string, init: TurboSMTPErrorInit & { errors?: string[] } = {}) {
    super(message, init);
    this.name = 'ValidationError';
  }
}

/** 403 — authenticated but not permitted (e.g. plan-gated). */
export class ForbiddenError extends TurboSMTPError {
  constructor(message: string, init: TurboSMTPErrorInit = {}) {
    super(message, init);
    this.name = 'ForbiddenError';
  }
}

/** 404 — resource not found. */
export class NotFoundError extends TurboSMTPError {
  constructor(message: string, init: TurboSMTPErrorInit = {}) {
    super(message, init);
    this.name = 'NotFoundError';
  }
}

/** 429 — rate limited. Defensive: the spec omits it, but we honor `Retry-After` if returned. */
export class RateLimitError extends TurboSMTPError {
  /** Seconds to wait before retrying, parsed from the `Retry-After` header if present. */
  readonly retryAfter?: number;

  constructor(message: string, init: TurboSMTPErrorInit & { retryAfter?: number } = {}) {
    super(message, init);
    this.name = 'RateLimitError';
    this.retryAfter = init.retryAfter;
  }
}

/** Any other non-2xx / 5xx / unmapped response. */
export class ApiError extends TurboSMTPError {
  constructor(message: string, init: TurboSMTPErrorInit = {}) {
    super(message, init);
    this.name = 'ApiError';
  }
}

/** Transport-level failure (timeout, DNS, connection) — no HTTP response. */
export class NetworkError extends TurboSMTPError {
  constructor(message: string, init: TurboSMTPErrorInit = {}) {
    super(message, { ...init, status: null });
    this.name = 'NetworkError';
  }
}

// --- mapping helpers ---------------------------------------------------------

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function extractMessage(raw: unknown): string | undefined {
  if (typeof raw === 'string' && raw.length > 0) return raw;
  if (isRecord(raw) && typeof raw.message === 'string') return raw.message;
  return undefined;
}

async function readBody(response: Response): Promise<unknown> {
  let text: string;
  try {
    text = await response.text();
  } catch {
    return undefined;
  }
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function parseRetryAfter(response: Response): number | undefined {
  const header = response.headers?.get?.('Retry-After');
  if (!header) return undefined;
  const seconds = Number(header);
  return Number.isFinite(seconds) ? seconds : undefined;
}

/**
 * Normalize any error thrown by Layer 1 (or elsewhere) into a `TurboSMTPError`.
 * Async because it reads the HTTP response body to enrich the typed error.
 */
export async function toTurboSMTPError(err: unknown): Promise<TurboSMTPError> {
  if (err instanceof ResponseError) {
    const status = err.response.status;
    const raw = await readBody(err.response);
    const message = extractMessage(raw) ?? `Request failed with status ${status}`;
    const base: TurboSMTPErrorInit = { status, raw };

    switch (status) {
      case 401:
        return new AuthenticationError(message, {
          ...base,
          errorCode: isRecord(raw) && typeof raw.errorCode === 'number' ? raw.errorCode : undefined,
          details: isRecord(raw) && typeof raw.details === 'string' ? raw.details : undefined,
        });
      case 400:
        return new BadRequestError(message, {
          ...base,
          errors: isRecord(raw) && Array.isArray(raw.errors) ? (raw.errors as string[]) : undefined,
        });
      case 403:
        return new ForbiddenError(message, base);
      case 404:
        return new NotFoundError(message, base);
      case 429:
        return new RateLimitError(message, { ...base, retryAfter: parseRetryAfter(err.response) });
      default:
        return new ApiError(message, base);
    }
  }

  if (err instanceof FetchError) {
    return new NetworkError(err.message || 'The network request failed', { cause: err.cause });
  }

  if (err instanceof TurboSMTPError) return err;

  return new ApiError(err instanceof Error ? err.message : String(err), { cause: err });
}

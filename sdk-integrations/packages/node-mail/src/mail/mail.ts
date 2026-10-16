/**
 * Mail namespace — `client.mail.send(...)`.
 *
 * This is the curated Layer 2 surface: idiomatic arrays for recipients, `text`/
 * `html` bodies, a first-class `replyTo`, byte attachments (base64 is handled for
 * the developer), and a stringified `messageId`. It maps onto the generated
 * Layer 1 `MailMessage` wire model and hides the dual-auth entirely.
 */

import { TurboSMTPError, toTurboSMTPError } from '../errors';
import type {
  MailApi,
  MailMessage,
  SendSucessResponsetBody,
  Attachment as WireAttachment,
} from '../generated/src';
import {
  type Address,
  type AddressInput,
  formatAddress,
  joinAddresses,
  joinRecipients,
  rejectLineBreaks,
  senderDomain,
} from './address';
import { qualifyInlineCids } from './inline-cid';

/** A file attached to an email. `content` is raw bytes — the SDK base64-encodes it. */
export interface Attachment {
  content: Uint8Array | ArrayBuffer;
  filename: string;
  contentType: string;
  /** Optional CID for referencing an embedded image from HTML (`<img src="cid:...">`). */
  contentId?: string;
}

/** The message to send. `from` and `to` are required; everything else is optional. */
export interface SendMessage {
  from: Address;
  to: AddressInput;
  cc?: AddressInput;
  bcc?: AddressInput;
  subject?: string;
  /** Plain-text body. */
  text?: string;
  /** HTML body. */
  html?: string;
  /** Reply-To header. Supply one address: the API retains only the first in a list. */
  replyTo?: AddressInput;
  /** Additional custom headers. An explicit `replyTo` wins over a `reply-to` key here. */
  headers?: Record<string, string>;
  attachments?: Attachment[];
  /** Echoed back in the Event Webhook. */
  referenceId?: string;
  /** Campaign identifier. */
  campaignId?: string;
  /** Raw MIME that replaces `text` + `html`. */
  mimeRaw?: string;
}

/** Result of a successful send. */
export interface SendResult {
  /** The message id (`mid`), stringified — a 64-bit id is unsafe as a JS number. */
  messageId: string;
  // TODO: decide what this field is for. Established so far — it is typed with a generated
  // Layer 1 model, which is the only path by which a generated type reaches the published
  // `.d.ts`; it is populated by a cast over unparsed JSON rather than a validated parse, so
  // the type asserts a shape nothing checks; and nothing in this repository reads it. It is
  // also not part of the cross-language contract, so its type is a local choice.
  // The options are to remove it, give it a facade-owned type, or widen it to `unknown`.
  // Removing it is free before `0.2.0` is published and breaking afterwards, so this is
  // worth settling before the first release.
  /** The raw success body (`{ message, mid }`), for callers who want it. */
  raw?: SendSucessResponsetBody;
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** Base64-encode bytes without Buffer/atob — works in Node and the browser. */
function bytesToBase64(input: Uint8Array | ArrayBuffer): string {
  const bytes = input instanceof ArrayBuffer ? new Uint8Array(input) : input;
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const b2 = i + 2 < bytes.length ? bytes[i + 2] : 0;
    out += B64[b0 >> 2];
    out += B64[((b0 & 0x03) << 4) | (b1 >> 4)];
    out += i + 1 < bytes.length ? B64[((b1 & 0x0f) << 2) | (b2 >> 6)] : '=';
    out += i + 2 < bytes.length ? B64[b2 & 0x3f] : '=';
  }
  return out;
}

/**
 * Merge custom headers with an explicit `replyTo` (replyTo wins). The pairs land in
 * MIME headers verbatim, so a line break in a name or a value is header injection
 * exactly as it is in an address.
 */
function buildCustomHeaders(msg: SendMessage): { [key: string]: string } | undefined {
  const headers: { [key: string]: string } = { ...(msg.headers ?? {}) };
  for (const [name, value] of Object.entries(headers)) {
    rejectLineBreaks(name, 'A header name');
    rejectLineBreaks(value, 'A header value');
  }
  if (msg.replyTo != null) {
    // Header names are case-insensitive, so any existing spelling has to go first;
    // otherwise both survive and the message goes out with two Reply-To headers.
    for (const key of Object.keys(headers)) {
      if (key.toLowerCase() === 'reply-to') delete headers[key];
    }
    headers['reply-to'] = joinAddresses(msg.replyTo);
  }
  return Object.keys(headers).length > 0 ? headers : undefined;
}

function toWireAttachment(a: Attachment): WireAttachment {
  return {
    content: bytesToBase64(a.content),
    name: a.filename,
    type: a.contentType,
    contentId: a.contentId,
  };
}

/**
 * The HTML body with every inline `cid:` reference qualified by the sender domain.
 * Returns the body untouched when there is nothing to qualify.
 */
function toHtmlContent(msg: SendMessage): string | undefined {
  if (msg.html == null || !msg.attachments?.length) {
    return msg.html;
  }
  const ids = msg.attachments
    .map((attachment) => attachment.contentId)
    .filter((id): id is string => id != null);
  const domain = ids.length === 0 ? undefined : senderDomain(msg.from);
  return domain == null ? msg.html : qualifyInlineCids(msg.html, ids, domain);
}

/**
 * Guard a required field.
 *
 * The types mark `from` and `to` required, but the package ships CJS/ESM to
 * JavaScript callers who get no such check. Without this they fault inside
 * `formatAddress` with a `TypeError` naming an internal property, outside the
 * typed hierarchy this SDK promises. An empty `to` array is left alone: the
 * server rejects it with a 400.
 */
function required<T>(value: T | null | undefined, field: string): T {
  if (value == null) {
    throw new TurboSMTPError(`\`${field}\` is required.`);
  }
  return value;
}

/** Map the facade message onto the generated `MailMessage`. */
export function toMailMessage(msg: SendMessage): MailMessage {
  return {
    from: formatAddress(required(msg.from, 'from')),
    to: joinRecipients(required(msg.to, 'to')),
    cc: msg.cc == null ? undefined : joinRecipients(msg.cc),
    bcc: msg.bcc == null ? undefined : joinRecipients(msg.bcc),
    subject: msg.subject,
    content: msg.text,
    htmlContent: toHtmlContent(msg),
    customHeaders: buildCustomHeaders(msg),
    referenceId: msg.referenceId,
    xCampaignID: msg.campaignId,
    mimeRaw: msg.mimeRaw,
    attachments: msg.attachments?.map(toWireAttachment),
  };
}

/**
 * Extract `mid` from the raw response text as an exact digit string.
 *
 * `mid` is a 64-bit id. Layer 1 (and `JSON.parse`) coerce it to a JS `number`,
 * which silently rounds any value above 2^53 — so we must read the exact digits
 * from the untouched response text. Falls back to the parsed
 * number only if the raw scan fails.
 */
function extractMessageId(rawText: string, parsed: SendSucessResponsetBody | undefined): string {
  const match = /"mid"\s*:\s*"?(\d+)"?/.exec(rawText);
  if (match) return match[1];
  return parsed?.mid != null ? String(parsed.mid) : '';
}

export class MailNamespace {
  constructor(private readonly api: MailApi) {}

  /** Send an email. Resolves with the `messageId`; throws a typed `TurboSMTPError` on failure. */
  async send(message: SendMessage): Promise<SendResult> {
    const mailMessage = toMailMessage(message);
    try {
      // Use the raw response so we can read `mid` without losing 64-bit precision
      // (see extractMessageId). `sendEmailRaw` still throws on non-2xx.
      const apiResponse = await this.api.sendEmailRaw({ mailMessage });
      const rawText = await apiResponse.raw.text();
      let parsed: SendSucessResponsetBody | undefined;
      try {
        parsed = rawText ? (JSON.parse(rawText) as SendSucessResponsetBody) : undefined;
      } catch {
        parsed = undefined;
      }
      return { messageId: extractMessageId(rawText, parsed), raw: parsed };
    } catch (err) {
      throw await toTurboSMTPError(err);
    }
  }
}

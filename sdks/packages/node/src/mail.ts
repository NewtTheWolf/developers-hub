/**
 * Mail namespace — `client.mail.send(...)` (client-contract.md §4).
 *
 * This is the curated Layer 2 surface: idiomatic arrays for recipients, `text`/
 * `html` bodies, a first-class `replyTo`, byte attachments (base64 is handled for
 * the developer), and a stringified `messageId`. It maps onto the generated
 * Layer 1 `MailMessage` wire model (§4.2) and hides the dual-auth entirely.
 */
import {
  MailApi,
  type MailMessage,
  type Attachment as WireAttachment,
  type SendSucessResponsetBody,
} from './generated/src';
import { toTurboSMTPError } from './errors';

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
  from: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject?: string;
  /** Plain-text body. */
  text?: string;
  /** HTML body. */
  html?: string;
  /** First-class Reply-To; injected as the `reply-to` custom header. */
  replyTo?: string;
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

/** Array of addresses → comma-joined CSV string (undefined stays undefined). */
function joinAddrs(addrs?: string[]): string | undefined {
  return addrs == null ? undefined : addrs.join(',');
}

/** Merge custom headers with an explicit `replyTo` (replyTo wins). */
function buildCustomHeaders(msg: SendMessage): { [key: string]: string } | undefined {
  const headers: { [key: string]: string } = { ...(msg.headers ?? {}) };
  if (msg.replyTo != null) headers['reply-to'] = msg.replyTo;
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

/** Map the facade message onto the generated `MailMessage` (§4.2). */
export function toMailMessage(msg: SendMessage): MailMessage {
  return {
    from: msg.from,
    // `to` is required on the wire; if a caller omits it the server returns 400.
    to: joinAddrs(msg.to) as string,
    cc: joinAddrs(msg.cc),
    bcc: joinAddrs(msg.bcc),
    subject: msg.subject,
    content: msg.text,
    htmlContent: msg.html,
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
 * from the untouched response text (contract §4.3). Falls back to the parsed
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

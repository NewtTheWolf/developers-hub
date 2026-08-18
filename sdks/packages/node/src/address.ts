/**
 * Address types and formatting (client-contract.md §4.1).
 */
import { TurboSMTPError } from './errors';

/** An email address with an optional display name. */
export interface AddressObject {
  address: string;
  name?: string;
}

/** A pre-formatted string (`user@example.com`, `Name <user@example.com>`) or a structured address. */
export type Address = string | AddressObject;

/** One address or several. */
export type AddressInput = Address | Address[];

/** RFC 5322 §3.2.3 specials, which force a display name to be a quoted string. */
const SPECIALS = /[(),.:;<>@[\]"\\]/;

/**
 * A CR or LF anywhere in an address would be carried into a MIME header by the API,
 * letting caller-supplied text inject headers of its own. Quoting does not neutralise
 * it, so it is rejected outright at this boundary.
 */
function rejectLineBreaks(value: string, field: string): string {
  if (/[\r\n]/.test(value)) {
    throw new TurboSMTPError(`An address ${field} must not contain a line break.`);
  }
  return value;
}

/** Format one address. A string is trusted verbatim — the caller owns its formatting. */
export function formatAddress(address: Address): string {
  if (typeof address === 'string') {
    return rejectLineBreaks(address, 'string');
  }
  rejectLineBreaks(address.address, 'address');
  if (!address.name) {
    return address.address;
  }
  rejectLineBreaks(address.name, 'display name');
  // An unquoted comma in a display name would split into bogus recipients downstream.
  const name = SPECIALS.test(address.name) ? `"${address.name.replace(/(["\\])/g, '\\$1')}"` : address.name;
  return `${name} <${address.address}>`;
}

/** Format one or more addresses into the comma-separated form the API expects. */
export function joinAddresses(input: AddressInput): string {
  return (Array.isArray(input) ? input : [input]).map(formatAddress).join(',');
}

/**
 * Join a recipient list (`to`, `cc`, `bcc`).
 *
 * Live-verified: the API splits these fields on commas *before* it parses RFC 5322
 * quoted strings, so a comma inside a display name is torn apart and the send is
 * rejected with `'"Doe' 'to' email not valid`. Quoting cannot prevent it, so the
 * comma is refused here where the message can name the field and the fix.
 * `from` and `reply-to` are unaffected — neither is comma-split.
 */
export function joinRecipients(input: AddressInput, field: string): string {
  return (Array.isArray(input) ? input : [input])
    .map((address) => {
      const formatted = formatAddress(address);
      if (formatted.includes(',')) {
        throw new TurboSMTPError(
          `A comma in a display name cannot be sent in \`${field}\`, because TurboSMTP splits ` +
            'recipient lists on commas before parsing quoted names. Remove the comma or drop the ' +
            `display name for this recipient: ${formatted}`,
        );
      }
      return formatted;
    })
    .join(',');
}

/** The domain of a sender address, used to qualify inline Content-IDs. */
export function senderDomain(from: Address): string | undefined {
  const raw = typeof from === 'string' ? from : from.address;
  const at = raw.lastIndexOf('@');
  if (at < 0) {
    return undefined;
  }
  return (
    raw
      .slice(at + 1)
      .replace(/[>\s].*$/, '')
      .trim() || undefined
  );
}

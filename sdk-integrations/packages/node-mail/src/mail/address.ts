/**
 * Address types and formatting.
 */
import { TurboSMTPError } from '../errors';

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
 * A CR or LF in an address or a custom header would be carried into a MIME header by
 * the API, letting caller-supplied text inject headers of its own. Quoting does not
 * neutralise it, so it is rejected outright at this boundary.
 */
export function rejectLineBreaks(value: string, what: string): string {
  if (/[\r\n]/.test(value)) {
    throw new TurboSMTPError(`${what} must not contain a line break.`);
  }
  return value;
}

/** Format one address. A string is trusted verbatim — the caller owns its formatting. */
export function formatAddress(address: Address): string {
  if (typeof address === 'string') {
    return rejectLineBreaks(address, 'An address');
  }
  rejectLineBreaks(address.address, 'An address');
  if (!address.name) {
    return address.address;
  }
  rejectLineBreaks(address.name, 'A display name');
  // An unquoted comma in a display name would split into bogus recipients downstream.
  const name = SPECIALS.test(address.name) ? `"${address.name.replace(/(["\\])/g, '\\$1')}"` : address.name;
  return `${name} <${address.address}>`;
}

/** Format one or more addresses into the comma-separated form the API expects. */
export function joinAddresses(input: AddressInput): string {
  return (Array.isArray(input) ? input : [input]).map(formatAddress).join(',');
}

/** RFC 2047 encoded words avoid the API's premature comma-splitting of recipients. */
function encodeDisplayName(name: string): string {
  const encoder = new TextEncoder();
  const chunks: string[] = [];
  let chunk = '';
  let byteLength = 0;
  for (const character of name) {
    const size = encoder.encode(character).length;
    // 45 bytes encode to 60 characters, leaving room for the wrapper within 75.
    // Split between code points so every encoded word is valid UTF-8 on its own.
    if (byteLength + size > 45) {
      chunks.push(chunk);
      chunk = '';
      byteLength = 0;
    }
    chunk += character;
    byteLength += size;
  }
  if (chunk) chunks.push(chunk);
  return chunks.map((part) => `=?UTF-8?B?${btoa(String.fromCharCode(...encoder.encode(part)))}?=`).join(' ');
}

/** Join recipients, encoding structured comma names; pre-formatted strings stay verbatim. */
export function joinRecipients(input: AddressInput): string {
  return (Array.isArray(input) ? input : [input])
    .map((address) => {
      if (typeof address !== 'string' && address.name?.includes(',')) {
        const name = rejectLineBreaks(address.name, 'A display name');
        const email = rejectLineBreaks(address.address, 'An address');
        return `${encodeDisplayName(name)} <${email}>`;
      }
      return formatAddress(address);
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

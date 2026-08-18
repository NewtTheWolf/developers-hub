/**
 * TurboSMTPClient — the unified entry point (client-contract.md §3.1, §3.2, §3.2b).
 *
 * P0 exposes the `mail` namespace only. Authentication is hidden: the developer
 * supplies a consumerKey/consumerSecret pair and the SDK attaches both headers on
 * every request. `Authorization` is never sent (POST /mail/send rejects it). The
 * `region` option selects the send host; no other host varies in P0.
 */

import { TurboSMTPError } from './errors';
import { Configuration, MailApi } from './generated/src';
import { MailNamespace } from './mail';

/** Sending region — selects the `/mail/send` host. */
export type Region = 'global' | 'eu';

export interface TurboSMTPClientOptions {
  /** Consumer key (required). */
  consumerKey: string;
  /** Consumer secret (required). */
  consumerSecret: string;
  /** Sending region. Default `"global"`. `"eu"` routes to EU sending infrastructure. */
  region?: Region;
  /**
   * Custom fetch implementation. Primarily a test seam (inject a fake to assert
   * the serialized request or to return canned responses); also allows a custom
   * transport. Defaults to the global `fetch`.
   */
  fetchApi?: typeof fetch;
  /** Extra default headers merged into every request (escape hatch). */
  headers?: Record<string, string>;
}

/** `/mail/send` hosts by region (client-contract.md §3.2b). */
const SEND_HOSTS: Record<Region, string> = {
  global: 'https://api.turbo-smtp.com/api/v2',
  eu: 'https://api.eu.turbo-smtp.com/api/v2',
};

export class TurboSMTPClient {
  /** The mail namespace — `client.mail.send(...)`. */
  readonly mail: MailNamespace;

  constructor(options: TurboSMTPClientOptions) {
    if (!options?.consumerKey || !options.consumerSecret) {
      throw new TurboSMTPError('TurboSMTPClient requires both `consumerKey` and `consumerSecret`.');
    }

    const region: Region = options.region ?? 'global';
    // A JS caller gets no type checking, and an unknown region would leave basePath
    // undefined — the generated layer then falls back to a host that does not serve
    // /mail/send, so every send would fail opaquely instead of here.
    if (!(region in SEND_HOSTS)) {
      throw new TurboSMTPError(
        `Unknown region "${region}". Expected one of: ${Object.keys(SEND_HOSTS).join(', ')}.`,
      );
    }

    // Consumer credentials go on `headers` (sent on every request); `apiKey` is
    // deliberately left unset so Layer 1 never emits an `Authorization` header.
    const configuration = new Configuration({
      basePath: SEND_HOSTS[region],
      fetchApi: options.fetchApi,
      headers: {
        consumerKey: options.consumerKey,
        consumerSecret: options.consumerSecret,
        ...(options.headers ?? {}),
      },
    });

    this.mail = new MailNamespace(new MailApi(configuration));
  }
}

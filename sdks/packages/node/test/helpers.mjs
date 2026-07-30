/**
 * Test helpers for the P0 Mail conformance suite (client-contract.md §3.3).
 *
 * Tests drive the facade through an injected `fetchApi` (the same seam the SDK
 * exposes for custom transports). This keeps the suite credential-free and
 * offline — it asserts what the SDK serializes onto the wire and how it maps
 * responses, with no live calls. The Prism mock harness (TASKS.md 4.2) layers
 * on top of the same scenarios later.
 */

/**
 * A fake `fetch` that records every call and returns a scripted response.
 * @param {number} status HTTP status to return.
 * @param {object|string} body Response body — an object is JSON.stringify'd; a
 *   string is sent verbatim (use this to carry exact 64-bit digits that a JS
 *   number literal would round).
 * @param {Record<string,string>} [headers] Extra response headers.
 */
export function makeFetch(status, body, headers = {}) {
  const calls = [];
  const fn = async (url, init) => {
    calls.push({ url, init });
    const text = typeof body === 'string' ? body : JSON.stringify(body);
    return new Response(text, {
      status,
      headers: { 'Content-Type': 'application/json', ...headers },
    });
  };
  fn.calls = calls;
  return fn;
}

/** A fake `fetch` that throws — simulates a transport/network failure. */
export function makeThrowingFetch(error = new Error('connection refused')) {
  const fn = async () => {
    throw error;
  };
  return fn;
}

const last = (fetchFn) => fetchFn.calls[fetchFn.calls.length - 1];

/** Parsed JSON body of the last request. */
export const lastBody = (fetchFn) => JSON.parse(last(fetchFn).init.body);
/** Headers object of the last request. */
export const lastHeaders = (fetchFn) => last(fetchFn).init.headers;
/** URL of the last request. */
export const lastUrl = (fetchFn) => last(fetchFn).url;

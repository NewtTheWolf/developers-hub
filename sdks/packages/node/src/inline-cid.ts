/**
 * Inline image references (client-contract.md §4.5).
 *
 * TurboSMTP composes an inline part's Content-ID as `<content_id@sender-domain>`,
 * so a bare `<img src="cid:logo">` reference never matches and the image is
 * delivered as a plain attachment instead of rendering inline.
 */

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Append `domain` to every bare `cid:` reference naming one of `contentIds`. */
export function qualifyInlineCids(html: string, contentIds: readonly string[], domain: string): string {
  let out = html;
  for (const id of contentIds) {
    if (!id || id.includes('@')) {
      continue;
    }
    // The lookahead keeps `cid:logo` from matching inside `cid:logo2`. A function
    // replacement is required because `$&` and friends are special in a string one.
    out = out.replace(new RegExp(`cid:${escapeRegExp(id)}(?![\\w.@-])`, 'g'), () => `cid:${id}@${domain}`);
  }
  return out;
}

/**
 * De-duplicate by a derived key (case-insensitive, trimmed). Drops items whose
 * key is empty. Used at the company, prospect, and email levels.
 *
 * @template T
 * @param {T[]} items
 * @param {(item: T) => string|undefined} keyFn
 * @returns {T[]}
 */
export function dedupeBy(items, keyFn) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const key = (keyFn(item) || '').toLowerCase().trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

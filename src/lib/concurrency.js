/**
 * Run an async fn over items with a max concurrency, preserving order.
 * A single rejection is captured as { error } instead of aborting the batch —
 * this is what makes the pipeline resilient to one bad company/contact.
 *
 * @template T, R
 * @param {T[]} items
 * @param {number} limit
 * @param {(item: T, index: number) => Promise<R>} fn
 * @returns {Promise<Array<{ value?: R, error?: Error, item: T }>>}
 */
export async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let cursor = 0;

  const worker = async () => {
    while (cursor < items.length) {
      const i = cursor++;
      try {
        results[i] = { value: await fn(items[i], i), item: items[i] };
      } catch (error) {
        results[i] = { error, item: items[i] };
      }
    }
  };

  const n = Math.max(1, Math.min(limit, items.length));
  await Promise.all(Array.from({ length: n }, worker));
  return results;
}

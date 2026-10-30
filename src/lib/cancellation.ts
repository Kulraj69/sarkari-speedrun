/** Stop waiting even when an injected transport ignores AbortSignal. */
export async function abortable<T>(work: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return work;
  if (signal.aborted) {
    // The caller may already have started work; consume any later rejection.
    void work.catch(() => {});
    throw signal.reason;
  }
  let onAbort: () => void = () => {};
  const aborted = new Promise<never>((_resolve, reject) => {
    onAbort = () => reject(signal.reason);
    signal.addEventListener("abort", onAbort, { once: true });
  });
  try {
    return await Promise.race([work, aborted]);
  } finally {
    signal.removeEventListener("abort", onAbort);
  }
}

export function scopedFetch(fetchImpl: typeof fetch, signal: AbortSignal): typeof fetch {
  return async (input, init) => {
    signal.throwIfAborted();
    const localSignal = init?.signal ?? (input instanceof Request ? input.signal : undefined);
    const combined = localSignal ? AbortSignal.any([signal, localSignal]) : signal;
    combined.throwIfAborted();
    const response = await abortable(fetchImpl(input, { ...init, signal: combined }), combined);
    const readJson = response.json.bind(response);
    response.json = () => {
      combined.throwIfAborted();
      return abortable(readJson(), combined);
    };
    return response;
  };
}

/** One active request per mounted UI; timeout does not revoke error ownership. */
export function createRequestOwner() {
  let active: { controller: AbortController; timer: ReturnType<typeof setTimeout> } | null = null;
  function cancel() {
    const previous = active;
    active = null;
    if (previous) {
      clearTimeout(previous.timer);
      previous.controller.abort(new Error("The request was cancelled."));
    }
  }
  return {
    cancel,
    start(timeoutMs: number) {
      cancel();
      const controller = new AbortController();
      const request = {
        controller,
        timer: setTimeout(() => controller.abort(new Error("The request timed out.")), timeoutMs),
      };
      active = request;
      return {
        signal: controller.signal,
        isCurrent: () => active === request,
        finish() {
          clearTimeout(request.timer);
          if (active === request) active = null;
        },
      };
    },
  };
}

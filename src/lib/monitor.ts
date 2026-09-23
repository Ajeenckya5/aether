/** Lazy monitoring. Does nothing unless NEXT_PUBLIC_SENTRY_DSN is set at build time. */
export function startMonitoring(): void {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn || typeof window === "undefined") return;
  void import("@sentry/browser").then((Sentry) => {
    Sentry.init({
      dsn,
      sendDefaultPii: false,
      tracesSampleRate: 0.05,
      beforeSend(event) {
        if (event.request) {
          delete event.request.cookies;
          delete event.request.headers;
          delete event.request.data;
        }
        if (event.user) event.user = { id: event.user.id };
        return event;
      },
    });
  });
}

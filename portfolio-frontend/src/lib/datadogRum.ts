/**
 * Datadog Browser RUM — end-to-end trace stitching (browser → API GW → Lambda → MongoDB).
 *
 * Initialized once at app boot from main.tsx. No-ops when env vars are missing,
 * which keeps local dev and preview builds quiet (no events shipped, no errors).
 *
 * Config notes:
 *  • clientToken is a public write-only token — safe to ship in the bundle.
 *  • allowedTracingUrls injects x-datadog-* + traceparent headers into fetch/XHR
 *    calls to api.manneharshithsiddardha.com so backend Lambda spans link to
 *    the RUM session resource.
 *  • sessionReplaySampleRate is 0 because Session Replay is a paid feature
 *    above the free tier — flip up later if you upgrade.
 */
import { datadogRum } from "@datadog/browser-rum";

let initialized = false;

export function initDatadogRum(): void {
  if (initialized) return;
  if (typeof window === "undefined") return;

  const applicationId = import.meta.env.VITE_DD_RUM_APPLICATION_ID;
  const clientToken = import.meta.env.VITE_DD_RUM_CLIENT_TOKEN;
  const site = import.meta.env.VITE_DD_RUM_SITE ?? "datadoghq.com";
  const env = import.meta.env.VITE_DD_RUM_ENV ?? "prod";
  const version = import.meta.env.VITE_DD_RUM_VERSION ?? "unknown";

  if (!applicationId || !clientToken) {
    // Local dev or build without the secrets — stay silent.
    return;
  }

  datadogRum.init({
    applicationId,
    clientToken,
    site,
    service: "portfolio-frontend",
    env,
    version,
    sessionSampleRate: 100,
    sessionReplaySampleRate: 0,
    trackUserInteractions: true,
    trackResources: true,
    trackLongTasks: true,
    defaultPrivacyLevel: "mask-user-input",
    allowedTracingUrls: [
      // Stitch RUM session → backend APM trace for any API call to our domain.
      (url) => url.startsWith("https://manneharshithsiddardha.com/api"),
      (url) => url.startsWith("https://www.manneharshithsiddardha.com/api"),
    ],
    traceSampleRate: 100,
    // Send both Datadog headers and the W3C standard so any upstream is happy.
    // ddtrace on the Lambda side accepts both.
    traceContextInjection: "all",
  });

  initialized = true;
}

export { datadogRum };

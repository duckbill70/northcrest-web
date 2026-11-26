// Real-user monitoring: traces for page loads and API calls, plus the Core
// Web Vitals, sent over OTLP/HTTP to the platform's public edge collector.
//
// The edge accepts only northcrest-* services and only the metrics
// northcrest.web.lcp, .inp and .cls, so nothing else is sent. API calls are
// same-origin (/api/** through Hosting), so the fetch instrumentation adds
// a traceparent header and each browser span joins the Cloud Run trace.
//
// Off unless VITE_OTEL_EDGE_URL is set at build time.

import { context, metrics, propagation, trace, type Attributes } from "@opentelemetry/api";
import { W3CTraceContextPropagator } from "@opentelemetry/core";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { registerInstrumentations } from "@opentelemetry/instrumentation";
import { DocumentLoadInstrumentation } from "@opentelemetry/instrumentation-document-load";
import { FetchInstrumentation } from "@opentelemetry/instrumentation-fetch";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { MeterProvider, PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import {
  BatchSpanProcessor,
  ParentBasedSampler,
  StackContextManager,
  TraceIdRatioBasedSampler,
  TracerProvider,
  type ReadableSpan,
  type SpanExporter,
} from "@opentelemetry/sdk-trace";
import { onCLS, onINP, onLCP, type Metric } from "web-vitals";

export interface RumOptions {
  /** northcrest-booking-web or northcrest-status-web. */
  service: string;
  /** Edge collector base URL, without /v1/... */
  edgeUrl?: string;
  /** Fraction of page views traced, 0 to 1. Web vitals are always sent. */
  sampleRatio?: number;
}

/** Strip query strings (they can hold a PNR or surname) and IDs from a URL. */
export function scrubUrl(raw: string, base = "https://example.invalid"): string {
  const url = new URL(raw, base);
  const path = url.pathname.replace(/\/[A-Z0-9]{6}(?=\/|$)/g, "/:pnr").replace(/\/NC\d{3,4}(?=\/|$)/gi, "/:flight");
  return `${url.origin}${path}`;
}

/** Route template for a page, so vitals group by page rather than by URL. */
export function pageRoute(pathname: string): string {
  return pathname.replace(/\/+$/, "") || "/";
}

const URL_KEYS = ["url.full", "http.url", "url.query"];

/**
 * Scrubs URLs on every span just before export, whichever instrumentation
 * set them (document-load records the page URL, which can carry ?pnr=).
 */
class ScrubbingExporter implements SpanExporter {
  constructor(private readonly inner: SpanExporter) {}
  export(spans: ReadableSpan[], done: Parameters<SpanExporter["export"]>[1]) {
    for (const span of spans) {
      const attrs = span.attributes as Record<string, unknown>;
      for (const key of URL_KEYS) {
        if (typeof attrs[key] !== "string") continue;
        if (key === "url.query") delete attrs[key];
        else attrs[key] = scrubUrl(attrs[key] as string);
      }
    }
    this.inner.export(spans, done);
  }
  shutdown() {
    return this.inner.shutdown();
  }
  forceFlush() {
    return this.inner.forceFlush?.() ?? Promise.resolve();
  }
}

let started = false;

export function startRum({ service, edgeUrl, sampleRatio = 1 }: RumOptions): boolean {
  if (started || !edgeUrl) return false;
  started = true;
  const base = edgeUrl.replace(/\/+$/, "");

  const resource = resourceFromAttributes({
    "service.name": service,
    "service.version": import.meta.env.VITE_RELEASE ?? "dev",
    "deployment.environment.name": import.meta.env.MODE === "development" ? "development" : "production",
    "telemetry.sdk.language": "webjs",
    // Browsers driven by automation (the scheduled Playwright journeys)
    // report navigator.webdriver; mark their telemetry so dashboards can
    // split real users from synthetic checks.
    ...(navigator.webdriver ? { "user_agent.synthetic.type": "test" } : {}),
  });

  const provider = new TracerProvider({
    resource,
    sampler: new ParentBasedSampler({ root: new TraceIdRatioBasedSampler(sampleRatio) }),
    spanProcessors: [new BatchSpanProcessor({ exporter: new ScrubbingExporter(new OTLPTraceExporter({ url: `${base}/v1/traces` })) })],
  });
  trace.setGlobalTracerProvider(provider);
  context.setGlobalContextManager(new StackContextManager().enable());
  propagation.setGlobalPropagator(new W3CTraceContextPropagator());

  registerInstrumentations({
    tracerProvider: provider,
    instrumentations: [
      new DocumentLoadInstrumentation(),
      new FetchInstrumentation({
        // Never trace the exporter's own requests.
        ignoreUrls: [new RegExp(`^${base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`)],
        // shared/api.ts always passes a Request, so the URL is known here.
        requestHook: (span, request) => {
          if (!(request instanceof Request)) return;
          const url = scrubUrl(request.url);
          span.setAttribute("url.full", url);
          span.updateName(`${request.method} ${new URL(url).pathname}`);
        },
      }),
    ],
  });

  const meterProvider = new MeterProvider({
    resource,
    readers: [
      new PeriodicExportingMetricReader({
        exporter: new OTLPMetricExporter({ url: `${base}/v1/metrics` }),
        exportIntervalMillis: 15_000,
      }),
    ],
  });
  metrics.setGlobalMeterProvider(meterProvider);
  recordWebVitals(meterProvider);

  // Flush when the tab is hidden: the last chance to send before it closes.
  const flush = () => {
    void provider.forceFlush();
    void meterProvider.forceFlush();
  };
  addEventListener("visibilitychange", () => document.visibilityState === "hidden" && flush());
  addEventListener("pagehide", flush);
  return true;
}

function recordWebVitals(meterProvider: MeterProvider) {
  const meter = meterProvider.getMeter("northcrest-web-vitals");
  const lcp = meter.createHistogram("northcrest.web.lcp", {
    unit: "ms",
    description: "Largest Contentful Paint",
    advice: { explicitBucketBoundaries: [500, 1000, 1500, 2000, 2500, 3000, 4000, 6000, 10000] },
  });
  const inp = meter.createHistogram("northcrest.web.inp", {
    unit: "ms",
    description: "Interaction to Next Paint",
    advice: { explicitBucketBoundaries: [50, 100, 200, 300, 500, 750, 1000, 2000] },
  });
  const cls = meter.createHistogram("northcrest.web.cls", {
    unit: "1",
    description: "Cumulative Layout Shift",
    advice: { explicitBucketBoundaries: [0.01, 0.05, 0.1, 0.15, 0.25, 0.5, 1] },
  });

  const attrs = (m: Metric): Attributes => ({
    "northcrest.page": pageRoute(location.pathname),
    "northcrest.vital_rating": m.rating,
    "northcrest.navigation_type": m.navigationType,
  });
  onLCP((m) => lcp.record(m.value, attrs(m)));
  onINP((m) => inp.record(m.value, attrs(m)));
  onCLS((m) => cls.record(m.value, attrs(m)));
}

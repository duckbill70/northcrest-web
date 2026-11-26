/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_OTEL_EDGE_URL?: string;
  readonly VITE_OTEL_SAMPLE_RATIO?: string;
  readonly VITE_RELEASE?: string;
}

declare const __APP__: "booking" | "status";

interface ImportMetaEnv {
  readonly VITE_STATUS_URL?: string;
  readonly VITE_BOOKING_URL?: string;
}

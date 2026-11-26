# northcrest-web

Passenger web apps for Northcrest Air, a fictional airline used to demonstrate
monitoring on Google Cloud. Two React apps, each on its own Firebase Hosting
site:

| App | Site | API behind `/api/**` |
| --- | --- | --- |
| Booking: search, book, manage and cancel | `https://<prefix>-booking.web.app` | `booking-api` on Cloud Run |
| Flight status: departures and arrivals boards, single-flight lookup | `https://<prefix>-status.web.app` | `flight-status-api` on Cloud Run |

The APIs live in [northcrest-services](https://github.com/duckbill70/northcrest-services)
and the platform in [northcrest-platform](https://github.com/duckbill70/northcrest-platform).
Hosting rewrites `/api/**` to Cloud Run, so the browser only ever talks to
its own origin: no CORS, and no Cloud Run URL to advertise.

## Real-user monitoring

`shared/rum.ts` sends OpenTelemetry data from the browser to the platform's
public edge collector over OTLP/HTTP:

- **Traces** for page loads and every API call. User actions ("search
  flights", "create booking", "load board") get their own span, and the
  `traceparent` header carries the trace into Cloud Run, so one trace runs
  from the click to Firestore.
- **Core Web Vitals** as histograms `northcrest.web.lcp`, `.inp` and `.cls`,
  by page. These are the only metric names the edge accepts from browsers.
- **Privacy.** URLs lose their query strings, and booking references and
  flight numbers in paths become `:pnr` and `:flight`, before anything leaves
  the browser. Names and emails are never put on telemetry.

It is off unless `VITE_OTEL_EDGE_URL` is set at build time.

## Working on it

```sh
npm ci
npm run dev:booking   # http://localhost:5173, proxies /api to localhost:8080
npm run dev:status    # http://localhost:5174, proxies /api to localhost:8081
npm run typecheck && npm test && npm run build
```

Run the APIs from northcrest-services on ports 8080 and 8081, or point the
proxy elsewhere with `API_URL`.

## Deploying

Every push to `main` builds both apps and deploys them to Firebase Hosting.
Pull requests run CI only. Deploy the APIs first: Hosting refuses rewrites
to Cloud Run services that don't exist yet.

### One-time setup

1. **Repository variables** (Settings > Secrets and variables > Actions >
   Variables), from `terraform output passenger` in northcrest-platform's
   `org/`:

   | Variable | From the output |
   | --- | --- |
   | `GCP_WIF_PROVIDER` | `wif_provider` |
   | `GCP_DEPLOY_SA` | `deploy_accounts.web` |
   | `GCP_PROJECT` | `project` |
   | `BOOKING_SITE` | `hosting_sites.booking` |
   | `STATUS_SITE` | `hosting_sites.status` |
   | `OTEL_EDGE_URL` | `otel_edge_url` |
   | `OTEL_SAMPLE_RATIO` (optional) | share of page views traced, default `1` |

   The deploy workflow skips itself until `GCP_WIF_PROVIDER` is set.

2. **A `production` environment** (Settings > Environments) whose
   deployment branches are limited to `main`. The deploy account trusts only
   jobs in this environment, so a workflow added in a pull request can't
   deploy.

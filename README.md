# IVYHUTS Market Insight

Standalone deployment of the **Daily Sold-Out Market Intelligence** dashboard
(the `/insight` page), extracted from the main `ivyhuts-website` repo so it can
run as its own Cloudflare Worker on its own domain (`insight.ivyhuts.com`).

It is the same code, unchanged:

- **Frontend** — `src/pages/insight/*` served at `/insight`, plus a small
  public, with no login screen.
- **Backend** — `api/insights/*` (dashboard endpoints + the daily digest and
  crawl-keeper jobs) and `api/auth/*` (login/logout/me/signup), sharing the
  same `api/_lib/*` support code as the main app.

---

## How it fits together

| Concern | Where | Notes |
| --- | --- | --- |
| Snapshot history | MongoDB `insightsnapshots` collection | One document per IST calendar day. Upserted by date. |
| CRM "overview" numbers | MongoDB `leads` / `enquiries` / `users` | Read-only. Empty if you don't share the main app's DB. |
| Amber catalog crawl state, locks | MongoDB `kvstore` collection (`insights:marketCrawl:*`) | Also feeds the main site's search/location index, since both apps share the DB. |
| Login credentials, sessions, rate limits | MongoDB `kvstore` collection (`user:*`, `session:*`, `auth:*`) | Same store the main app's auth uses. Requires `SHARED_STORE=mongo`. |
| Who may open the dashboard | Anyone with the link | No login. |
| Daily 08:00 IST report email | Resend | Snapshot is still stored if email fails. |

**This build is meant to point at the SAME MongoDB as the main app, with
`SHARED_STORE=mongo` set in both.** That gives you full history from day one, a working overview tab,
and keeps the main site's search index warm. See `.env.example`.

---

## Local development

```bash
npm install
cp .env.example .env.local     # then fill in the values
npm start
```

`npm start` runs the CRA dev server **and** `scripts/local-api-server.js`
together (the local server runs the real `api/_lib/routes/**` handlers on
port 3001; the CRA dev server proxies `/api/*` to it — see
`src/setupProxy.js`).

Open http://localhost:3000 → redirects to `/insight`.

**The dashboard is public.** Anyone with the link can see the market data and
the CRM totals (see `api/_lib/insightsDevAuth.js`). The `/api/auth/*` routes
still exist but the app no longer calls them.

---

## Deploying to Cloudflare Workers

One Worker (`worker/index.js`, `wrangler.jsonc`) serves the React build and
sends `/api/*` to a single Durable Object, which keeps the MongoDB connection
open between requests.

**Free plan:** not yet confirmed. Password hashing and the crawl use more than
the 10 ms of CPU a plain Worker gets on Free; whether the Durable Object gets
more there is only provable on a real deployment. After deploying, test a login
and one crawl run; an "exceeded CPU" error means the Paid plan is needed.

```bash
npm run preview                    # build + wrangler dev (uses the real database)
npx wrangler login
npm run deploy                     # build + wrangler deploy
npx wrangler secret put NAME       # once per secret
```

**Secrets** (names in `.env.example`): `MONGODB_URI`, `SHARED_STORE` (`mongo`),
`CRON_SECRET`, `RESEND_API_KEY`, `RESEND_FROM`, `INSIGHTS_REPORT_RECIPIENTS`,
`SITE_URL`, `AMBER_MAX_REQUESTS_PER_MINUTE`, `AMBER_FETCH_TIMEOUT_MS`,
`AUTH_SESSION_TTL_SECONDS`. There are no `REACT_APP_*` build variables.

**Domain:** Cloudflare dashboard → Workers & Pages → `market-insight` →
Settings → Domains & Routes → add custom domain `insight.ivyhuts.com`.

### Cron jobs (cron-job.org)

Cloudflare Cron Triggers are off. Both jobs are `GET` requests with the header
`Authorization: Bearer <CRON_SECRET>`.

| Job | URL | Schedule |
| --- | --- | --- |
| Crawl keeper | `https://insight.ivyhuts.com/api/insights/advance-crawl` | every 5 minutes |
| Daily digest | `https://insight.ivyhuts.com/api/insights/daily-digest` | 02:30 UTC (08:00 IST) |

The main site's search depends on the crawl: it must run at least every 26 hours.
**Run the crawl keeper in one place only** (here or in the main app).

## After you've verified this works

Then, in the **main `ivyhuts-website` repo**, remove the now-duplicated
feature:

- `src/pages/insight/`, `src/services/insightsApi.js`, the `/insight` route in
  `src/App.js`
- `api/insights/`, and `api/_lib/routes/insights*`
- insight-only libs: `insightsDigest.js`, `insightsSnapshotStore.js`,
  `insightsCrm.js`, `insightsDevAuth.js`, `models/InsightSnapshot.js`
- the `crons` entry in `vercel.json`

**Keep** `insightsMarket.js`, `amberGateway.js`, `sharedStore.js`,
`inventoryStats.js`, `accommodationIndex.js` and the shared models — the main
site's `/api/search` and accommodation index still depend on them.

---

## File map

```
api/
  insights/[[...path]].js      dispatcher -> api/_lib/routes/insights/*
  auth/[[...path]].js          dispatcher -> api/_lib/routes/auth/*
  _lib/                        shared handlers, models, gateways (unchanged copies)
src/
  pages/insight/               the dashboard (unchanged copy)
  services/insightsApi.js      dashboard fetch client (unchanged copy)
  data/destinations.js         filter-bar country/city list (unchanged copy)
  styles/global.css            brand tokens the theme is built on (unchanged copy)
  App.js, index.js             standalone app shell (new)
  setupProxy.js                dev-only /api proxy (new)
scripts/
  start-local.js               `npm start` orchestrator (unchanged copy)
  local-api-server.js          local API server, trimmed to insights + auth (new)
  create-internal-user.js      provisioning helper (new)
worker/index.js                Cloudflare Worker + API Durable Object
wrangler.jsonc                 Worker + static assets config
public/_headers                security headers for static files
vercel.json                    old Vercel config (unused on Cloudflare)
```
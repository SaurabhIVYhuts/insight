# IVYHUTS Market Insight

Standalone deployment of the **Daily Sold-Out Market Intelligence** dashboard
(the `/insight` page), extracted from the main `ivyhuts-website` repo so it can
run as its own Cloudflare Worker on its own domain (`insight.ivyhuts.com`).

It is the same code, unchanged:

- **Frontend** — `src/pages/insight/*` served at `/insight`, plus a small
  standalone `/login` screen.
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
| Role check (who may open the dashboard) | MongoDB `User.role` ∈ `MARKETING_AGENT` / `MARKETING_MANAGER` / `ADMIN` | Enforced server-side on every `/api/insights/*` data call. |
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

Open http://localhost:3000 → redirects to `/insight` → redirects to `/login`
until you have a session.

### Getting an account

If your `.env.local` points at the main app's Mongo with `SHARED_STORE=mongo`,
any existing internal account works — just sign in at `/login`.

Otherwise, create one:

```bash
npm run create-internal-user -- \
  --email you@ivyhuts.com --password 'a-strong-password' \
  --name "Your Name" --phone 9876543210 --role ADMIN
```

(You can also sign up through the `/login` form and then run the same command
without `--password` to promote that account — actually the command needs a
password only when it has to create the login credentials; for an
already-signed-up account any placeholder is ignored once it sees the login
already exists.)

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

## Auth across `*.ivyhuts.com` (optional)

Out of the box this app has its own `/login`. If you'd rather the main site's
existing login carry over so nobody signs in twice, in the **main app** add
`Domain=.ivyhuts.com` to the session cookie (`api/_lib/session.js`,
`buildSessionCookie` / `buildClearCookie`) and make sure both apps use the
same `AUTH_*` settings and the same shared store. `SameSite=Lax` already works
across subdomains.

---

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
  pages/LoginPage.{js,css}     standalone sign-in (new)
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
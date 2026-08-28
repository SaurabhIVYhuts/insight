# IVYHUTS Market Insight

Standalone deployment of the **Daily Sold-Out Market Intelligence** dashboard
(the `/insight` page), extracted from the main `ivyhuts-website` repo so it can
live as its own Vercel project on its own domain (`insight.ivyhuts.com`).

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
| Amber catalog crawl state, locks | Upstash Redis (`insights:marketCrawl:*`) | Also feeds the main site's search/location index when the DB/Redis are shared. |
| Login sessions, rate limits | Upstash Redis (`session:*`, `auth:*`) | Same store the main app's auth uses. |
| Role check (who may open the dashboard) | MongoDB `User.role` ∈ `MARKETING_AGENT` / `MARKETING_MANAGER` / `ADMIN` | Enforced server-side on every `/api/insights/*` data call. |
| Daily 08:00 IST report email | Resend | Snapshot is still stored if email fails. |

**This build is meant to point at the SAME MongoDB + Upstash Redis as the
main app.** That gives you full history from day one, a working overview tab,
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

If your `.env.local` points at the main app's Redis + Mongo, any existing
internal account works — just sign in at `/login`.

Otherwise, create one:

```bash
npm run create-internal-user -- \
  --email you@ivyhuts.com --password 'a-strong-password' \
  --name "Your Name" --phone 9876543210 --role ADMIN
```

(You can also sign up through the `/login` form and then run the same command
without `--password` to promote that account — actually the command needs a
password only when it has to create the Redis credentials; for an
already-signed-up account any placeholder is ignored once it sees the login
already exists.)

---

## Deploying to Vercel

1. **Push this folder to a new Git repo.**

   ```bash
   cd market-insight
   git init && git add -A && git commit -m "Initial import: Market Insight standalone"
   git branch -M main
   git remote add origin <your-new-repo-url>
   git push -u origin main
   ```

2. **Import the repo in Vercel** as a new project. Framework preset:
   *Create React App* (auto-detected). Build command `npm run build`, output
   `build/` — both defaults.

3. **Set Environment Variables** (Production + Preview) — every value from
   `.env.example`. The important ones:

   | Variable | Value |
   | --- | --- |
   | `MONGODB_URI` | same as the main app |
   | `UPSTASH_REDIS_REST_URL` / `_TOKEN` | same as the main app |
   | `AMBER_MAX_REQUESTS_PER_MINUTE` | `6` |
   | `CRON_SECRET` | a fresh random string |
   | `RESEND_API_KEY` | your Resend key |
   | `INSIGHTS_REPORT_RECIPIENTS` | comma-separated emails |
   | `RESEND_FROM` | a verified sender, or leave unset for the sandbox |
   | `SITE_URL` | `https://insight.ivyhuts.com/` |

4. **Deploy.** `vercel.json` registers the daily digest cron
   (`/api/insights/daily-digest`, `30 2 * * *` UTC = 08:00 IST).

5. **Add the domain.** Project → Settings → Domains → add
   `insight.ivyhuts.com`. If `ivyhuts.com`'s nameservers are already on
   Vercel the DNS record + SSL are created automatically; otherwise add a
   `CNAME` `insight → cname.vercel-dns.com` at your DNS provider. The apex
   and every existing subdomain keep pointing at the main project.

6. **Keep the crawl moving.** On Hobby you can't run a 5-minute cron, so
   enable the included GitHub Action (`.github/workflows/advance-crawl.yml`)
   — add repo secrets `INSIGHT_BASE_URL` and `CRON_SECRET`. On Pro, delete
   that workflow and add a second `crons` entry to `vercel.json` instead:
   `{ "path": "/api/insights/advance-crawl", "schedule": "*/10 * * * *" }`.

   **Run the crawl-keeper in ONE place only** — either here or in the main
   app, never both against the same Redis.

### Manually triggering the jobs

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://insight.ivyhuts.com/api/insights/advance-crawl
curl -H "Authorization: Bearer $CRON_SECRET" https://insight.ivyhuts.com/api/insights/daily-digest
```
---

## Auth across `*.ivyhuts.com` (optional)

Out of the box this app has its own `/login`. If you'd rather the main site's
existing login carry over so nobody signs in twice, in the **main app** add
`Domain=.ivyhuts.com` to the session cookie (`api/_lib/session.js`,
`buildSessionCookie` / `buildClearCookie`) and make sure both apps use the
same `AUTH_*` settings and the same Redis. `SameSite=Lax` already works
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
.github/workflows/
  advance-crawl.yml            Hobby-plan crawl keeper (new)
vercel.json                    functions + SPA rewrite + daily-digest cron
```
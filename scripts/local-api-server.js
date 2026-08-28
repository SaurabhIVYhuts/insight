#!/usr/bin/env node
// Runs the EXACT SAME api/_lib/routes/** handlers used in production, as a
// plain Node HTTP server on its own port, so local development doesn't
// require `vercel dev` or a Vercel account. This is not a reimplementation
// — it's the real handlers, adapted from Vercel's (req, res) interface to
// plain Node http.
//
// CRA's dev server proxies /api/* here automatically — see src/setupProxy.js.
// Started together with `react-scripts start` by `npm start`
// (see scripts/start-local.js).
const path = require("path");

// Plain `node` (unlike `vercel dev`) never loads .env files on its own, so
// this MUST run before requiring the API handlers below — some of them read
// env vars at require-time.
require("dotenv").config({ path: path.join(__dirname, "..", ".env.local") });
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const http = require("http");
const { URL } = require("url");

// ── Route table: exactly the two groups this app ships ─────────────────────
const routes = {
  // auth
  "/api/auth/signup": require("../api/_lib/routes/auth/signup.js"),
  "/api/auth/login": require("../api/_lib/routes/auth/login.js"),
  "/api/auth/logout": require("../api/_lib/routes/auth/logout.js"),
  "/api/auth/me": require("../api/_lib/routes/auth/me.js"),
  // insights — session-auth dashboard endpoints
  "/api/insights/overview": require("../api/_lib/routes/insights/overview.js"),
  "/api/insights/market": require("../api/_lib/routes/insights/market.js"),
  "/api/insights/snapshot-dates": require("../api/_lib/routes/insights/snapshot-dates.js"),
  "/api/insights/snapshot": require("../api/_lib/routes/insights/snapshot.js"),
  "/api/insights/sold-out-trend": require("../api/_lib/routes/insights/sold-out-trend.js"),
  // insights — CRON_SECRET-gated background jobs (call with
  //   Authorization: Bearer $CRON_SECRET)
  "/api/insights/daily-digest": require("../api/_lib/routes/insights/daily-digest.js"),
  "/api/insights/advance-crawl": require("../api/_lib/routes/insights/advance-crawl.js"),
};

const PORT = process.env.LOCAL_API_PORT || 3001;

function adaptResponse(res) {
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (body) => {
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(body));
  };
  return res;
}

function readJsonBody(req) {
  return new Promise((resolve) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(raw || "{}"));
      } catch {
        resolve({});
      }
    });
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    req.query = Object.fromEntries(url.searchParams.entries());
    adaptResponse(res);

    const handler = routes[url.pathname];
    if (!handler) {
      res.statusCode = 404;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: "Not found", path: url.pathname }));
      return;
    }

    if (["POST", "PATCH", "PUT", "DELETE"].includes(req.method)) {
      req.body = await readJsonBody(req);
    }
    await handler(req, res);
  } catch (err) {
    console.error("[local-api-server] handler error:", err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ ok: false, error: "internal_error", message: err.message }));
    }
  }
});

server.listen(PORT, () => {
  console.log(`[local-api-server] listening on http://localhost:${PORT} (proxied at /api/* by the CRA dev server)`);
});

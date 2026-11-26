// Access gate for the /insight dashboard's read-only data endpoints.
//
// The dashboard is PUBLIC: the login page was removed on purpose, so anyone
// with the link can read these endpoints. They must therefore only ever return
// totals and market data, never personal details. The CRON_SECRET-protected
// jobs (advance-crawl, daily-digest) do not use this gate.
//
// To make the dashboard private again, restore requireRole (businessAuth.js)
// here and the login page in src/.
async function authorizeInsights() {
    return { public: true };
}

module.exports = { authorizeInsights };

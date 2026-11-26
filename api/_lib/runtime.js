// True inside Cloudflare Workers (deployed and `wrangler dev`). Detected from
// the runtime itself, so there is no variable anyone can forget to set.
const IS_WORKERS = typeof navigator !== "undefined" && navigator.userAgent === "Cloudflare-Workers";

module.exports = { IS_WORKERS };

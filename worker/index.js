// Cloudflare Worker entry — replaces Vercel's serverless runtime.
//
// Reuses the exact same Node `http` router that `npm start` runs locally
// (scripts/local-api-server.js, which dispatches to every api/_lib handler),
// served through Workers' Node.js HTTP compatibility layer. Static assets
// (the React build) are served by Cloudflare itself; only /api/* reaches
// this Worker (see `assets.run_worker_first` in wrangler.jsonc).
//
// The router runs inside ONE Durable Object, not in the stateless Worker. A
// plain Worker may not use a socket opened by an earlier request, so the shared
// MongoDB connection stopped answering after a few requests. Inside a Durable
// Object the connection stays usable across requests.
//
// There is no scheduled() handler: the cron jobs are called over HTTP by
// cron-job.org with `Authorization: Bearer $CRON_SECRET`.
import { DurableObject } from "cloudflare:workers";
import { handleAsNodeRequest } from "cloudflare:node";

// The router (and mongodb/bson underneath it) generates random bytes while
// loading, which Workers forbids in global scope — so load it lazily, inside
// the first request, and reuse it afterwards.
let portPromise;
function getPort() {
  if (!portPromise) {
    portPromise = import("../scripts/local-api-server.js").then((mod) => {
      const { server, PORT } = mod.default || mod;
      server.listen(Number(PORT));
      return Number(PORT);
    });
  }
  return portPromise;
}

export class ApiServer extends DurableObject {
  async fetch(request) {
    return handleAsNodeRequest(await getPort(), request);
  }
}

export default {
  async fetch(request, env, ctx) {
    const response = env.API.get(env.API.idFromName("api")).fetch(request);
    // cron-job.org hangs up after 30s. waitUntil keeps the call to the Durable
    // Object open a little longer, so a crawl tick or digest can finish.
    ctx.waitUntil(response.catch(() => {}));
    return response;
  },
};

// Cloudflare Workers entry point (see wrangler.jsonc and MIGRATION.md).
//
// Static files (public/) are served by Workers Static Assets before this code
// runs, free and without using the Worker's CPU; their headers come from
// public/_headers. Only /api/* reaches the Worker, and relay.js answers it: the
// same handler the Node server (server.js) uses.
//
// Optional variables (Settings > Variables, or `wrangler dev --var`):
//   ECONT_BASE_PRODUCTION, ECONT_BASE_DEMO  override Econt's base URLs (tests)
import relay from './relay.js';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) return relay.handle(request, relay.configFromEnv(env));
    return env.ASSETS.fetch(request);
  },
};

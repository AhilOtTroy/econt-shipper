# Econt shipper: paste → товарителница

Paste a customer's Bulgarian message, check the details, tap once, and get a ready
Econt shipment number (товарителница) with your usual options. Works on phone or
desktop as a normal website.

## How it's built (and why it's safe to host)

- **The browser does the work.** Reading the message (name, phone, office, COD,
  review) and matching the office run in the page itself
  (`public/core/parser.js`, `public/core/match.js`). The Econt office list is kept
  in the browser for 6 hours per mode (demo / production), with the old copy used
  if Econt is down. Econt's tracking statuses are read in the page too
  (`public/core/track.js`): the relay hands both over as Econt sends them.
- **The server is a thin, stateless relay** (`relay.js`). It stores **no
  credentials and no database**. Your Econt login, sender info and default options
  are saved **in your own browser**, and your Econt **password is encrypted with a
  PIN** you choose. Each request decrypts it in memory and the relay passes it on
  to Econt over HTTPS. Someone who finds the public URL only gets their own empty
  setup screen.
- The same relay runs on **Cloudflare Workers** (`worker.js`, the main host) and on
  **Node** (`server.js`, e.g. Render), so either host works.

## Hosting

**Cloudflare Workers Free** (recommended: never sleeps, no card): see
[MIGRATION.md](MIGRATION.md) for the step-by-step setup. Every push to `main` is
deployed by Workers Builds (`npx wrangler deploy`, config in `wrangler.jsonc`).
The web app is served as Static Assets; its headers are in `public/_headers`.

**Render** (the previous host, still works): New + → Blueprint → connect the repo.
Render reads [`render.yaml`](render.yaml). The free tier sleeps after inactivity,
so the first visit after a while takes about 30 s.

**On your own computer**: `node server.js` (or double-click [`start.bat`](start.bat)
on Windows) and open `http://localhost:5005`. `npx wrangler dev` runs the
Cloudflare version locally.

Optional environment variables (both hosts): `ECONT_BASE_PRODUCTION`,
`ECONT_BASE_DEMO` point the relay at another Econt host (the tests use a mock).

## Demo vs Production

- **Demo** (`iasp-dev` / `1Asp-dev`) creates nothing real: good for trying it out,
  with a smaller test office list.
- **Production** uses your normal econt.com login (username, exact case), the full
  office list and real shipments. Every "Create" is billed by Econt.

## Security notes

- Your Econt password lives only in **your browser**, encrypted with your PIN
  (PBKDF2 + AES-GCM). It is sent to the relay **only** to pass a request on to
  Econt, over HTTPS, and is never stored on the server.
- The PIN both locks the app on your device and is the key to that encryption. If
  you forget it, use **Forget this device** and set up again.
- The app blocks creating a label if COD is on but the amount is blank, asks before
  a parcel goes out without COD, and never retries a create whose outcome is unclear.

## Tests

`npm install` once, then `bash tests/run-all.sh` (or `npm test`). It starts an
Econt mock and runs every suite against the Node server and against `wrangler dev`
(Cloudflare's local runtime, no Cloudflare login needed). Playwright with Chromium
must be installed globally (`NODE_PATH=$(npm root -g)`).

| Test | What it checks |
|------|----------------|
| `tests/parser-golden.js` | 335 messages: parser, office matching and the old server's `/api/parse`, `/api/parse-batch` answers (captured from 724526c); tracking replies read as `/api/track` used to answer |
| `tests/lookbehind-free.js` | the browser code runs on old Safari (no regex lookbehind, no newer syntax), and every rewritten pattern matches exactly like its old lookbehind form |
| `tests/e2e/api.js` | every relay route and Econt fault, static headers |
| `tests/e2e/moved.js` | the golden answers again inside the browser, office cache, limits, Settings, a browser without lookbehind, a page put to sleep mid-read, a tab from before the update |
| `tests/e2e/ui.js`, `tests/e2e/regress.js` | the whole UI: paste, price, create, guards, batch, parcels |
| `tests/cpu-profile.js` | CPU per relay route on workerd (Workers Free allows 10 ms), warm and on a Worker that has just started, with Econt-sized tracking replies |

## Files

| File | What it does |
|------|--------------|
| `relay.js` | The relay: one Fetch API handler for every `/api/*` route |
| `worker.js` | Cloudflare Workers entry (static files + relay) |
| `server.js` | Node server: static files + the same relay |
| `econt.js` | Econt API calls + builds the ShippingLabel payload |
| `public/core/` | Message parser, office matching and tracking reader, run in the browser |
| `public/` | The web app: setup wizard, PIN lock, paste → create UI |
| `wrangler.jsonc`, `public/_headers` | Cloudflare config and static file headers |
| `render.yaml` | Render config |
| `tests/` | Econt mock, golden data, end-to-end suites, `run-all.sh` |

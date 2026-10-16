Recovered UI suites (Playwright) from before the Cloudflare migration, kept for reference.
test.js passes 48/48 against commit 724526c with mockserver.js (it monkeypatches econt.js and starts server.js on PORT 5099).
Both are ported to the suites that run on both runtimes: test.js -> tests/e2e/ui.js, test2.js -> tests/e2e/regress.js
(see the header of each for what changed). Run everything with: bash tests/run-all.sh

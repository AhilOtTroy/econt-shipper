Recovered UI suites (Playwright) from before the Cloudflare migration.
test.js passes 48/48 against commit 724526c with mockserver.js (it monkeypatches econt.js and starts server.js on PORT 5099).
test2.js is the original regression suite; it still needs the later updates (timing waits, renamed statuses) and is being ported to tests/e2e/.
Run: node tests/e2e/legacy/mockserver.js &  then  NODE_PATH=$(npm root -g) node tests/e2e/legacy/test.js

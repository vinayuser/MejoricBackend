/**
 * Socket.io connection load test — registers N users and keeps connections open.
 *
 * Usage:
 *   npm run loadtest:sockets
 *   LOADTEST_CONCURRENCY=200 npm run loadtest:sockets
 */
const fs = require("fs");
const { io } = require("socket.io-client");
const config = require("./config");

async function connectOne(pair, index) {
  const start = Date.now();
  return new Promise((resolve) => {
    const socket = io(config.socketUrl, {
      transports: ["websocket"],
      reconnection: false,
      timeout: 15000,
    });

    const finish = (ok, error) => {
      socket.disconnect();
      resolve({ index, ok, ms: Date.now() - start, error });
    };

    socket.on("connect", () => {
      socket.emit("register_user", pair.callerId);
      setTimeout(() => finish(true), 500);
    });

    socket.on("connect_error", (err) => {
      finish(false, err.message);
    });

    setTimeout(() => finish(false, "timeout"), 20000);
  });
}

async function main() {
  if (!fs.existsSync(config.pairsFile)) {
    console.error(`Missing ${config.pairsFile}. Run: npm run loadtest:prepare`);
    process.exit(1);
  }

  const file = JSON.parse(fs.readFileSync(config.pairsFile, "utf8"));
  const pairs = (file.pairs || []).slice(0, config.pairCount);
  const concurrency = Math.min(config.concurrency, pairs.length);

  console.log(`Socket load test → ${config.socketUrl}`);
  console.log(`Connections: ${pairs.length}, concurrency: ${concurrency}`);

  const results = [];
  let cursor = 0;

  async function worker() {
    while (cursor < pairs.length) {
      const i = cursor;
      cursor += 1;
      results[i] = await connectOne(pairs[i], i);
    }
  }

  const started = Date.now();
  await Promise.all(
    Array.from({ length: concurrency }, () => worker()),
  );

  const ok = results.filter((r) => r.ok).length;
  console.log(
    `\nConnected ${ok}/${pairs.length} in ${((Date.now() - started) / 1000).toFixed(2)}s`,
  );
  results
    .filter((r) => !r.ok)
    .slice(0, 5)
    .forEach((r) => console.log(`  fail #${r.index}: ${r.error}`));

  process.exit(ok === pairs.length ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

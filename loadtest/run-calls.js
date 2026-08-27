/**
 * HTTP load test: initiate → (ring) → accept → hold → end for N concurrent 1:1 calls.
 * Does NOT join Agora media (tests API + DB + mate busy state under load).
 *
 * Usage (from Server/):
 *   npm run loadtest:prepare
 *   npm run loadtest:calls
 *   LOADTEST_CONCURRENCY=100 npm run loadtest:calls
 */
const fs = require("fs");
const axios = require("axios");
const config = require("./config");

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

function stats(label, values) {
  if (!values.length) return { label, count: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  return {
    label,
    count: sorted.length,
    minMs: sorted[0],
    maxMs: sorted[sorted.length - 1],
    avgMs: Math.round(sum / sorted.length),
    p50Ms: percentile(sorted, 50),
    p95Ms: percentile(sorted, 95),
    p99Ms: percentile(sorted, 99),
  };
}

async function api(method, path, token, body) {
  const start = Date.now();
  try {
    const res = await axios({
      method,
      url: `${config.apiBaseUrl}${path}`,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      data: body,
      timeout: 30000,
      validateStatus: () => true,
    });
    return {
      ok: res.status >= 200 && res.status < 300 && res.data?.success !== false,
      status: res.status,
      data: res.data,
      ms: Date.now() - start,
      message: res.data?.message || res.statusText,
    };
  } catch (err) {
    return {
      ok: false,
      status: err.response?.status || 0,
      data: err.response?.data,
      ms: Date.now() - start,
      message: err.message,
    };
  }
}

async function runOnePair(pair) {
  const timings = { initiate: [], accept: [], end: [], total: [] };
  const errors = [];
  const totalStart = Date.now();

  const initiate = await api("POST", "/calls/initiate", pair.callerToken, {
    receiverId: pair.mateUserId,
    callType: config.callType,
    deferRing: config.deferRing,
  });
  timings.initiate.push(initiate.ms);
  if (!initiate.ok) {
    errors.push(`initiate: ${initiate.message}`);
    timings.total.push(Date.now() - totalStart);
    return { pair: pair.index, ok: false, errors, timings };
  }

  const callSessionId =
    initiate.data?.data?.callSessionId || initiate.data?.data?._id;
  if (!callSessionId) {
    errors.push("initiate: missing callSessionId");
    timings.total.push(Date.now() - totalStart);
    return { pair: pair.index, ok: false, errors, timings };
  }

  if (!config.deferRing) {
    const ring = await api("POST", "/calls/ring", pair.callerToken, {
      callSessionId,
    });
    if (!ring.ok) errors.push(`ring: ${ring.message}`);
  }

  const accept = await api("POST", "/calls/accept", pair.mateToken, {
    callSessionId,
  });
  timings.accept.push(accept.ms);
  if (!accept.ok) {
    errors.push(`accept: ${accept.message}`);
    await api("POST", "/calls/end", pair.callerToken, { callSessionId });
    timings.total.push(Date.now() - totalStart);
    return { pair: pair.index, ok: false, errors, timings };
  }

  if (config.holdMs > 0) {
    await new Promise((r) => setTimeout(r, config.holdMs));
  }

  const end = await api("POST", "/calls/end", pair.callerToken, {
    callSessionId,
  });
  timings.end.push(end.ms);
  if (!end.ok) errors.push(`end: ${end.message}`);

  timings.total.push(Date.now() - totalStart);
  return {
    pair: pair.index,
    ok: errors.length === 0,
    callSessionId,
    errors,
    timings,
  };
}

async function runBatch(pairs, concurrency) {
  const results = [];
  let cursor = 0;

  async function worker() {
    while (cursor < pairs.length) {
      const idx = cursor;
      cursor += 1;
      results[idx] = await runOnePair(pairs[idx]);
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, pairs.length) },
    () => worker(),
  );
  await Promise.all(workers);
  return results;
}

async function main() {
  if (!fs.existsSync(config.pairsFile)) {
    console.error(`Missing ${config.pairsFile}. Run: npm run loadtest:prepare`);
    process.exit(1);
  }

  const file = JSON.parse(fs.readFileSync(config.pairsFile, "utf8"));
  const pairs = file.pairs || [];
  if (!pairs.length) {
    console.error("pairs.json has no pairs");
    process.exit(1);
  }

  const slice = pairs.slice(0, config.pairCount);
  const concurrency = Math.min(config.concurrency, slice.length);

  console.log("Mejoric call load test");
  console.log("─".repeat(50));
  console.log(`API:          ${config.apiBaseUrl}`);
  console.log(`Pairs:        ${slice.length}`);
  console.log(`Concurrency:  ${concurrency}`);
  console.log(`Call type:    ${config.callType}`);
  console.log(`Hold:         ${config.holdMs}ms`);
  console.log(`Defer ring:   ${config.deferRing}`);
  console.log("─".repeat(50));

  const startedAt = Date.now();
  const results = await runBatch(slice, concurrency);
  const durationMs = Date.now() - startedAt;

  const ok = results.filter((r) => r.ok).length;
  const failed = results.length - ok;

  const agg = {
    initiate: [],
    accept: [],
    end: [],
    total: [],
  };
  const errorCounts = {};

  for (const r of results) {
    for (const key of Object.keys(agg)) {
      if (r.timings?.[key]?.length) agg[key].push(...r.timings[key]);
    }
    for (const e of r.errors || []) {
      errorCounts[e] = (errorCounts[e] || 0) + 1;
    }
  }

  const report = {
    finishedAt: new Date().toISOString(),
    durationMs,
    pairs: slice.length,
    concurrency,
    success: ok,
    failed,
    successRate: `${((ok / results.length) * 100).toFixed(1)}%`,
    timings: {
      initiate: stats("initiate", agg.initiate),
      accept: stats("accept", agg.accept),
      end: stats("end", agg.end),
      total: stats("total", agg.total),
    },
    errors: errorCounts,
    samples: results.filter((r) => !r.ok).slice(0, 10),
  };

  fs.writeFileSync(config.resultsFile, JSON.stringify(report, null, 2));

  console.log(`\nDone in ${(durationMs / 1000).toFixed(2)}s`);
  console.log(`Success: ${ok}/${results.length} (${report.successRate})`);
  console.log(`Failed:  ${failed}`);
  console.log("\nTimings (ms):");
  for (const [key, s] of Object.entries(report.timings)) {
    if (!s.count) continue;
    console.log(
      `  ${key.padEnd(10)} avg=${s.avgMs} p50=${s.p50Ms} p95=${s.p95Ms} p99=${s.p99Ms} max=${s.maxMs}`,
    );
  }
  if (Object.keys(errorCounts).length) {
    console.log("\nTop errors:");
    Object.entries(errorCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .forEach(([msg, count]) => console.log(`  ${count}× ${msg}`));
  }
  console.log(`\nFull report → ${config.resultsFile}`);

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

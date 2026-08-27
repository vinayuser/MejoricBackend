# Mejoric server load tests

Tests **API + DB + mate busy state** under concurrent 1:1 call flows.  
Does **not** join real Agora audio/video (media stays on Agora’s network).

## Quick start (local)

```bash
cd Server

# 1) Seed 10 caller/mate pairs + wallets + JWTs
npm run loadtest:prepare

# 2) Run 10 concurrent call lifecycles
npm run loadtest:calls

# 3) Optional: open many Socket.io connections
npm run loadtest:sockets

# 4) Remove test users when done
npm run loadtest:cleanup
```

## Test on staging / production server

Point at your running API (do **not** run `prepare` against prod unless you intend to create test users there).

```bash
cd Server

export LOADTEST_API_URL=https://mejoric.com/mateandmentors
export LOADTEST_SOCKET_URL=https://mejoric.com
export LOADTEST_PAIRS=100
export LOADTEST_CONCURRENCY=100

npm run loadtest:prepare   # uses MONGO_URL from .env
npm run loadtest:calls
```

Watch server CPU/RAM, MongoDB connections, and logs while the test runs.

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `LOADTEST_API_URL` | `http://localhost:3002/mateandmentors` | REST base URL |
| `LOADTEST_SOCKET_URL` | `http://localhost:3002` | Socket.io origin |
| `LOADTEST_PAIRS` | `10` | Number of caller/mate pairs to use |
| `LOADTEST_CONCURRENCY` | `10` | Parallel call flows |
| `LOADTEST_CALL_TYPE` | `AUDIO` | `AUDIO` or `VIDEO` |
| `LOADTEST_HOLD_MS` | `3000` | Simulated call duration before hangup |
| `LOADTEST_DEFER_RING` | `true` | Skip push/ring step (less FCM noise) |
| `LOADTEST_WALLET_INR` | `5000` | Wallet balance seeded per caller |
| `LOADTEST_EMAIL_PREFIX` | `loadtest` | Email prefix for test accounts |
| `LOADTEST_EMAIL_DOMAIN` | `loadtest.mejoric.local` | Email domain for test accounts |

Uses `MONGO_URL`, `JWT_SECRET`, and `DEFAULT_PASSWORD` from `Server/.env`.

## What each script does

### `prepare.js`
- Creates `loadtest-caller-0001@…` users with wallets
- Creates `loadtest-mate-0001@…` mates (`isAvailable: true`, `isBusy: false`)
- Writes JWT tokens to `pairs.json`

### `run-calls.js`
Per pair (in parallel):
1. `POST /calls/initiate`
2. `POST /calls/accept` (mate)
3. Wait `LOADTEST_HOLD_MS`
4. `POST /calls/end`

Writes latency stats to `results.json`.

### `run-sockets.js`
Connects N Socket.io clients and emits `register_user` (signaling load).

### `cleanup.js`
Soft-deletes load-test users, mates, wallets, and call sessions.

## Interpreting results

Example output:

```
Success: 98/100 (98.0%)
Timings (ms):
  initiate   avg=120 p50=95 p95=310
  accept     avg=85  p50=70 p95=200
  total      avg=3200
```

- **Low success + “Receiver is busy”** → mates still marked busy from a prior failed run; run cleanup + prepare again
- **High p95 on initiate/accept** → API/DB bottleneck
- **Socket test fails but calls pass** → Socket.io capacity issue (single Node process)

## 100 concurrent calls checklist

1. `LOADTEST_PAIRS=100 LOADTEST_CONCURRENCY=100 npm run loadtest:prepare`
2. Ensure server is running and `LOADTEST_API_URL` points to it
3. `LOADTEST_PAIRS=100 LOADTEST_CONCURRENCY=100 npm run loadtest:calls`
4. Monitor: `htop`, MongoDB Atlas metrics, Agora dashboard (if you later add media tests)

For **real media** load (Agora channels), you need browser or Agora load tools — this suite only stress-tests **your backend call API**.

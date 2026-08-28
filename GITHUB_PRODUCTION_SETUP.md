# Production GitHub secrets — step by step

Set up **production only** first. Do staging later.

---

## Part A — Create the environment (2 minutes)

1. Open GitHub → your **Server** repository  
2. **Settings** (top tab)  
3. Left sidebar → **Environments**  
4. Click **New environment**  
5. Name: **`production`** → **Configure environment**  
6. Leave “Required reviewers” empty for now (optional later)  
7. You are now on: **Environments → production**

All secrets below go under:  
**Environment secrets → Add secret**

---

## Part B — SSH (deploy access)

Add these **3 secrets** first:

| # | Secret name | What to paste |
|---|-------------|----------------|
| 1 | `SSH_HOST` | Server IP (same machine as `srv1576457`) |
| 2 | `SSH_USER` | `root` |
| 3 | `SSH_PASSWORD` | Your root SSH password |

---

## Part C — Deploy paths (production server)

On the VPS, production API runs from `/var/www/html/mejoric/Server` on port **3002**, PM2 name **`index`**.

| # | Secret name | Value |
|---|-------------|--------|
| 4 | `SERVER_APP_DIR` | `/var/www/html/mejoric/Server` |
| 5 | `PM2_PROCESS_NAME` | `index` |
| 6 | `PORT` | `3002` |

Check PM2 name on server if unsure:

```bash
pm2 list
```

Use the **name** column for `index` (not the script path).

---

## Part D — Database & auth (required)

| # | Secret name | Value (production `.env`) |
|---|-------------|---------------------------|
| 7 | `MONGO_URL` | `mongodb://localhost:27017/MateAndMentors` |
| 8 | `JWT_SECRET` | Copy from prod `.env` (starts with `backend$%...`) |
| 9 | `DEFAULT_PASSWORD` | `MateAndMentors@123` |

---

## Part E — App mode (production)

| # | Secret name | Value |
|---|-------------|--------|
| 10 | `NODE_ENV` | `production` |
| 11 | `APP_ENV` | `production` |
| 12 | `APP_NAME` | `Mejoric` |
| 13 | `IS_STAGING` | `false` |
| 14 | `ALLOW_MOCK_PAYMENTS` | `false` |

---

## Part F — Site URLs (CORS + emails)

| # | Secret name | Value |
|---|-------------|--------|
| 15 | `WEB_BASE_URL` | `https://mejoric.com` |
| 16 | `ADMIN_BASE_URL` | `https://admin.mejoric.com` |
| 17 | `APP_BASE_URL` | `https://mejoric.com` |
| 18 | `FRONTEND_BASE_URL` | `https://mejoric.com` |
| 19 | `API_MOUNT_PREFIXES` | `/mateandmentors,/staging-api/mateandmentors` |

---

## Part G — Email (OTP, booking mails)

**Remove `#` comments** when pasting.

| # | Secret name | Value |
|---|-------------|--------|
| 20 | `NODEMAILER_EMAIL` | `mateandmentors@gmail.com` |
| 21 | `NODEMAILER_PASSWORD` | `flpunfdjudhuebce` |

Wrong: `mateandmentors@gmail.com  #devrathod...`  
Right: `mateandmentors@gmail.com` only

---

## Part H — Cloudinary (images)

Use the **first value before `#`** on each line in your server `.env`:

| # | Secret name | Value |
|---|-------------|--------|
| 22 | `CLOUD_NAME` | `dzczeob9t` |
| 23 | `CLOUD_API_KEY` | `951264861784997` |
| 24 | `CLOUD_SECRET` | First secret only (before first `#`) |
| 25 | `CLOUD_BASE_URL` | `https://res.cloudinary.com/dzczeob9t` |
| 26 | `CLOUDINARY_URL` | Full `cloudinary://...` line (before `#` if any) |

---

## Part I — Razorpay LIVE (production payments)

Use **live** keys, not test:

| # | Secret name | Value |
|---|-------------|--------|
| 27 | `RAZORPAY_KEY_ID` | `rzp_live_SVXnEDUa7IpGc8` |
| 28 | `RAZORPAY_KEY_SECRET` | Live secret (before `#` in `.env`) |
| 29 | `RAZORPAY_WEBHOOK_SECRET` | Leave empty or add if you have one |

---

## Part J — Agora (calls)

| # | Secret name | Value |
|---|-------------|--------|
| 30 | `AGORA_APP_ID` | `4924d6a9a08346738fed9238d57582ea` |
| 31 | `AGORA_APP_CERTIFICATE` | From prod `.env` |
| 32 | `AGORA_TOKEN_TTL_SECONDS` | `3600` |

---

## Part K — SMS (2Factor)

| # | Secret name | Value |
|---|-------------|--------|
| 33 | `TWO_FACTOR_API_KEY` | From prod `.env` |

Optional: `TWO_FACTOR_SENDER_ID` if you use DLT sender ID.

---

## Part L — Pricing & wallet

| # | Secret name | Value |
|---|-------------|--------|
| 34 | `TRIAL_CHAT_DURATION` | `600` |
| 35 | `FREE_WALLET_RECHARGE` | `100` |
| 36 | `CHAT_PRICE_PER_MIN` | `8` |
| 37 | `AUDIO_CALL_PRICE_PER_MIN` | `12` |
| 38 | `VIDEO_CALL_PRICE_PER_MIN` | `15` |
| 39 | `MATE_SHARE_PERCENTAGE` | `60` |
| 40 | `PLATFORM_FEE_PERCENTAGE` | `40` |

---

## Part M — Sentry, Zoom, Firebase

| # | Secret name | Value |
|---|-------------|--------|
| 41 | `SENTRY_DSN` | Full Sentry URL from `.env` |
| 42 | `ZOOM_ACCOUNT_ID` | From `.env` |
| 43 | `ZOOM_CLIENT_ID` | From `.env` |
| 44 | `ZOOM_CLIENT_SECRET` | From `.env` |
| 45 | `ZOOM_USER_ID` | `me` |
| 46 | `ZOOM_WEBHOOK_SECRET_TOKEN` | From `.env` |
| 47 | `FIREBASE_SERVICE_ACCOUNT_PATH` | `../firebaseServiceKeys.json` |

Firebase JSON file must already exist on server at:  
`/var/www/html/mejoric/firebaseServiceKeys.json`  
(relative to `Server/` folder)

---

## Part N — EnableX (optional, legacy)

Only if still used:

| # | Secret name |
|---|-------------|
| 48 | `ENABLE_X_APP_ID` |
| 49 | `ENABLE_X_APP_KEY` |
| 50 | `ENABLE_X_AUDIO_APP_ID` |
| 51 | `ENABLE_X_AUDIO_APP_KEY` |

---

## Part O — Run production deploy

1. GitHub → **Actions**  
2. **Deploy API (Server)** (left sidebar)  
3. **Run workflow** (dropdown top right)  
4. **Branch:** `main` (or your deploy branch)  
5. **Environment:** **`production`**  
6. **Run workflow**

Watch the log. Success looks like:

- `Writing .env from GitHub Environment secrets`
- `Restarting PM2 process: index`
- `Health check: server responded on port 3002`

---

## Part P — Verify on server

SSH in and run:

```bash
pm2 list
pm2 logs index --lines 30

# Should get HTTP response (404 is OK — means Node is up)
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3002/mateandmentors

# Check .env was written (do not paste output publicly)
head -5 /var/www/html/mejoric/Server/.env
```

Test live site: open https://mejoric.com and try login / a simple API action.

---

## Minimum to run deploy (if you want to start small)

If you want to test the pipeline before adding all 50 secrets, add at least:

1. `SSH_HOST`, `SSH_USER`, `SSH_PASSWORD`  
2. `SERVER_APP_DIR`, `PM2_PROCESS_NAME`, `PORT`  
3. `MONGO_URL`, `JWT_SECRET`  
4. `IS_STAGING=false`, `ALLOW_MOCK_PAYMENTS=false`  
5. `FRONTEND_BASE_URL`, `WEB_BASE_URL`, `ADMIN_BASE_URL`, `APP_BASE_URL`

Then add Razorpay, Nodemailer, Agora before going live with payments/calls.

---

## Common mistakes

| Mistake | Fix |
|---------|-----|
| Secret value includes `KEY=` prefix | Paste **value only** |
| `# comment` copied into secret | Use text **before** `#` only |
| Wrong Razorpay keys | Prod = `rzp_live_...`, not `rzp_test_...` |
| PM2 name wrong | Run `pm2 list` on server |
| Repo has no workflow | Push `Server/.github/workflows/deploy-server.yml` to GitHub |

---

## After production works

Repeat similar steps for **staging** environment → see `GITHUB_ENV_SETUP.md` staging section.

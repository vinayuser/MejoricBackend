# GitHub Environment secrets — Server deploy

Step-by-step guide to configure **production** and **staging** for `Deploy API (Server)`.

> **Security:** You pasted live secrets in chat. After setup, consider rotating JWT, Razorpay live keys, Gmail app password, and Mongo passwords.

---

## Step 1 — Open GitHub Environments

1. Open your **Server** GitHub repository (the repo that contains this `Server/` folder).
2. Go to **Settings** → **Environments**.
3. Click **New environment** → name it **`production`** → **Configure environment**.
4. Repeat → create **`staging`**.

You will add secrets **separately** under each environment (prod values ≠ staging values).

---

## Step 2 — Add SSH secrets (both environments)

Add these under **production** first, then the same keys under **staging** (usually same VPS):

| Secret name | Value |
|-------------|--------|
| `SSH_HOST` | Your server IP or hostname (e.g. srv1576457 IP) |
| `SSH_USER` | `root` |
| `SSH_PASSWORD` | Your SSH password |

---

## Step 3 — Deploy paths & PM2 (per environment)

### Production environment only

| Secret name | Value |
|-------------|--------|
| `SERVER_APP_DIR` | `/var/www/html/mejoric/Server` |
| `PM2_PROCESS_NAME` | `index` (or run `pm2 list` on server and use exact name) |
| `PORT` | `3002` |

### Staging environment only

| Secret name | Value |
|-------------|--------|
| `SERVER_APP_DIR` | `/var/www/html/mejoric/Server-dev` |
| `PM2_PROCESS_NAME` | `index-staging` (or your staging PM2 name) |
| `PORT` | `3007` |

---

## Step 4 — Copy secrets from `.env` (IMPORTANT: no comments)

GitHub secret **values must be a single clean string**.  
Do **not** copy inline comments like:

```bash
# BAD (breaks mail/auth):
NODEMAILER_EMAIL=mateandmentors@gmail.com  #devrathod96445@gmail.com

# GOOD:
mateandmentors@gmail.com
```

Same for Cloudinary / Razorpay lines with `#` — use only the **active** value before `#`.

---

## Step 5 — Production secrets checklist

In **Settings → Environments → production → Environment secrets**, add:

### Required

| Secret | Production value (from your server `.env`) |
|--------|---------------------------------------------|
| `MONGO_URL` | `mongodb://localhost:27017/MateAndMentors` |
| `JWT_SECRET` | `backend$%mentees!@mentors@$123` |

### Core app

| Secret | Production value |
|--------|------------------|
| `NODE_ENV` | `production` |
| `APP_ENV` | `production` |
| `APP_NAME` | `Mejoric` |
| `IS_STAGING` | `false` |
| `ALLOW_MOCK_PAYMENTS` | `false` |
| `DEFAULT_PASSWORD` | `MateAndMentors@123` |

### URLs (CORS / emails)

| Secret | Production value |
|--------|------------------|
| `WEB_BASE_URL` | `https://mejoric.com` |
| `ADMIN_BASE_URL` | `https://admin.mejoric.com` |
| `APP_BASE_URL` | `https://mejoric.com` |
| `FRONTEND_BASE_URL` | `https://mejoric.com` |
| `API_MOUNT_PREFIXES` | `/mateandmentors,/staging-api/mateandmentors` |

### Email

| Secret | Production value (no comments) |
|--------|--------------------------------|
| `NODEMAILER_EMAIL` | `mateandmentors@gmail.com` |
| `NODEMAILER_PASSWORD` | `flpunfdjudhuebce` |

### Cloudinary (use first segment before `#`)

| Secret | Production value |
|--------|------------------|
| `CLOUD_NAME` | `dzczeob9t` |
| `CLOUD_API_KEY` | `951264861784997` |
| `CLOUD_SECRET` | (first secret before `#` in your file) |
| `CLOUD_BASE_URL` | `https://res.cloudinary.com/dzczeob9t` |
| `CLOUDINARY_URL` | `cloudinary://951264861784997:...@dzczeob9t` |

### Razorpay LIVE (production)

| Secret | Production value |
|--------|------------------|
| `RAZORPAY_KEY_ID` | `rzp_live_SVXnEDUa7IpGc8` |
| `RAZORPAY_KEY_SECRET` | `M2h9Jbbv5Ef5TsqynD5gL39E` |
| `RAZORPAY_WEBHOOK_SECRET` | (empty or your webhook secret) |

### Agora

| Secret | Value (same prod/staging) |
|--------|---------------------------|
| `AGORA_APP_ID` | `4924d6a9a08346738fed9238d57582ea` |
| `AGORA_APP_CERTIFICATE` | `b601485ddea94553b9d9eaab6cee43bb` |
| `AGORA_TOKEN_TTL_SECONDS` | `3600` |

### SMS / pricing / Sentry

| Secret | Production value |
|--------|------------------|
| `TWO_FACTOR_API_KEY` | `eee060ba-986d-11f0-be8d-0200cd936042` |
| `TRIAL_CHAT_DURATION` | `600` |
| `FREE_WALLET_RECHARGE` | `100` |
| `CHAT_PRICE_PER_MIN` | `8` |
| `AUDIO_CALL_PRICE_PER_MIN` | `12` |
| `VIDEO_CALL_PRICE_PER_MIN` | `15` |
| `MATE_SHARE_PERCENTAGE` | `60` |
| `PLATFORM_FEE_PERCENTAGE` | `40` |
| `SENTRY_DSN` | (your Sentry URL) |

### Zoom

| Secret | Value |
|--------|--------|
| `ZOOM_ACCOUNT_ID` | `P1EBN55nQPeSGYNS-BMsqQ` |
| `ZOOM_CLIENT_ID` | `O6YheRYYRbOsBECzRJGTTw` |
| `ZOOM_CLIENT_SECRET` | (your secret) |
| `ZOOM_USER_ID` | `me` |
| `ZOOM_WEBHOOK_SECRET_TOKEN` | (your token) |

### Firebase (file stays on server)

| Secret | Value |
|--------|--------|
| `FIREBASE_SERVICE_ACCOUNT_PATH` | `../firebaseServiceKeys.json` |

Ensure `firebaseServiceKeys.json` exists at `/var/www/html/mejoric/firebaseServiceKeys.json` (or adjust path).

### EnableX (optional, legacy)

| Secret | Value |
|--------|--------|
| `ENABLE_X_APP_ID` | `69b7a7f601742c5c950b3e8e` |
| `ENABLE_X_APP_KEY` | (your key) |
| `ENABLE_X_AUDIO_APP_ID` | `69c517c510b8b0a2780f69c3` |
| `ENABLE_X_AUDIO_APP_KEY` | (your key) |

---

## Step 6 — Staging secrets checklist

In **Settings → Environments → staging → Environment secrets**, add the same secret **names** but these **different values**:

| Secret | Staging value |
|--------|----------------|
| `SERVER_APP_DIR` | `/var/www/html/mejoric/Server-dev` |
| `PM2_PROCESS_NAME` | `index-staging` |
| `PORT` | `3007` |
| `MONGO_URL` | `mongodb+srv://devrathod:...@cluster0.hytjqbn.mongodb.net/MateAndMentors` |
| `IS_STAGING` | `true` |
| `ALLOW_MOCK_PAYMENTS` | `true` |
| `WEB_BASE_URL` | `https://admin-dev.mejoric.com` |
| `ADMIN_BASE_URL` | `https://admin-dev.mejoric.com` |
| `APP_BASE_URL` | `https://dev.mejoric.com` |
| `FRONTEND_BASE_URL` | `https://dev.mejoric.com` |
| `API_MOUNT_PREFIXES` | `/staging-api/mateandmentors,/mateandmentors` |
| `RAZORPAY_KEY_ID` | `rzp_test_SV2HF8YgKRSIK8` |
| `RAZORPAY_KEY_SECRET` | `sskHpssm9VHRMxZYyaaQkT6W` |

Everything else (JWT, Nodemailer, Agora, Zoom, Cloudinary, Sentry, pricing) can match production unless you want separate test values.

---

## Step 7 — How to add one secret in GitHub UI

1. **Settings → Environments → production**
2. **Environment secrets** → **Add secret**
3. **Name:** exact name e.g. `MONGO_URL` (case-sensitive, must match workflow)
4. **Secret:** paste value only — no `KEY=` prefix, no quotes, no `# comments`
5. **Add secret**
6. Repeat for every row in the checklist

Repeat all steps for **staging** environment.

---

## Step 8 — First-time staging folder setup

On the server, clone into `Server-dev` if not done yet:

```bash
cd /var/www/html/mejoric
git clone <your-server-repo-url> Server-dev
cd Server-dev
npm install
pm2 start index.js --name index-staging
pm2 save
```

Production should already be at `/var/www/html/mejoric/Server` with PM2 `index`.

---

## Step 9 — Run deploy

1. GitHub → **Actions** → **Deploy API (Server)**
2. **Run workflow**
3. **Branch:** `main` (or your branch)
4. **Environment:** `production` or `staging`
5. Watch the job log — it should write `.env` and `pm2 restart`

---

## Step 10 — Verify after deploy

```bash
# Production
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3002/mateandmentors

# Staging
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3007/staging-api/mateandmentors

pm2 logs index --lines 20
pm2 logs index-staging --lines 20
```

---

## Quick diff: prod vs staging

| Setting | Production | Staging |
|---------|------------|---------|
| Folder | `/var/www/html/mejoric/Server` | `/var/www/html/mejoric/Server-dev` |
| Port | `3002` | `3007` |
| Mongo | `localhost:27017` | Atlas dev cluster |
| Razorpay | **Live** keys | **Test** keys |
| `IS_STAGING` | `false` | `true` |
| `ALLOW_MOCK_PAYMENTS` | `false` | `true` |
| Front URL | `mejoric.com` | `dev.mejoric.com` |

---

## Secrets NOT in the workflow (optional)

These are in your `.env` but not used by the deploy workflow (safe to skip unless you extend the workflow):

- `Gmail`, `GmailPassword`, `CloudinaryEmail`, `NodemailerAppname`
- `DB_USER`, `DB_PASSWORD`, `DB_URL` (app uses `MONGO_URL`)

If you need them later, add to `deploy-server.yml` and GitHub secrets.

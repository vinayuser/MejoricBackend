# Server deployment (GitHub Actions)

Workflow: `.github/workflows/deploy-server.yml`

Manual deploy: **Actions → Deploy API (Server) → Run workflow**

## GitHub Environments

Create two environments (same as front/admin):

- `production`
- `staging`

Add secrets under **Settings → Environments → {environment} → Environment secrets**.

## Required secrets (both environments)

| Secret | Description |
|--------|-------------|
| `SSH_HOST` | Server IP / hostname |
| `SSH_USER` | SSH user (e.g. `root`) |
| `SSH_PASSWORD` | SSH password |
| `MONGO_URL` | MongoDB connection string |
| `JWT_SECRET` | JWT signing secret |

## Recommended secrets

| Secret | Production example | Staging example |
|--------|-------------------|-----------------|
| `SERVER_APP_DIR` | `/var/www/html/mejoric/Server` | `/var/www/html/mejoric/Server-staging` |
| `PM2_PROCESS_NAME` | `index` | `index-staging` |
| `PORT` | `3002` | `3007` |
| `NODEMAILER_EMAIL` | Gmail sender | same or test |
| `NODEMAILER_PASSWORD` | App password | same |
| `RAZORPAY_KEY_ID` | Live/test key | test key |
| `RAZORPAY_KEY_SECRET` | | |
| `AGORA_APP_ID` | | |
| `AGORA_APP_CERTIFICATE` | | |
| `FRONTEND_BASE_URL` | `https://mejoric.com` | `https://dev.mejoric.com` |
| `WEB_BASE_URL` | `https://mejoric.com` | `https://dev.mejoric.com` |
| `ADMIN_BASE_URL` | `https://admin.mejoric.com` | `https://admin-dev.mejoric.com` |
| `IS_STAGING` | `false` | `true` |
| `ALLOW_MOCK_PAYMENTS` | `false` | `true` |

## Optional secrets

All other vars from `Server/.env.example` can be added with the **same name** as the env key:

`CLOUD_NAME`, `CLOUD_API_KEY`, `CLOUD_SECRET`, `SENTRY_DSN`, `ZOOM_*`, `CLOUDFLARE_*`, `TWO_FACTOR_*`, pricing vars, etc.

The workflow writes `Server/.env` on the server from these secrets on every deploy.

## Firebase

Keep `firebaseServiceKeys.json` on the server outside git. Set:

```
FIREBASE_SERVICE_ACCOUNT_PATH=../firebaseServiceKeys.json
```

(or the absolute path on your VPS).

## First-time server setup

```bash
cd /var/www/html/mejoric/Server   # or your SERVER_APP_DIR
git clone <repo-url> .
npm install
pm2 start index.js --name index
pm2 save
pm2 startup
```

Staging (port 3007):

```bash
pm2 start index.js --name index-staging
```

Nginx should proxy:

- Production: `/mateandmentors/` → `127.0.0.1:3002`
- Staging: `/staging-api/` → `127.0.0.1:3007`

## Notes

- Same pattern as `front/.github/workflows/deploy-front.yml`: secrets live in GitHub Environment, not in the repo.
- `.env` on the server is **regenerated** each deploy — do not edit it manually on the server.
- If the repo root is a monorepo, set `SERVER_APP_DIR` to the path that contains `Server/package.json` and `Server/index.js`.

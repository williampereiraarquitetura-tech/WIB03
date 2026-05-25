# Deploy Guide — Urban Nexus (WIB03)

Stack: Railway (API) · Neon (PostgreSQL) · Google Drive (file storage) · Expo (mobile app)

---

## 1. Google Drive — Service Account setup

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a project (or select an existing one)
3. Enable the **Google Drive API**: APIs & Services → Library → "Google Drive API" → Enable
4. Create a Service Account: APIs & Services → Credentials → Create Credentials → Service Account
   - Name: `wib-storage` (any name works)
   - Role: not required at project level
5. Open the service account → **Keys** tab → Add Key → JSON → Download the file
6. Create a folder in Google Drive for file uploads
7. Share that folder with the service account email (e.g. `wib-storage@project-id.iam.gserviceaccount.com`) with **Editor** role
8. Copy the folder ID from the folder URL:
   `https://drive.google.com/drive/folders/THIS_IS_THE_FOLDER_ID`

### Encoding the key for Railway

The downloaded JSON key file needs to be passed as a single-line env var.
Two options:

**Option A — Raw JSON** (works if the JSON has no newlines):
```
GOOGLE_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"..."}
```

**Option B — Base64 encoded** (recommended for Railway):
```bash
# macOS / Linux
base64 -i path/to/service-account.json | tr -d '\n'

# Windows PowerShell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("path\to\service-account.json"))
```
Paste the output as the value of `GOOGLE_SERVICE_ACCOUNT_KEY`.

---

## 2. Neon — PostgreSQL setup

1. Sign up at [neon.tech](https://neon.tech) (free tier available)
2. Create a new project → choose a region close to your Railway deployment
3. Copy the **Connection String** (looks like `postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require`)

---

## 3. Railway — API deployment

1. Sign up at [railway.app](https://railway.app)
2. New Project → Deploy from GitHub repo → select this repository
3. Railway detects `railway.toml` automatically

### Environment variables to set in Railway:

| Variable | Value |
|---|---|
| `DATABASE_URL` | Neon connection string |
| `OPENAI_API_KEY` | Your OpenAI API key |
| `STORAGE_PROVIDER` | `google-drive` |
| `GOOGLE_SERVICE_ACCOUNT_KEY` | Base64-encoded service account JSON |
| `GOOGLE_DRIVE_FOLDER_ID` | Folder ID from step 1 |
| `NODE_ENV` | `production` |

> `PORT` is set automatically by Railway — do not override it.

4. Deploy. Railway will:
   - Install dependencies (`pnpm install`)
   - Build the API (`esbuild`)
   - On startup: push the DB schema to Neon (`drizzle-kit push`)
   - Start the server

5. Once deployed, copy the Railway public URL (e.g. `https://wib-api.up.railway.app`)

---

## 4. Expo — mobile app configuration

Set the API URL before building or running Expo:

```bash
# .env (local dev)
EXPO_PUBLIC_API_URL=http://192.168.x.x:3000   # your local IP

# .env (production build)
EXPO_PUBLIC_API_URL=https://wib-api.up.railway.app
```

### Run on device (local development)

```bash
cd artifacts/wib
pnpm start          # start Metro bundler
```

Scan the QR code with Expo Go on your phone. Make sure your phone and PC are on the same Wi-Fi network.

### Build for production (EAS Build)

```bash
npm install -g eas-cli
eas login
eas build --platform android   # or ios
```

---

## 5. Database migrations

Migrations run automatically on Railway startup via `drizzle-kit push`.

To run manually during local development:

```bash
cd lib/db
pnpm run push
```

---

## 6. Troubleshooting

| Problem | Fix |
|---|---|
| `GOOGLE_SERVICE_ACCOUNT_KEY env var not set` | Add the variable in Railway dashboard |
| `GOOGLE_DRIVE_FOLDER_ID env var not set` | Add the folder ID in Railway dashboard |
| `403 Forbidden` uploading to Drive | Make sure the Drive folder is shared with the service account email |
| `Cannot connect to database` | Check `DATABASE_URL` and that Neon allows connections from Railway IPs |
| Health check failing | Check `/api/healthz` returns `{"status":"ok"}` |

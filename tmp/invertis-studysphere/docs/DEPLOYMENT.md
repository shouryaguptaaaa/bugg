# Deployment guide

Suggested: **MongoDB Atlas** (database) + **Cloudinary** (files) + **Render** (backend) + **Vercel** (frontend).

## 1. MongoDB Atlas
1. Create a free cluster, a database user, and allow network access (0.0.0.0/0 for Render's dynamic IPs).
2. Copy the connection string into `MONGODB_URI`.
3. Enable **Cloud Backups** (paid tiers) or schedule `mongodump` for production data.

## 2. Cloudinary
Create a free account and copy cloud name, API key and secret. With these three set, the backend stores files in Cloudinary automatically. Render's disk is wiped on every deploy, so do not use local storage in production.

## 3. Backend on Render
- New **Web Service** from your GitHub repo, root directory `backend`.
- Build command `npm install`, start command `npm start`.
- Environment variables (never commit them):

| Variable | Value |
|---|---|
| `NODE_ENV` | `production` |
| `MONGODB_URI` | Atlas string |
| `JWT_SECRET` | 48+ random characters |
| `CLIENT_URL` | your Vercel URL, e.g. `https://studysphere.vercel.app` |
| `CLOUDINARY_CLOUD_NAME` / `_API_KEY` / `_API_SECRET` | from Cloudinary |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | optional, for real emails |

- After first deploy open the Render **Shell** and run `npm run seed` then `npm run create-admin`.
- Health check path: `/api/health`.

## 4. Frontend on Vercel
- Import the repo, root directory `frontend`, framework Vite.
- Edit `frontend/vercel.json` and replace `YOUR-BACKEND.onrender.com` with your Render host. The `/api` rewrite keeps login cookies first-party (same domain), so no cross-site cookie problems.
- Leave `VITE_API_URL` empty.

### Real-time notifications on this setup
Vercel rewrites cannot proxy WebSockets, and a cookie set for your Vercel domain is not sent to the Render domain. The notification bell therefore falls back to refreshing **every 60 seconds** (still correct, just not instant). For instant push put frontend and backend under one domain (for example both behind your own domain with `app.` and `api.` sub-domains and `COOKIE_SAMESITE=lax` with a shared parent cookie domain) or host both on one VPS behind nginx.

## 5. Backup & recovery
- Database: Atlas backups, or Admin panel → Storage → **Download database snapshot** (Super Admin; JSON, passwords excluded). Restore by importing the collections with `mongoimport`.
- Files: Cloudinary keeps them; export periodically via its Admin API if you need an offline copy.
- The recycle bin keeps deleted materials for 30 days.

## 6. Security checklist
- `.env` is git-ignored. Rotate `JWT_SECRET` if it ever leaks (all users must then sign in again).
- Remove `SUPERADMIN_PASSWORD` from the environment after `create-admin`.
- Keep `allowRegistration` on only while you want open sign-ups (Website Settings).
- Malware scanning: the API validates file types by extension and magic bytes. For antivirus scanning put ClamAV or your storage provider's scanner in front of uploads; this is not built in.

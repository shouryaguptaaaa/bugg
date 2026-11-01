# Invertis StudySphere

Premium full-stack university learning platform: study materials, quizzes, assignments, planner, discussion forum and an admin panel.

**Developed & powered by SHOURYA VEXORA** · Founder: Shourya Maheshwari
*Your University. Your Knowledge. Your Future.*

> StudySphere is an independent product. It does not claim any partnership with, or endorsement by, Invertis University. University branding needs the university's permission.

## Structure

```
invertis-studysphere/
├── backend/    Node.js + Express + MongoDB (Mongoose) REST API
├── frontend/   React + Vite + TypeScript + Tailwind CSS
└── docs/       API.md, SETUP.md, DEPLOYMENT.md
```

## What is included

| Area | Features |
|---|---|
| Auth & roles | Register, login, admin login, email verification, forgot / reset password, change password, profile + avatar, HttpOnly JWT cookie, 4 roles (Super Admin, Admin, Content Manager, Student), Super Admin editable role permissions, first Super Admin created only by a server-side script |
| Academic structure | Course → Branch → Semester → Subject → Module, categories, academic years. All stored in the database and managed from the admin panel (`npm run seed` only adds the starting data: B.Tech, CSE, Semester 1–8) |
| Materials | PDF/DOC/DOCX/PPT/PPTX/XLS/XLSX/ZIP/JPG/PNG/MP4, drag & drop, multi upload with progress, edit, replace file (version history), PDF preview, protected download, share link, bookmarks, reports, views/downloads tracking, approval workflow, draft/published, scheduled publishing, duplicate detection (SHA-256), bulk upload/delete/categorise, recycle bin with restore |
| Student area | Dashboard, search with suggestions, filters and history, PYQ portal (year-wise, exam type), notes, study folders, reading progress, study planner (week / calendar / to-do / goals / reminders) |
| Learning | Quizzes (timed, randomised, auto-graded, review with explanations, topic practice, leaderboard, analytics), assignments (submit, late flag, resubmit history, grading + feedback), discussion forum (likes, helpful answer, reports, moderation) |
| Notifications | In-app centre, read/unread, mark all read, preferences, real-time via Socket.IO, optional email |
| Admin | Dashboard, analytics (Recharts, 7/30/90 days + custom range), users, content, quizzes, assignments, forum moderation, announcements, FAQs, contact messages, website + company settings, audit logs, storage + health, JSON database backup |
| Security | bcrypt, JWT in HttpOnly cookie, RBAC on every API route, Zod validation, rate limiting, helmet, CORS allow-list, file type + magic-byte validation, size limit, ownership checks, audit log |

There is **no AI functionality** anywhere in the platform.

## Quick start (local)

See [docs/SETUP.md](docs/SETUP.md). In short:

```bash
cd backend  && cp .env.example .env   # fill MONGODB_URI and JWT_SECRET
npm install && npm run seed && npm run create-admin && npm run dev

cd ../frontend && cp .env.example .env
npm install && npm run dev            # http://localhost:5173
```

Deployment (Vercel + Render + MongoDB Atlas + Cloudinary): [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md). API reference: [docs/API.md](docs/API.md).

## Honest status

`npm install` and `npm run build` have still **not** been run in a networked environment, so expect small issues on your first run. Checked in the last review pass: every backend file passes a Node syntax check, all relative imports and named exports resolve, there are no undefined identifiers, the 6 unit tests pass, the frontend bundles cleanly with esbuild, every lazy-loaded page export exists, and every frontend API call matches a backend route.

Fixed in the last review pass:

- **Toast re-render bug** (`components/ui.tsx`): the toast context value was a new object on every render, so every toast restarted the Socket.IO connection in `NotificationBell` and could reset the quiz timer effect. It is now memoised.
- **Upload path check** (`utils/storage.js`): the local-disk folder check now requires a path separator, so a sibling folder with the same prefix can no longer pass.
- **multer** upgraded from 1.x to `^2.0.2` (1.x has known security advisories). The API used here is unchanged.

First-run checklist: [docs/SETUP.md](docs/SETUP.md#first-run-checklist).

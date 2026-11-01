# Local setup

Requirements: Node.js 18+ (20/22 recommended), a MongoDB database (free MongoDB Atlas cluster, or local MongoDB).

## 1. Backend

```bash
cd backend
cp .env.example .env
```

Edit `.env`:

- `MONGODB_URI` – Atlas connection string (`mongodb+srv://...`) or `mongodb://127.0.0.1:27017/invertis_studysphere`
- `JWT_SECRET` – long random text. Generate: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
- Cloudinary values are optional. When empty, files are stored in `backend/uploads` (good for development).
- SMTP values are optional. When empty, emails (verification, password reset) are **printed in the server console**, and email verification is skipped.

```bash
npm install
npm run seed          # categories, B.Tech > CSE > Semester 1-8, academic year, default settings
npm run create-admin  # creates the first Super Admin (asks name, email, password)
npm run dev           # API on http://localhost:5000
```

`create-admin` is the only way to create the first Super Admin. Public registration always creates students.

## 2. Frontend

```bash
cd frontend
cp .env.example .env     # leave VITE_API_URL empty in development
npm install
npm run dev              # http://localhost:5173 (Vite proxies /api and /socket.io to :5000)
```

Sign in as admin at `http://localhost:5173/admin/login`.

## 3. First steps in the admin panel

1. **Academic Structure**: add subjects (and modules) under Semester 1–8.
2. **Upload Material**: pick the subject and category, drag in files, publish.
3. **Website Settings**: contact details, company info, logo URL.
4. **Role Permissions** (Super Admin): choose what Admins and Content Managers can do. New installs use sensible defaults.
5. Create a quiz (Quizzes → New quiz → add questions → Publish) and an assignment.

## Tests

```bash
cd backend && npm test      # unit tests (no database needed)
cd frontend && npm run typecheck && npm run build
```

## First-run checklist

The code could not be installed or executed where it was written, so on your first run:

1. `npm install` in both folders. If `npm run build` or `npm run typecheck` reports an error, it will name the exact file and line. These are usually small typing issues.
2. Start the backend and check `http://localhost:5000/api/health` shows `{"status":"ok","db":true}`.
3. Walk through: register a student, log in, upload a material as admin, download it as a student, start a quiz, submit an assignment, post in the forum, check notifications.
4. If something fails, copy the error text and fix or ask for help with that specific message.

## Notes

- Quiz timers use the **server** clock, so a changed device clock cannot extend an exam.
- Scheduled publishing, assignment deadline reminders and planner reminders are processed by a background job that runs every minute inside the API process.
- Permissions added in later versions (`quizzes.manage`, `assignments.manage`, `forum.moderate`) are included in the defaults. If you had already saved custom permissions for a role, tick the new ones in Role Permissions.

# REST API reference

Base URL: `/api`. Authentication is an HttpOnly cookie (`ss_token`, also accepts `Authorization: Bearer`). Errors return `{ "message": "...", "details"?: ... }`. Bodies are JSON except uploads (multipart/form-data).

Access column: **public** = no login, **login** = any signed-in user, `perm` = needs that permission (Super Admin always passes), **super_admin** = Super Admin only. Routes in a file that calls `router.use(authenticate)` need login.


## /api/auth

| Method | Path | Access |
|---|---|---|
| POST | `/api/auth/register` | public |
| POST | `/api/auth/login` | public |
| POST | `/api/auth/admin-login` | public |
| POST | `/api/auth/logout` | public |
| GET | `/api/auth/me` | login |
| GET | `/api/auth/verify-email` | public |
| POST | `/api/auth/forgot-password` | public |
| POST | `/api/auth/reset-password` | public |
| POST | `/api/auth/change-password` | login |
| PATCH | `/api/auth/profile` | login |
| POST | `/api/auth/avatar` | login |
| GET | `/api/auth/avatar/:id` | public |

## /api/academic

| Method | Path | Access |
|---|---|---|
| GET | `/api/academic/:kind` | public |
| POST | `/api/academic/:kind` | academic.manage |
| PATCH | `/api/academic/:kind/:id` | academic.manage |
| DELETE | `/api/academic/:kind/:id` | academic.manage |

## /api/materials

| Method | Path | Access |
|---|---|---|
| GET | `/api/materials/:id/reviews` | public (login optional) |
| PUT | `/api/materials/:id/reviews` | login |
| DELETE | `/api/materials/:id/reviews` | login |

## /api/materials

| Method | Path | Access |
|---|---|---|
| GET | `/api/materials` | public |
| GET | `/api/materials/suggest` | public |
| GET | `/api/materials/manage/list` | login |
| POST | `/api/materials` | materials.upload |
| POST | `/api/materials/bulk` | login |
| GET | `/api/materials/:id` | public (login optional) |
| GET | `/api/materials/:id/related` | public |
| POST | `/api/materials/:id/view` | public (login optional) |
| GET | `/api/materials/:id/thumbnail` | public |
| GET | `/api/materials/:id/preview` | login |
| GET | `/api/materials/:id/download` | login |
| POST | `/api/materials/:id/bookmark` | login |
| POST | `/api/materials/:id/report` | login |
| PATCH | `/api/materials/:id` | login |
| PUT | `/api/materials/:id/file` | login |
| DELETE | `/api/materials/:id` | materials.delete |
| POST | `/api/materials/:id/restore` | materials.delete |
| DELETE | `/api/materials/:id/permanent` | materials.delete |
| POST | `/api/materials/:id/approve` | materials.approve |
| POST | `/api/materials/:id/reject` | materials.approve |

## /api/me

| Method | Path | Access |
|---|---|---|
| GET | `/api/me/dashboard` | login |
| GET | `/api/me/downloads` | login |
| GET | `/api/me/bookmarks` | login |

## /api/me

| Method | Path | Access |
|---|---|---|
| GET | `/api/me/notes` | login |
| POST | `/api/me/notes` | login |
| PATCH | `/api/me/notes/:id` | login |
| DELETE | `/api/me/notes/:id` | login |
| GET | `/api/me/folders` | login |
| POST | `/api/me/folders` | login |
| PATCH | `/api/me/folders/:id` | login |
| DELETE | `/api/me/folders/:id` | login |
| POST | `/api/me/folders/:id/materials` | login |
| DELETE | `/api/me/folders/:id/materials/:mid` | login |
| GET | `/api/me/plans` | login |
| GET | `/api/me/plans/summary` | login |
| POST | `/api/me/plans` | login |
| PATCH | `/api/me/plans/:id` | login |
| DELETE | `/api/me/plans/:id` | login |
| GET | `/api/me/progress` | login |
| GET | `/api/me/progress/:materialId` | login |
| PUT | `/api/me/progress/:materialId` | login |
| GET | `/api/me/searches` | login |
| POST | `/api/me/searches` | login |
| DELETE | `/api/me/searches` | login |
| DELETE | `/api/me/searches/:id` | login |

## /api/notifications

| Method | Path | Access |
|---|---|---|
| GET | `/api/notifications` | login |
| GET | `/api/notifications/unread-count` | login |
| POST | `/api/notifications/read-all` | login |
| GET | `/api/notifications/prefs` | login |
| PUT | `/api/notifications/prefs` | login |
| PATCH | `/api/notifications/:id/read` | login |
| DELETE | `/api/notifications/:id` | login |

## /api/quizzes

| Method | Path | Access |
|---|---|---|
| GET | `/api/quizzes` | login |
| GET | `/api/quizzes/practice/topics` | login |
| POST | `/api/quizzes/practice/start` | login |
| POST | `/api/quizzes/:id/start` | login |
| POST | `/api/quizzes/attempts/:attemptId/submit` | login |
| GET | `/api/quizzes/attempts/:attemptId` | login |
| GET | `/api/quizzes/me/history` | login |
| GET | `/api/quizzes/me/analytics` | login |
| GET | `/api/quizzes/leaderboard` | login |
| GET | `/api/quizzes/manage/list` | quizzes.manage |
| POST | `/api/quizzes` | quizzes.manage |
| GET | `/api/quizzes/:id/manage` | quizzes.manage |
| PATCH | `/api/quizzes/:id` | quizzes.manage |
| DELETE | `/api/quizzes/:id` | quizzes.manage |
| POST | `/api/quizzes/:id/questions` | quizzes.manage |
| PATCH | `/api/quizzes/questions/:qid` | quizzes.manage |
| DELETE | `/api/quizzes/questions/:qid` | quizzes.manage |

## /api/assignments

| Method | Path | Access |
|---|---|---|
| GET | `/api/assignments` | login |
| GET | `/api/assignments/manage/list` | assignments.manage |
| GET | `/api/assignments/:id` | login |
| GET | `/api/assignments/:id/reference` | login |
| POST | `/api/assignments/:id/submit` | login |
| GET | `/api/assignments/submissions/:sid/file` | login |
| POST | `/api/assignments` | assignments.manage |
| PATCH | `/api/assignments/:id` | assignments.manage |
| DELETE | `/api/assignments/:id` | assignments.manage |
| GET | `/api/assignments/:id/submissions` | assignments.manage |
| PATCH | `/api/assignments/submissions/:sid/review` | assignments.manage |

## /api/forum

| Method | Path | Access |
|---|---|---|
| GET | `/api/forum` | login |
| GET | `/api/forum/mine/replies` | login |
| POST | `/api/forum` | login |
| GET | `/api/forum/moderation/queue` | forum.moderate |
| PATCH | `/api/forum/moderation/:kind/:id` | forum.moderate |
| GET | `/api/forum/:id` | login |
| POST | `/api/forum/:id/replies` | login |
| DELETE | `/api/forum/:id` | login |
| DELETE | `/api/forum/replies/:rid` | login |
| POST | `/api/forum/replies/:rid/like` | login |
| POST | `/api/forum/replies/:rid/helpful` | login |
| POST | `/api/forum/:kind(discussion|reply)/:id/report` | login |

## /api/public

| Method | Path | Access |
|---|---|---|
| GET | `/api/public/settings` | public |
| GET | `/api/public/home` | public |
| GET | `/api/public/faqs` | public |
| GET | `/api/public/announcements` | public |
| POST | `/api/public/contact` | public |

## /api/admin

| Method | Path | Access |
|---|---|---|
| GET | `/api/admin/stats` | analytics.view |
| GET | `/api/admin/analytics` | analytics.view |
| GET | `/api/admin/health` | analytics.view |
| GET | `/api/admin/users` | users.manage |
| POST | `/api/admin/users` | users.manage |
| PATCH | `/api/admin/users/:id` | users.manage |
| GET | `/api/admin/permissions` | super_admin |
| PUT | `/api/admin/permissions/:role` | super_admin |
| GET | `/api/admin/settings` | settings.manage |
| PUT | `/api/admin/settings` | settings.manage |
| GET | `/api/admin/audit-logs` | audit.view |
| PATCH | `/api/admin${path}/:id` | communication.manage |
| GET | `/api/admin/contact-messages` | communication.manage |
| PATCH | `/api/admin/contact-messages/:id` | communication.manage |
| DELETE | `/api/admin/contact-messages/:id` | communication.manage |
| GET | `/api/admin/reports` | reports.manage |
| PATCH | `/api/admin/reports/:id` | reports.manage |
| GET | `/api/admin/backup` | super_admin |
| GET | `/api/admin/announcements` | communication.manage |
| POST | `/api/admin/announcements` | communication.manage |
| PATCH | `/api/admin/announcements/:id` | communication.manage |
| DELETE | `/api/admin/announcements/:id` | communication.manage |
| GET | `/api/admin/faqs` | communication.manage |
| POST | `/api/admin/faqs` | communication.manage |
| PATCH | `/api/admin/faqs/:id` | communication.manage |
| DELETE | `/api/admin/faqs/:id` | communication.manage |

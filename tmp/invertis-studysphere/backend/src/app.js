import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import { env } from './config/env.js';
import { errorHandler, notFound } from './middleware/errors.js';
import authRoutes from './routes/auth.js';
import academicRoutes from './routes/academic.js';
import materialRoutes from './routes/materials.js';
import meRoutes from './routes/me.js';
import publicRoutes from './routes/public.js';
import adminRoutes from './routes/admin.js';
import workspaceRoutes from './routes/workspace.js';
import notificationRoutes from './routes/notifications.js';
import quizRoutes from './routes/quizzes.js';
import assignmentRoutes from './routes/assignments.js';
import forumRoutes from './routes/forum.js';
import reviewRoutes from './routes/reviews.js';

const app = express();
app.set('trust proxy', 1); // Render / Vercel / nginx sit in front of the app

app.use(helmet());
app.use(
  cors({
    origin(origin, cb) {
      // allow same-origin / server-to-server (no Origin header) and the configured frontends
      if (!origin || env.clientUrls.includes(origin)) return cb(null, true);
      cb(new Error('Origin not allowed by CORS'));
    },
    credentials: true,
  })
);
app.use(compression());
app.use(express.json({ limit: '200kb' }));
app.use(express.urlencoded({ extended: true, limit: '200kb' }));
app.use(cookieParser());
if (!env.isProd) app.use(morgan('dev'));

const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 600, standardHeaders: true, legacyHeaders: false, message: { message: 'Too many requests, please slow down.' } });
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false, message: { message: 'Too many attempts. Try again in a few minutes.' } });
const contactLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false, message: { message: 'Too many messages. Try again later.' } });

app.use('/api', apiLimiter);
app.get('/api/health', (_req, res) => res.json({ status: 'ok', db: mongoose.connection.readyState === 1 }));

app.use('/api/auth/login', authLimiter);
app.use('/api/auth/admin-login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/forgot-password', authLimiter);
app.use('/api/auth/reset-password', authLimiter);
app.use('/api/public/contact', contactLimiter);

app.use('/api/auth', authRoutes);
app.use('/api/academic', academicRoutes);
app.use('/api/materials', reviewRoutes);
app.use('/api/materials', materialRoutes);
app.use('/api/me', meRoutes);
app.use('/api/me', workspaceRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/quizzes', quizRoutes);
app.use('/api/assignments', assignmentRoutes);
app.use('/api/forum', forumRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/admin', adminRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;

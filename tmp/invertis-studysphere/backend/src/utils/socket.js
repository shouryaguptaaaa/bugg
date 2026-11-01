import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import cookie from 'cookie';
import { env } from '../config/env.js';

let io = null;

/** Real-time layer: each signed-in user joins a private room `user:<id>` (authenticated with the same HttpOnly cookie). */
export function initSocket(httpServer) {
  io = new Server(httpServer, { cors: { origin: env.clientUrls, credentials: true }, path: '/socket.io' });
  io.use((socket, next) => {
    try {
      const raw = socket.handshake.headers.cookie || '';
      const token = cookie.parse(raw).ss_token;
      if (!token) return next(new Error('unauthorized'));
      socket.userId = jwt.verify(token, env.jwtSecret).sub;
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });
  io.on('connection', (socket) => socket.join(`user:${socket.userId}`));
  return io;
}

export function emitToUser(userId, event, payload) {
  io?.to(`user:${String(userId)}`).emit(event, payload);
}

import http from 'http';
import mongoose from 'mongoose';
import { env } from './config/env.js';
import app from './app.js';
import { Material } from './models/Material.js';
import { removeFile } from './utils/storage.js';
import { initSocket } from './utils/socket.js';
import { startJobs } from './utils/jobs.js';

async function purgeOldTrash() {
  // Recycle bin items are kept for 30 days, then permanently removed
  const cutoff = new Date(Date.now() - 30 * 86400000);
  const old = await Material.find({ deletedAt: { $ne: null, $lt: cutoff } });
  for (const m of old) {
    await removeFile(m.file);
    for (const v of m.versions) await removeFile(v.file);
    await m.deleteOne();
  }
  if (old.length) console.log(`Purged ${old.length} material(s) from the recycle bin`);
}

async function main() {
  mongoose.set('strictQuery', true);
  await mongoose.connect(env.mongoUri);
  console.log('MongoDB connected');
  const server = http.createServer(app);
  initSocket(server); // real-time notifications
  server.listen(env.port, () => console.log(`StudySphere API listening on port ${env.port}`));
  startJobs(); // material / deadline / reminder notifications
  purgeOldTrash().catch((e) => console.error('Trash purge failed', e.message));
  setInterval(() => purgeOldTrash().catch(() => {}), 24 * 3600 * 1000).unref();

  const shutdown = () => server.close(() => mongoose.disconnect().then(() => process.exit(0)));
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((e) => {
  console.error('Failed to start:', e.message);
  process.exit(1);
});

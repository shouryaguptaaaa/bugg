import { User } from '../models/User.js';
import { Notification } from '../models/Personal.js';
import { sendMail } from './mailer.js';
import { emitToUser } from './socket.js';

/**
 * Creates in-app notifications (respecting each user's preferences), pushes them in real time over
 * Socket.IO when the user is online, and sends an email when SMTP is configured and the user opted in.
 *
 * `to` is an array of user ids, or { role: 'student' } to broadcast to every active user of that role.
 */
export async function notify(to, { type, title, body = '', link }) {
  try {
    const filter = Array.isArray(to) ? { _id: { $in: to }, status: 'active' } : { status: 'active', ...to };
    const users = await User.find(filter).select('email name notifyPrefs');
    const targets = users.filter((u) => u.notifyPrefs?.[type] !== false);
    if (!targets.length) return 0;
    const docs = await Notification.insertMany(targets.map((u) => ({ user: u._id, type, title, body, link })));
    docs.forEach((d) => emitToUser(d.user, 'notification', d));
    // Email only for small targeted sends (broadcast emails need a proper queue)
    if (targets.length <= 20) {
      for (const u of targets.filter((x) => x.notifyPrefs?.email)) sendMail({ to: u.email, subject: title, text: body || title }).catch(() => {});
    }
    return docs.length;
  } catch (e) {
    console.error('notify failed:', e.message);
    return 0;
  }
}

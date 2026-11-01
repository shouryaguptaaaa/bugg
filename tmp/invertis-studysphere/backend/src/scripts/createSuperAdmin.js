// Secure server-side setup of the FIRST Super Admin. There is no public endpoint for this.
// Usage:
//   1) Set SUPERADMIN_NAME / SUPERADMIN_EMAIL / SUPERADMIN_PASSWORD in .env (or the shell), then: npm run create-admin
//   2) or run `npm run create-admin` and answer the prompts.
// Remove SUPERADMIN_PASSWORD from .env afterwards.
import readline from 'readline/promises';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { User } from '../models/User.js';

let name = process.env.SUPERADMIN_NAME;
let email = process.env.SUPERADMIN_EMAIL;
let password = process.env.SUPERADMIN_PASSWORD;

if (!name || !email || !password) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  name = name || (await rl.question('Full name: '));
  email = email || (await rl.question('Email: '));
  password = password || (await rl.question('Password (min 8 chars, letters + numbers): '));
  rl.close();
}

email = email.trim().toLowerCase();
if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('Invalid email');
if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) throw new Error('Password must be 8+ chars with letters and numbers');

await mongoose.connect(env.mongoUri);
const existing = await User.findOne({ role: 'super_admin' });
if (existing) {
  console.log(`A Super Admin already exists (${existing.email}). Create more admins from the admin panel.`);
} else {
  await User.create({ name: name.trim(), email, passwordHash: await bcrypt.hash(password, 12), role: 'super_admin', emailVerified: true });
  console.log(`Super Admin created: ${email}`);
}
await mongoose.disconnect();

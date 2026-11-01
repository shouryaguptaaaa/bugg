import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

let transporter = null;
if (env.emailEnabled) {
  transporter = nodemailer.createTransport({
    host: env.smtp.host,
    port: env.smtp.port,
    secure: env.smtp.port === 465,
    auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.pass } : undefined,
  });
}

/**
 * Sends an email when SMTP is configured. Otherwise prints it to the server console
 * (handy for local development: you can copy reset / verify links from the terminal).
 */
export async function sendMail({ to, subject, text, html }) {
  if (!transporter) {
    console.log(`\n[mail disabled] To: ${to}\nSubject: ${subject}\n${text}\n`);
    return false;
  }
  await transporter.sendMail({ from: env.smtp.from, to, subject, text, html: html || text });
  return true;
}

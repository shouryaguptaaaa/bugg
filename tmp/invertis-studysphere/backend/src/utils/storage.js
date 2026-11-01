import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Readable } from 'stream';
import { env } from '../config/env.js';

let cloudinary = null;
if (env.cloudinaryEnabled) {
  const mod = await import('cloudinary');
  cloudinary = mod.v2;
  cloudinary.config({
    cloud_name: env.cloudinary.name,
    api_key: env.cloudinary.key,
    api_secret: env.cloudinary.secret,
    secure: true,
  });
}

const uploadRoot = path.resolve(env.uploadDir);
fs.mkdirSync(uploadRoot, { recursive: true });

export const storageDriver = cloudinary ? 'cloudinary' : 'local';

/** Stores a buffer and returns {storage, key, url?}. */
export async function saveBuffer(buffer, ext, folder = 'materials') {
  const name = `${crypto.randomBytes(16).toString('hex')}${ext}`;
  if (cloudinary) {
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: `studysphere/${folder}`, resource_type: 'raw', public_id: name, use_filename: false },
        (err, r) => (err ? reject(err) : resolve(r))
      );
      stream.end(buffer);
    });
    return { storage: 'cloudinary', key: result.public_id, url: result.secure_url };
  }
  const dir = path.join(uploadRoot, folder);
  fs.mkdirSync(dir, { recursive: true });
  await fs.promises.writeFile(path.join(dir, name), buffer);
  return { storage: 'local', key: `${folder}/${name}` };
}

/** Returns a Node readable stream for a stored file object ({storage,key,url}). */
export async function openStream(file) {
  if (file.storage === 'cloudinary') {
    const r = await fetch(file.url);
    if (!r.ok || !r.body) throw new Error('Stored file could not be fetched');
    return Readable.fromWeb(r.body);
  }
  const full = path.join(uploadRoot, file.key);
  if (!full.startsWith(uploadRoot + path.sep)) throw new Error('Invalid file path');
  await fs.promises.access(full);
  return fs.createReadStream(full);
}

export async function removeFile(file) {
  try {
    if (!file) return;
    if (file.storage === 'cloudinary' && cloudinary) {
      await cloudinary.uploader.destroy(file.key, { resource_type: 'raw' });
    } else if (file.storage === 'local') {
      const full = path.join(uploadRoot, file.key);
      if (full.startsWith(uploadRoot + path.sep)) await fs.promises.unlink(full);
    }
  } catch (e) {
    console.error('removeFile failed:', e.message);
  }
}

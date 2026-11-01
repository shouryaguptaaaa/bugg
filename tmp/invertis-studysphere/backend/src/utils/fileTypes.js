import path from 'path';

// Allowed study-material formats: extension -> { mime, signature check }
const isPdf = (b) => b.slice(0, 4).toString() === '%PDF';
const isZipLike = (b) => b[0] === 0x50 && b[1] === 0x4b; // "PK"
const isOle = (b) => b[0] === 0xd0 && b[1] === 0xcf && b[2] === 0x11 && b[3] === 0xe0; // legacy Office
const isJpg = (b) => b[0] === 0xff && b[1] === 0xd8;
const isPng = (b) => b[0] === 0x89 && b.slice(1, 4).toString() === 'PNG';
const isMp4 = (b) => b.slice(4, 8).toString() === 'ftyp';

export const ALLOWED = {
  '.pdf': { mime: 'application/pdf', check: isPdf },
  '.doc': { mime: 'application/msword', check: isOle },
  '.docx': { mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', check: isZipLike },
  '.ppt': { mime: 'application/vnd.ms-powerpoint', check: isOle },
  '.pptx': { mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', check: isZipLike },
  '.xls': { mime: 'application/vnd.ms-excel', check: isOle },
  '.xlsx': { mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', check: isZipLike },
  '.zip': { mime: 'application/zip', check: isZipLike },
  '.jpg': { mime: 'image/jpeg', check: isJpg },
  '.jpeg': { mime: 'image/jpeg', check: isJpg },
  '.png': { mime: 'image/png', check: isPng },
  '.mp4': { mime: 'video/mp4', check: isMp4 },
};

export const IMAGE_EXTS = ['.jpg', '.jpeg', '.png'];
export const PREVIEWABLE_EXTS = ['.pdf', '.jpg', '.jpeg', '.png', '.mp4'];

/** Validates a multer file by extension AND magic bytes. Returns {ext, mime} or throws a string message. */
export function validateUpload(file, allowedExts = Object.keys(ALLOWED)) {
  const ext = path.extname(file.originalname || '').toLowerCase();
  if (!allowedExts.includes(ext) || !ALLOWED[ext]) {
    throw `"${file.originalname}": file type ${ext || '(none)'} is not allowed`;
  }
  if (!file.buffer || file.buffer.length < 8 || !ALLOWED[ext].check(file.buffer)) {
    throw `"${file.originalname}": file content does not match its ${ext} extension`;
  }
  return { ext, mime: ALLOWED[ext].mime };
}

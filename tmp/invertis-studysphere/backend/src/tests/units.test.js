// Pure unit tests (no database needed): npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { validateUpload, ALLOWED } from '../utils/fileTypes.js';
import { PERMISSIONS, DEFAULT_ROLE_PERMISSIONS, ROLES } from '../config/permissions.js';

const file = (name, bytes) => ({ originalname: name, buffer: Buffer.concat([Buffer.from(bytes), Buffer.alloc(16)]) });

test('accepts a real PDF signature', () => {
  assert.equal(validateUpload(file('notes.pdf', '%PDF-1.7')).ext, '.pdf');
});
test('rejects a renamed executable', () => {
  assert.throws(() => validateUpload(file('virus.pdf', 'MZ\x90\x00')), /does not match/);
});
test('rejects unsupported extensions', () => {
  assert.throws(() => validateUpload(file('run.exe', 'MZ')), /not allowed/);
});
test('supports every format required by the spec', () => {
  for (const e of ['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx', '.zip', '.jpg', '.png', '.mp4']) assert.ok(ALLOWED[e], e);
});
test('every default permission exists in the catalogue', () => {
  for (const [role, perms] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
    assert.ok(ROLES.includes(role));
    for (const p of perms) assert.ok(PERMISSIONS[p], `${role}: ${p}`);
  }
});
test('students hold no staff permissions by default', () => {
  assert.deepEqual(DEFAULT_ROLE_PERMISSIONS.student, []);
});

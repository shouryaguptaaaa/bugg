import { PlatformSettings } from '../models/Platform.js';
import { DEFAULT_ROLE_PERMISSIONS } from '../config/permissions.js';

let cache = null;
let cachedAt = 0;
const TTL = 30_000;

export async function getSettings(fresh = false) {
  if (!fresh && cache && Date.now() - cachedAt < TTL) return cache;
  let doc = await PlatformSettings.findOne({ key: 'main' });
  if (!doc) doc = await PlatformSettings.create({ key: 'main' });
  cache = doc;
  cachedAt = Date.now();
  return doc;
}

export function invalidateSettings() {
  cache = null;
}

export async function getRolePermissions(role) {
  if (role === 'super_admin') return 'ALL';
  const s = await getSettings();
  const map = s.rolePermissions || DEFAULT_ROLE_PERMISSIONS;
  return map[role] ?? DEFAULT_ROLE_PERMISSIONS[role] ?? [];
}

export async function userCan(user, permission) {
  if (!user) return false;
  const perms = await getRolePermissions(user.role);
  return perms === 'ALL' || perms.includes(permission);
}

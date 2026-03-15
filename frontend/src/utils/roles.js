/**
 * Client-side role checks (keep in sync with backend rolePermissions).
 * SUPER_ADMIN | ADMINISTRATOR | DATA_CONTRIBUTOR | ANALYST | VIEWER
 */

export const ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMINISTRATOR: 'ADMINISTRATOR',
  DATA_CONTRIBUTOR: 'DATA_CONTRIBUTOR',
  ANALYST: 'ANALYST',
  VIEWER: 'VIEWER',
};

function normalize(role) {
  if (!role) return ROLES.VIEWER;
  const r = String(role).toUpperCase();
  if (r === 'USER') return ROLES.DATA_CONTRIBUTOR;
  if (r === 'ADMIN') return ROLES.ADMINISTRATOR;
  return r;
}

export function isAdministrator(role) {
  const n = normalize(role);
  return n === ROLES.SUPER_ADMIN || n === ROLES.ADMINISTRATOR;
}

export function canUpload(role) {
  const n = normalize(role);
  return [ROLES.SUPER_ADMIN, ROLES.ADMINISTRATOR, ROLES.DATA_CONTRIBUTOR].includes(n);
}

export function canAccessDashboard(role) {
  const n = normalize(role);
  if (n === ROLES.DATA_CONTRIBUTOR) return false;
  return [ROLES.SUPER_ADMIN, ROLES.ADMINISTRATOR, ROLES.ANALYST, ROLES.VIEWER].includes(n);
}

export function canGenerateReports(role) {
  const n = normalize(role);
  return [ROLES.SUPER_ADMIN, ROLES.ADMINISTRATOR, ROLES.ANALYST].includes(n);
}

export function canManageUsers(role) {
  return isAdministrator(role);
}

export function roleLabel(role) {
  const n = normalize(role);
  const labels = {
    [ROLES.SUPER_ADMIN]: 'Super Admin',
    [ROLES.ADMINISTRATOR]: 'Administrator',
    [ROLES.DATA_CONTRIBUTOR]: 'Data Contributor',
    [ROLES.ANALYST]: 'Analyst',
    [ROLES.VIEWER]: 'Viewer',
  };
  return labels[n] || role;
}

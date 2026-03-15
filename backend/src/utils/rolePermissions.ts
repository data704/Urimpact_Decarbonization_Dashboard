/**
 * Role model (aligned with product spec):
 * - SUPER_ADMIN: platform owner (URIMPACT) — full system access
 * - ADMINISTRATOR: full control of org inventory, users, settings
 * - DATA_CONTRIBUTOR: upload/submit only — no edit/delete, no reports, no company-wide dashboard
 * - ANALYST: view/analyze/report/export — no upload, no edit/delete, no user management
 * - VIEWER: read-only summaries — no upload, edit, reports, export, settings
 *
 * Legacy values USER / ADMIN are treated as DATA_CONTRIBUTOR / ADMINISTRATOR for backward compatibility.
 */

export type RoleString = string;

export const ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMINISTRATOR: 'ADMINISTRATOR',
  DATA_CONTRIBUTOR: 'DATA_CONTRIBUTOR',
  ANALYST: 'ANALYST',
  VIEWER: 'VIEWER',
  // Legacy
  USER: 'USER',
  ADMIN: 'ADMIN',
} as const;

function normalize(role: RoleString | undefined | null): string {
  if (!role) return ROLES.VIEWER;
  const r = String(role).toUpperCase();
  if (r === ROLES.USER) return ROLES.DATA_CONTRIBUTOR;
  if (r === ROLES.ADMIN) return ROLES.ADMINISTRATOR;
  return r;
}

/** Full platform/org control (upload, edit, delete, reports, users, settings) */
export function isAdministrator(role: RoleString): boolean {
  const n = normalize(role);
  return n === ROLES.SUPER_ADMIN || n === ROLES.ADMINISTRATOR;
}

/** Can upload receipts and submit emissions (Contributor) */
export function canUpload(role: RoleString): boolean {
  const n = normalize(role);
  return n === ROLES.SUPER_ADMIN || n === ROLES.ADMINISTRATOR || n === ROLES.DATA_CONTRIBUTOR;
}

/** Can add/edit/delete emissions and documents (Administrator only) */
export function canEditDeleteData(role: RoleString): boolean {
  return isAdministrator(role);
}

/** Can generate emissions/decarb reports and export datasets */
export function canGenerateReports(role: RoleString): boolean {
  const n = normalize(role);
  return (
    n === ROLES.SUPER_ADMIN ||
    n === ROLES.ADMINISTRATOR ||
    n === ROLES.ANALYST
  );
}

/** Company-wide dashboards & analytics — not available to Data Contributor per spec */
export function canAccessDashboard(role: RoleString): boolean {
  const n = normalize(role);
  if (n === ROLES.DATA_CONTRIBUTOR) return false;
  return (
    n === ROLES.SUPER_ADMIN ||
    n === ROLES.ADMINISTRATOR ||
    n === ROLES.ANALYST ||
    n === ROLES.VIEWER
  );
}

/** Export raw datasets — Administrator & Analyst; Viewer cannot */
export function canExportDatasets(role: RoleString): boolean {
  const n = normalize(role);
  if (n === ROLES.VIEWER || n === ROLES.DATA_CONTRIBUTOR) return false;
  return canGenerateReports(role);
}

/** User management & permissions */
export function canManageUsers(role: RoleString): boolean {
  const n = normalize(role);
  return n === ROLES.SUPER_ADMIN || n === ROLES.ADMINISTRATOR;
}

/** Platform/settings configuration */
export function canConfigureSettings(role: RoleString): boolean {
  return canManageUsers(role);
}

/** Treat as org admin for document/emission ownership checks (see all org data) */
export function isOrgAdmin(role: RoleString): boolean {
  return isAdministrator(role);
}

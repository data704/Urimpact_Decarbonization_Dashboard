/**
 * Facility/site list per organization in localStorage (used by Scope 1 onboarding and related flows).
 * Used by Scope 1 onboarding for facility mapping on process-emission rows.
 */
export const DATA_INPUT_SITES_PREFIX = 'urimpact_data_input_sites_';

export function readSitesForOrganization(orgId) {
    if (!orgId) return [];
    try {
        const raw = localStorage.getItem(`${DATA_INPUT_SITES_PREFIX}${orgId}`);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) && parsed.length ? parsed : [];
    } catch (_) {
        return [];
    }
}

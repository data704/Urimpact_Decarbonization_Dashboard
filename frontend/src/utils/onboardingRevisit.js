import { isAdministrator } from './roles.js';

/** Query flag to reopen submitted onboarding wizards (admin testing / corrections). */
export const ONBOARDING_EDIT_QUERY = '?edit=1';

export function isOnboardingRevisitMode(searchParams) {
    return searchParams?.get('edit') === '1';
}

/** True when the user may load a wizard that is already marked complete on the session. */
export function canOpenRevisitOnboarding(role, searchParams) {
    return isOnboardingRevisitMode(searchParams) && isAdministrator(role);
}

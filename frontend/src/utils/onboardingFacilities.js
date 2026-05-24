import { DATA_INPUT_SITES_PREFIX } from './dataInputSitesStorage.js';

const DI_FACILITY_FROM_ONBOARDING = {
    CORPORATE_OFFICE: 'Office',
    HEAD_OFFICE: 'Office',
    SALES_OFFICE: 'Retail Outlet',
    WAREHOUSE: 'Warehouse',
    OTHER: 'Manufacturing Plant',
};

/**
 * Maps persisted company-onboarding facilities to Data Input site rows so manual entry stays aligned.
 */
export function syncOnboardingFacilitiesToDataInputSites(orgId, facilityRows) {
    if (!orgId || !Array.isArray(facilityRows) || facilityRows.length === 0) return;
    try {
        const mapped = facilityRows.map((f, i) => ({
            id: f.id,
            name: f.name,
            code: `FAC-${String(i + 1).padStart(2, '0')}`,
            country: '',
            city: '',
            facilityType:
                f.facilityType === 'OTHER' && (f.facilityTypeOther || '').trim()
                    ? 'Manufacturing Plant'
                    : DI_FACILITY_FROM_ONBOARDING[f.facilityType] || 'Office',
            boundary: 'Operational Control',
            currency: 'SAR — Saudi Riyal',
            utilityProvider: '',
        }));
        localStorage.setItem(`${DATA_INPUT_SITES_PREFIX}${orgId}`, JSON.stringify(mapped));
    } catch (_) {
        /* ignore */
    }
}

const FACILITY_TYPE_LABEL = {
    CORPORATE_OFFICE: 'Corporate Office',
    HEAD_OFFICE: 'Head Office',
    SALES_OFFICE: 'Sales Office',
    WAREHOUSE: 'Warehouse',
    OTHER: 'Other',
};

/**
 * Shape used by Scope 1 process-emission facility dropdown (compatible with Data Input site pickers).
 */
export function onboardingFacilitiesToSiteOptions(rows) {
    if (!Array.isArray(rows) || rows.length === 0) return [];
    return rows.map((f, i) => ({
        id: f.id,
        name: f.name,
        code: `FAC-${String(i + 1).padStart(2, '0')}`,
        city: '',
        facilityType:
            f.facilityType === 'OTHER'
                ? (f.facilityTypeOther || '').trim() || 'Other'
                : FACILITY_TYPE_LABEL[f.facilityType] || f.facilityType,
    }));
}

export const ONBOARDING_FACILITY_TYPES = [
    { value: 'CORPORATE_OFFICE', label: 'Corporate Office' },
    { value: 'HEAD_OFFICE', label: 'Head Office' },
    { value: 'SALES_OFFICE', label: 'Sales Office' },
    { value: 'WAREHOUSE', label: 'Warehouse' },
    { value: 'OTHER', label: 'Other (specify)' },
];

export const DEPARTMENT_OPTIONS = [
    { value: 'Finance', label: 'Finance' },
    { value: 'Human Resources', label: 'Human Resources' },
    { value: 'Operations', label: 'Operations' },
    { value: 'Sales', label: 'Sales' },
    { value: 'Marketing', label: 'Marketing' },
    { value: 'Legal', label: 'Legal' },
    { value: 'IT', label: 'IT' },
    { value: 'Sustainability / ESG', label: 'Sustainability / ESG' },
    { value: 'Procurement', label: 'Procurement' },
    { value: '__OTHER__', label: 'Other (specify)' },
];

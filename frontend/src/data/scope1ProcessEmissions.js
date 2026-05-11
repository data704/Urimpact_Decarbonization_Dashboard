/**
 * Scope 1 process-based emission sectors & types (GHG-style process boundaries).
 * Values must stay in sync with backend `scope1ProcessRowSchema` validation.
 */
export const PROCESS_SECTORS = [
    {
        value: 'CEMENT',
        label: 'Cement',
        types: [
            { value: 'CLINKER_PRODUCTION', label: 'Clinker production' },
            { value: 'CEMENT_OTHER', label: 'Other cement process (specify)' },
        ],
    },
    {
        value: 'METALS',
        label: 'Metals',
        types: [
            { value: 'STEEL_BF_BOF', label: 'Steel (BF/BOF)' },
            { value: 'STEEL_EAF', label: 'Steel (EAF)' },
            { value: 'METALS_OTHER', label: 'Other metals process (specify)' },
        ],
    },
    {
        value: 'CHEMICALS',
        label: 'Chemicals',
        types: [
            { value: 'AMMONIA', label: 'Ammonia' },
            { value: 'NITRIC_ACID', label: 'Nitric acid' },
            { value: 'CHEMICALS_OTHER', label: 'Other chemical process (specify)' },
        ],
    },
    {
        value: 'OIL_GAS',
        label: 'Oil & Gas',
        types: [
            { value: 'REFINING', label: 'Refining' },
            { value: 'FLARING', label: 'Flaring' },
            { value: 'VENTING', label: 'Venting' },
            { value: 'OIL_GAS_OTHER', label: 'Other oil & gas process (specify)' },
        ],
    },
    {
        value: 'GLASS',
        label: 'Glass',
        types: [
            { value: 'GLASS_MELTING', label: 'Glass melting' },
            { value: 'GLASS_OTHER', label: 'Other glass process (specify)' },
        ],
    },
    {
        value: 'OTHER',
        label: 'Other',
        types: [{ value: 'OTHER_SPECIFY', label: 'Describe process (free text)' }],
    },
];

export function typesForProcessSector(sectorValue) {
    const s = PROCESS_SECTORS.find((x) => x.value === sectorValue);
    return s?.types ?? [];
}

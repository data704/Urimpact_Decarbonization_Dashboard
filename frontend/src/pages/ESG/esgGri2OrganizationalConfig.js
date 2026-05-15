/** GRI 2 — Organizational details & reporting entities (sections 2-1, 2-2) */

export const ESG_GRI2_DRAFT_KEY = 'urimpact_esg_gri2_organizational';

export const OWNERSHIP_TYPES = [
    { value: 'PUBLIC', labelKey: 'ownershipPublic' },
    { value: 'PRIVATE', labelKey: 'ownershipPrivate' },
    { value: 'GOVERNMENT', labelKey: 'ownershipGovernment' },
    { value: 'NGO', labelKey: 'ownershipNgo' },
    { value: 'OTHER', labelKey: 'ownershipOther' },
];

export const ENTITY_DIFF_OPTIONS = [
    { value: 'NO', labelKey: 'entityDiffNo' },
    { value: 'YES', labelKey: 'entityDiffYes' },
];

export const GRI2_ORG_EMPTY = () => ({
    legalName: '',
    tradeName: '',
    ownershipType: '',
    ownershipTypeOther: '',
    legalStructure: '',
    headquartersLocation: '',
    operatingCountries: '',
    reportingEntities: '',
    entityReportingDifference: '',
    entityReportingDifferenceDetail: '',
});

export const GRI2_SECTIONS = [
    {
        id: '2-1',
        titleKey: 'section21Title',
        fields: [
            { name: 'legalName', labelKey: 'legalName', type: 'text', required: true },
            { name: 'tradeName', labelKey: 'tradeName', type: 'text' },
            {
                name: 'ownershipType',
                labelKey: 'ownershipType',
                type: 'select',
                options: OWNERSHIP_TYPES,
                required: true,
            },
            {
                name: 'ownershipTypeOther',
                labelKey: 'ownershipTypeOther',
                type: 'text',
                showWhen: (f) => f.ownershipType === 'OTHER',
            },
            { name: 'legalStructure', labelKey: 'legalStructure', type: 'text', required: true },
            { name: 'headquartersLocation', labelKey: 'headquartersLocation', type: 'text', required: true },
            {
                name: 'operatingCountries',
                labelKey: 'operatingCountries',
                type: 'textarea',
                required: true,
            },
        ],
    },
    {
        id: '2-2',
        titleKey: 'section22Title',
        fields: [
            {
                name: 'reportingEntities',
                labelKey: 'reportingEntities',
                type: 'textarea',
                required: true,
            },
            {
                name: 'entityReportingDifference',
                labelKey: 'entityReportingDifference',
                type: 'radio',
                options: ENTITY_DIFF_OPTIONS,
                required: true,
            },
            {
                name: 'entityReportingDifferenceDetail',
                labelKey: 'entityReportingDifferenceDetail',
                type: 'textarea',
                showWhen: (f) => f.entityReportingDifference === 'YES',
            },
        ],
    },
];

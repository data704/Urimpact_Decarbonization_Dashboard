/** GRI 3 — Material topics disclosure questions */

export const ESG_GRI3_DRAFT_KEY = 'urimpact_esg_gri3_material_topics';

export const GRI3_MATERIAL_QUESTIONS = [
    { name: 'businessActivities', labelKey: 'qBusinessActivities' },
    { name: 'locationsFacilities', labelKey: 'qLocationsFacilities' },
    { name: 'highestImpactActivities', labelKey: 'qHighestImpactActivities' },
    { name: 'operationalProcesses', labelKey: 'qOperationalProcesses' },
    { name: 'highestEmissionsFacilities', labelKey: 'qHighestEmissionsFacilities' },
    { name: 'worseningKpi', labelKey: 'qWorseningKpi' },
    { name: 'highestRiskBusinessUnit', labelKey: 'qHighestRiskBusinessUnit' },
    { name: 'highRiskSuppliers', labelKey: 'qHighRiskSuppliers' },
    { name: 'repeatedIncidentSites', labelKey: 'qRepeatedIncidentSites' },
    { name: 'unreliableMetrics', labelKey: 'qUnreliableMetrics' },
    { name: 'offTrackTargets', labelKey: 'qOffTrackTargets' },
    { name: 'stakeholderConcernTopics', labelKey: 'qStakeholderConcernTopics' },
    { name: 'scope3Operations', labelKey: 'qScope3Operations' },
    { name: 'measurableImprovementActions', labelKey: 'qMeasurableImprovementActions' },
];

export const GRI3_MATERIAL_EMPTY = () =>
    Object.fromEntries(GRI3_MATERIAL_QUESTIONS.map((q) => [q.name, '']));

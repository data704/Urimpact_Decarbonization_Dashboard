/** GRI 200-series Governance disclosure forms */

const YES_NO = [
    { value: 'YES', labelKey: 'yes' },
    { value: 'NO', labelKey: 'no' },
];

const INVESTMENT_TYPE = [
    { value: 'COMMERCIAL', labelKey: 'investCommercial' },
    { value: 'IN_KIND', labelKey: 'investInKind' },
    { value: 'PRO_BONO', labelKey: 'investProBono' },
];

const TAX_REVIEW_FREQ = [
    { value: 'ANNUAL', labelKey: 'annual' },
    { value: 'QUARTERLY', labelKey: 'quarterly' },
    { value: 'OTHER', labelKey: 'other' },
];

export const GOV_DISCLOSURES = {
    /* ──────────────────────────────────────────── GRI 201 ──────────────────────────────────────────── */
    gri201: {
        draftKey: 'urimpact_esg_gov_gri201',
        griCode: 'GRI 201',
        titleKey: 'gri201.pageTitle',
        descKey: 'gri201.pageDesc',
        sections: [
            {
                titleKey: 'gri201.secEconomicValue',
                fields: [
                    { name: 'totalRevenue', labelKey: 'gri201.totalRevenue', type: 'number' },
                    { name: 'totalOperatingCosts', labelKey: 'gri201.totalOperatingCosts', type: 'number' },
                    { name: 'totalWagesBenefits', labelKey: 'gri201.totalWagesBenefits', type: 'number' },
                    { name: 'totalCapitalPayments', labelKey: 'gri201.totalCapitalPayments', type: 'number' },
                    { name: 'totalTaxesPaid', labelKey: 'gri201.totalTaxesPaid', type: 'number' },
                    { name: 'totalCommunityInvestments', labelKey: 'gri201.totalCommunityInvestments', type: 'number' },
                    { name: 'economicValueRetained', labelKey: 'gri201.economicValueRetained', type: 'number' },
                    { name: 'publiclyDiscloseEconomic', labelKey: 'gri201.publiclyDiscloseEconomic', type: 'radio', options: YES_NO },
                ],
            },
            {
                titleKey: 'gri201.secClimateRisks',
                fields: [
                    { name: 'climateFinancialRisks', labelKey: 'gri201.climateFinancialRisks', type: 'radio', options: YES_NO },
                    { name: 'climateRisksCount', labelKey: 'gri201.climateRisksCount', type: 'number', showWhen: (f) => f.climateFinancialRisks === 'YES' },
                    { name: 'climateRiskFinancialImpact', labelKey: 'gri201.climateRiskFinancialImpact', type: 'number', showWhen: (f) => f.climateFinancialRisks === 'YES' },
                    { name: 'climateAdaptationPlans', labelKey: 'gri201.climateAdaptationPlans', type: 'radio', options: YES_NO },
                ],
            },
            {
                titleKey: 'gri201.secRetirement',
                fields: [
                    { name: 'retirementBenefitPlans', labelKey: 'gri201.retirementBenefitPlans', type: 'radio', options: YES_NO },
                    { name: 'retirementCoveragePercent', labelKey: 'gri201.retirementCoveragePercent', type: 'number', showWhen: (f) => f.retirementBenefitPlans === 'YES' },
                    { name: 'totalRetirementLiabilities', labelKey: 'gri201.totalRetirementLiabilities', type: 'number', showWhen: (f) => f.retirementBenefitPlans === 'YES' },
                ],
            },
            {
                titleKey: 'gri201.secGovAssistance',
                fields: [
                    { name: 'receivedGovAssistance', labelKey: 'gri201.receivedGovAssistance', type: 'radio', options: YES_NO },
                    { name: 'totalGovAssistance', labelKey: 'gri201.totalGovAssistance', type: 'number', showWhen: (f) => f.receivedGovAssistance === 'YES' },
                    { name: 'govAssistanceType', labelKey: 'gri201.govAssistanceType', type: 'text', showWhen: (f) => f.receivedGovAssistance === 'YES' },
                ],
            },
        ],
    },

    /* ──────────────────────────────────────────── GRI 202 ──────────────────────────────────────────── */
    gri202: {
        draftKey: 'urimpact_esg_gov_gri202',
        griCode: 'GRI 202',
        titleKey: 'gri202.pageTitle',
        descKey: 'gri202.pageDesc',
        sections: [
            {
                titleKey: 'gri202.secWageLevels',
                fields: [
                    { name: 'paysAboveMinWage', labelKey: 'gri202.paysAboveMinWage', type: 'radio', options: YES_NO },
                    { name: 'avgEntryWageMale', labelKey: 'gri202.avgEntryWageMale', type: 'number' },
                    { name: 'avgEntryWageFemale', labelKey: 'gri202.avgEntryWageFemale', type: 'number' },
                    { name: 'localMinWage', labelKey: 'gri202.localMinWage', type: 'number' },
                    { name: 'entryWageToMinRatio', labelKey: 'gri202.entryWageToMinRatio', type: 'number' },
                ],
            },
            {
                titleKey: 'gri202.secLocalHiring',
                fields: [
                    { name: 'totalSeniorMgmtPositions', labelKey: 'gri202.totalSeniorMgmtPositions', type: 'number' },
                    { name: 'seniorMgmtHiredLocally', labelKey: 'gri202.seniorMgmtHiredLocally', type: 'number' },
                    { name: 'localSeniorMgmtPercent', labelKey: 'gri202.localSeniorMgmtPercent', type: 'number' },
                    { name: 'prioritizeLocalHiring', labelKey: 'gri202.prioritizeLocalHiring', type: 'radio', options: YES_NO },
                ],
            },
        ],
    },

    /* ──────────────────────────────────────────── GRI 203 ──────────────────────────────────────────── */
    gri203: {
        draftKey: 'urimpact_esg_gov_gri203',
        griCode: 'GRI 203',
        titleKey: 'gri203.pageTitle',
        descKey: 'gri203.pageDesc',
        sections: [
            {
                titleKey: 'gri203.secInfrastructure',
                fields: [
                    { name: 'investedInInfrastructure', labelKey: 'gri203.investedInInfrastructure', type: 'radio', options: YES_NO },
                    { name: 'infraProjectsCount', labelKey: 'gri203.infraProjectsCount', type: 'number', showWhen: (f) => f.investedInInfrastructure === 'YES' },
                    { name: 'totalInfraInvestment', labelKey: 'gri203.totalInfraInvestment', type: 'number', showWhen: (f) => f.investedInInfrastructure === 'YES' },
                    { name: 'infraTypes', labelKey: 'gri203.infraTypes', type: 'text', showWhen: (f) => f.investedInInfrastructure === 'YES' },
                    { name: 'investmentType', labelKey: 'gri203.investmentType', type: 'checkboxes', options: INVESTMENT_TYPE, showWhen: (f) => f.investedInInfrastructure === 'YES' },
                ],
            },
            {
                titleKey: 'gri203.secEconomicImpacts',
                fields: [
                    { name: 'assessedIndirectImpacts', labelKey: 'gri203.assessedIndirectImpacts', type: 'radio', options: YES_NO },
                    { name: 'communitiesPositivelyImpacted', labelKey: 'gri203.communitiesPositivelyImpacted', type: 'number', showWhen: (f) => f.assessedIndirectImpacts === 'YES' },
                    { name: 'communitiesNegativelyImpacted', labelKey: 'gri203.communitiesNegativelyImpacted', type: 'number', showWhen: (f) => f.assessedIndirectImpacts === 'YES' },
                    { name: 'estimatedBeneficiaries', labelKey: 'gri203.estimatedBeneficiaries', type: 'number', showWhen: (f) => f.assessedIndirectImpacts === 'YES' },
                    { name: 'monitorLongTermImpacts', labelKey: 'gri203.monitorLongTermImpacts', type: 'radio', options: YES_NO },
                ],
            },
        ],
    },

    /* ──────────────────────────────────────────── GRI 204 ──────────────────────────────────────────── */
    gri204: {
        draftKey: 'urimpact_esg_gov_gri204',
        griCode: 'GRI 204',
        titleKey: 'gri204.pageTitle',
        descKey: 'gri204.pageDesc',
        sections: [
            {
                titleKey: 'gri204.secLocalProcurement',
                fields: [
                    { name: 'totalProcurementSpending', labelKey: 'gri204.totalProcurementSpending', type: 'number' },
                    { name: 'localSupplierSpending', labelKey: 'gri204.localSupplierSpending', type: 'number' },
                    { name: 'localSupplierPercent', labelKey: 'gri204.localSupplierPercent', type: 'number' },
                    { name: 'localSupplierPolicy', labelKey: 'gri204.localSupplierPolicy', type: 'radio', options: YES_NO },
                    { name: 'localSuppliersEngaged', labelKey: 'gri204.localSuppliersEngaged', type: 'number' },
                    { name: 'trackDiverseSuppliers', labelKey: 'gri204.trackDiverseSuppliers', type: 'radio', options: YES_NO },
                    { name: 'diverseSupplierPercent', labelKey: 'gri204.diverseSupplierPercent', type: 'number', showWhen: (f) => f.trackDiverseSuppliers === 'YES' },
                ],
            },
        ],
    },

    /* ──────────────────────────────────────────── GRI 205 ──────────────────────────────────────────── */
    gri205: {
        draftKey: 'urimpact_esg_gov_gri205',
        griCode: 'GRI 205',
        titleKey: 'gri205.pageTitle',
        descKey: 'gri205.pageDesc',
        sections: [
            {
                titleKey: 'gri205.secRiskAssessment',
                fields: [
                    { name: 'antiCorruptionPolicy', labelKey: 'gri205.antiCorruptionPolicy', type: 'radio', options: YES_NO },
                    { name: 'opsAssessedCorruption', labelKey: 'gri205.opsAssessedCorruption', type: 'number' },
                    { name: 'opsAssessedCorruptionPct', labelKey: 'gri205.opsAssessedCorruptionPct', type: 'number' },
                    { name: 'annualCorruptionAssessment', labelKey: 'gri205.annualCorruptionAssessment', type: 'radio', options: YES_NO },
                ],
            },
            {
                titleKey: 'gri205.secTrainingComm',
                fields: [
                    { name: 'antiCorruptionTraining', labelKey: 'gri205.antiCorruptionTraining', type: 'radio', options: YES_NO },
                    { name: 'employeesTrainedCorruption', labelKey: 'gri205.employeesTrainedCorruption', type: 'number', showWhen: (f) => f.antiCorruptionTraining === 'YES' },
                    { name: 'employeesTrainedCorruptionPct', labelKey: 'gri205.employeesTrainedCorruptionPct', type: 'number', showWhen: (f) => f.antiCorruptionTraining === 'YES' },
                    { name: 'policyCommunicatedSuppliers', labelKey: 'gri205.policyCommunicatedSuppliers', type: 'radio', options: YES_NO },
                    { name: 'suppliersInformedCount', labelKey: 'gri205.suppliersInformedCount', type: 'number', showWhen: (f) => f.policyCommunicatedSuppliers === 'YES' },
                ],
            },
            {
                titleKey: 'gri205.secIncidents',
                fields: [
                    { name: 'confirmedCorruptionIncidents', labelKey: 'gri205.confirmedCorruptionIncidents', type: 'number' },
                    { name: 'employeesDismissedCorruption', labelKey: 'gri205.employeesDismissedCorruption', type: 'radio', options: YES_NO },
                    { name: 'employeesDismissedCount', labelKey: 'gri205.employeesDismissedCount', type: 'number', showWhen: (f) => f.employeesDismissedCorruption === 'YES' },
                    { name: 'legalCasesCorruption', labelKey: 'gri205.legalCasesCorruption', type: 'radio', options: YES_NO },
                    { name: 'legalCasesCorruptionCount', labelKey: 'gri205.legalCasesCorruptionCount', type: 'number', showWhen: (f) => f.legalCasesCorruption === 'YES' },
                    { name: 'whistleblowerProtection', labelKey: 'gri205.whistleblowerProtection', type: 'radio', options: YES_NO },
                ],
            },
        ],
    },

    /* ──────────────────────────────────────────── GRI 206 ──────────────────────────────────────────── */
    gri206: {
        draftKey: 'urimpact_esg_gov_gri206',
        griCode: 'GRI 206',
        titleKey: 'gri206.pageTitle',
        descKey: 'gri206.pageDesc',
        sections: [
            {
                titleKey: 'gri206.secLegalActions',
                fields: [
                    { name: 'antiCompetitiveLegal', labelKey: 'gri206.antiCompetitiveLegal', type: 'radio', options: YES_NO },
                    { name: 'antiCompetitiveLegalCount', labelKey: 'gri206.antiCompetitiveLegalCount', type: 'number', showWhen: (f) => f.antiCompetitiveLegal === 'YES' },
                    { name: 'antiTrustCases', labelKey: 'gri206.antiTrustCases', type: 'number', showWhen: (f) => f.antiCompetitiveLegal === 'YES' },
                    { name: 'monopolyCases', labelKey: 'gri206.monopolyCases', type: 'number', showWhen: (f) => f.antiCompetitiveLegal === 'YES' },
                    { name: 'totalFinesPenalties', labelKey: 'gri206.totalFinesPenalties', type: 'number', showWhen: (f) => f.antiCompetitiveLegal === 'YES' },
                    { name: 'competitionLawPolicy', labelKey: 'gri206.competitionLawPolicy', type: 'radio', options: YES_NO },
                    { name: 'competitionLawTraining', labelKey: 'gri206.competitionLawTraining', type: 'radio', options: YES_NO },
                ],
            },
        ],
    },

    /* ──────────────────────────────────────────── GRI 207 ──────────────────────────────────────────── */
    gri207: {
        draftKey: 'urimpact_esg_gov_gri207',
        griCode: 'GRI 207',
        titleKey: 'gri207.pageTitle',
        descKey: 'gri207.pageDesc',
        sections: [
            {
                titleKey: 'gri207.secTaxStrategy',
                fields: [
                    { name: 'documentedTaxStrategy', labelKey: 'gri207.documentedTaxStrategy', type: 'radio', options: YES_NO },
                    { name: 'taxStrategyPublic', labelKey: 'gri207.taxStrategyPublic', type: 'radio', options: YES_NO },
                    { name: 'boardReviewsTaxStrategy', labelKey: 'gri207.boardReviewsTaxStrategy', type: 'radio', options: YES_NO },
                    { name: 'taxReviewFrequency', labelKey: 'gri207.taxReviewFrequency', type: 'select', options: TAX_REVIEW_FREQ },
                    { name: 'regulatoryTaxCompliance', labelKey: 'gri207.regulatoryTaxCompliance', type: 'radio', options: YES_NO },
                    { name: 'taxAlignsSustainability', labelKey: 'gri207.taxAlignsSustainability', type: 'radio', options: YES_NO },
                ],
            },
            {
                titleKey: 'gri207.secTaxGovernance',
                fields: [
                    { name: 'taxGovernanceFramework', labelKey: 'gri207.taxGovernanceFramework', type: 'radio', options: YES_NO },
                    { name: 'seniorExecTaxCompliance', labelKey: 'gri207.seniorExecTaxCompliance', type: 'radio', options: YES_NO },
                    { name: 'taxRiskAssessments', labelKey: 'gri207.taxRiskAssessments', type: 'radio', options: YES_NO },
                    { name: 'taxDisputesCount', labelKey: 'gri207.taxDisputesCount', type: 'number' },
                    { name: 'engagesTaxAuthorities', labelKey: 'gri207.engagesTaxAuthorities', type: 'radio', options: YES_NO },
                ],
            },
        ],
    },
};

export function emptyGovForm(config) {
    const fields = {};
    for (const section of config.sections) {
        for (const field of section.fields) {
            if (field.type === 'checkboxes') {
                fields[field.name] = [];
            } else {
                fields[field.name] = '';
            }
        }
    }
    return fields;
}

export const GOV_FORM_KEYS = new Set(Object.keys(GOV_DISCLOSURES));

/** GRI 400-series Social disclosure forms */

const YES_NO = [
    { value: 'YES', labelKey: 'yes' },
    { value: 'NO', labelKey: 'no' },
];

const OHS_MEETING_FREQ = [
    { value: 'MONTHLY', labelKey: 'monthly' },
    { value: 'QUARTERLY', labelKey: 'quarterly' },
    { value: 'HALF_YEARLY', labelKey: 'halfYearly' },
    { value: 'ANNUALLY', labelKey: 'annually' },
];

const REVIEW_FREQ = [
    { value: 'ANNUAL', labelKey: 'annual' },
    { value: 'HALF_YEARLY', labelKey: 'halfYearly' },
    { value: 'QUARTERLY', labelKey: 'quarterly' },
    { value: 'OTHER', labelKey: 'other' },
];

const AUDIT_FREQ = [
    { value: 'MONTHLY', labelKey: 'monthly' },
    { value: 'QUARTERLY', labelKey: 'quarterly' },
    { value: 'HALF_YEARLY', labelKey: 'halfYearly' },
    { value: 'ANNUALLY', labelKey: 'annually' },
];

const WELLNESS_OPTIONS = [
    { value: 'mentalHealth', labelKey: 'wellnessMentalHealth' },
    { value: 'fitness', labelKey: 'wellnessFitness' },
    { value: 'smokingCessation', labelKey: 'wellnessSmokingCessation' },
    { value: 'nutrition', labelKey: 'wellnessNutrition' },
    { value: 'stressManagement', labelKey: 'wellnessStressManagement' },
    { value: 'medicalCheckups', labelKey: 'wellnessMedicalCheckups' },
    { value: 'other', labelKey: 'wellnessOther' },
];

const EMPLOYEE_CATEGORIES = [
    { value: 'seniorManagement', labelKey: 'catSeniorMgmt' },
    { value: 'middleManagement', labelKey: 'catMiddleMgmt' },
    { value: 'juniorManagement', labelKey: 'catJuniorMgmt' },
    { value: 'technicalStaff', labelKey: 'catTechnical' },
    { value: 'administrativeStaff', labelKey: 'catAdministrative' },
    { value: 'productionStaff', labelKey: 'catProduction' },
    { value: 'other', labelKey: 'catOther' },
];

const DIVERSITY_INDICATORS = [
    { value: 'nationality', labelKey: 'divNationality' },
    { value: 'ethnicity', labelKey: 'divEthnicity' },
    { value: 'disability', labelKey: 'divDisability' },
    { value: 'minority', labelKey: 'divMinority' },
    { value: 'indigenous', labelKey: 'divIndigenous' },
    { value: 'religion', labelKey: 'divReligion' },
    { value: 'lgbtq', labelKey: 'divLgbtq' },
    { value: 'other', labelKey: 'divOther' },
];

const CORRECTIVE_ACTION_TYPES = [
    { value: 'warningIssued', labelKey: 'actionWarning' },
    { value: 'employeeTerminated', labelKey: 'actionTerminated' },
    { value: 'policyRevised', labelKey: 'actionPolicyRevised' },
    { value: 'trainingConducted', labelKey: 'actionTraining' },
    { value: 'other', labelKey: 'actionOther' },
];

const SUPPLIER_ACTION_TYPES = [
    { value: 'supplierTraining', labelKey: 'supActionTraining' },
    { value: 'auditConducted', labelKey: 'supActionAudit' },
    { value: 'contractWarning', labelKey: 'supActionWarning' },
    { value: 'supplierTermination', labelKey: 'supActionTermination' },
    { value: 'improvementPlan', labelKey: 'supActionImprovement' },
];

const AGE_VERIFICATION_DOCS = [
    { value: 'aadhaar', labelKey: 'docAadhaar' },
    { value: 'passport', labelKey: 'docPassport' },
    { value: 'schoolCertificate', labelKey: 'docSchoolCert' },
    { value: 'birthCertificate', labelKey: 'docBirthCert' },
    { value: 'other', labelKey: 'docOther' },
];

export const SOCIAL_DISCLOSURES = {
    /* ──────────────────────────────────────────── GRI 401 ──────────────────────────────────────────── */
    gri401: {
        draftKey: 'urimpact_esg_soc_gri401',
        griCode: 'GRI 401',
        titleKey: 'gri401.pageTitle',
        descKey: 'gri401.pageDesc',
        sections: [
            /* 401-1 */
            {
                titleKey: 'gri401.sec401_1',
                fields: [],
            },
            {
                titleKey: 'gri401.secBasicEmployee',
                fields: [
                    { name: 'totalEmployeesYearEnd', labelKey: 'gri401.totalEmployeesYearEnd', type: 'number' },
                    { name: 'totalNewHires', labelKey: 'gri401.totalNewHires', type: 'number' },
                    { name: 'totalEmployeesLeft', labelKey: 'gri401.totalEmployeesLeft', type: 'number' },
                ],
            },
            {
                titleKey: 'gri401.secNewHiresGender',
                fields: [
                    { name: 'maleNewHires', labelKey: 'gri401.maleNewHires', type: 'number' },
                    { name: 'femaleNewHires', labelKey: 'gri401.femaleNewHires', type: 'number' },
                    { name: 'otherGenderNewHires', labelKey: 'gri401.otherGenderNewHires', type: 'number' },
                ],
            },
            {
                titleKey: 'gri401.secNewHiresAge',
                fields: [
                    { name: 'hiresBelow30', labelKey: 'gri401.hiresBelow30', type: 'number' },
                    { name: 'hires30to50', labelKey: 'gri401.hires30to50', type: 'number' },
                    { name: 'hiresAbove50', labelKey: 'gri401.hiresAbove50', type: 'number' },
                ],
            },
            {
                titleKey: 'gri401.secTurnoverGender',
                fields: [
                    { name: 'maleLeft', labelKey: 'gri401.maleLeft', type: 'number' },
                    { name: 'femaleLeft', labelKey: 'gri401.femaleLeft', type: 'number' },
                    { name: 'otherGenderLeft', labelKey: 'gri401.otherGenderLeft', type: 'number' },
                ],
            },
            {
                titleKey: 'gri401.secTurnoverAge',
                fields: [
                    { name: 'leftBelow30', labelKey: 'gri401.leftBelow30', type: 'number' },
                    { name: 'left30to50', labelKey: 'gri401.left30to50', type: 'number' },
                    { name: 'leftAbove50', labelKey: 'gri401.leftAbove50', type: 'number' },
                ],
            },
            {
                titleKey: 'gri401.secRegional',
                fields: [
                    { name: 'trackRegionWise', labelKey: 'gri401.trackRegionWise', type: 'radio', options: YES_NO },
                    { name: 'regionsList', labelKey: 'gri401.regionsList', type: 'text', showWhen: (f) => f.trackRegionWise === 'YES' },
                    { name: 'regionalDataUpload', labelKey: 'gri401.regionalDataUpload', type: 'file', showWhen: (f) => f.trackRegionWise === 'YES' },
                ],
            },
            /* 401-2 */
            {
                titleKey: 'gri401.sec401_2',
                fields: [
                    { name: 'ftLifeInsurance', labelKey: 'gri401.ftLifeInsurance', type: 'radio', options: YES_NO },
                    { name: 'ptLifeInsurance', labelKey: 'gri401.ptLifeInsurance', type: 'radio', options: YES_NO },
                    { name: 'ftHealthcare', labelKey: 'gri401.ftHealthcare', type: 'radio', options: YES_NO },
                    { name: 'ptHealthcare', labelKey: 'gri401.ptHealthcare', type: 'radio', options: YES_NO },
                    { name: 'ftDisability', labelKey: 'gri401.ftDisability', type: 'radio', options: YES_NO },
                    { name: 'ptDisability', labelKey: 'gri401.ptDisability', type: 'radio', options: YES_NO },
                    { name: 'ftParentalLeave', labelKey: 'gri401.ftParentalLeave', type: 'radio', options: YES_NO },
                    { name: 'ptParentalLeave', labelKey: 'gri401.ptParentalLeave', type: 'radio', options: YES_NO },
                    { name: 'ftRetirement', labelKey: 'gri401.ftRetirement', type: 'radio', options: YES_NO },
                    { name: 'ptRetirement', labelKey: 'gri401.ptRetirement', type: 'radio', options: YES_NO },
                    { name: 'ftStock', labelKey: 'gri401.ftStock', type: 'radio', options: YES_NO },
                    { name: 'ptStock', labelKey: 'gri401.ptStock', type: 'radio', options: YES_NO },
                    { name: 'additionalBenefits', labelKey: 'gri401.additionalBenefits', type: 'text' },
                    { name: 'significantLocations', labelKey: 'gri401.significantLocations', type: 'text' },
                ],
            },
            /* 401-3 */
            {
                titleKey: 'gri401.sec401_3',
                fields: [
                    { name: 'parentalEntitledMale', labelKey: 'gri401.parentalEntitledMale', type: 'number' },
                    { name: 'parentalEntitledFemale', labelKey: 'gri401.parentalEntitledFemale', type: 'number' },
                    { name: 'parentalTookMale', labelKey: 'gri401.parentalTookMale', type: 'number' },
                    { name: 'parentalTookFemale', labelKey: 'gri401.parentalTookFemale', type: 'number' },
                    { name: 'parentalReturnedMale', labelKey: 'gri401.parentalReturnedMale', type: 'number' },
                    { name: 'parentalReturnedFemale', labelKey: 'gri401.parentalReturnedFemale', type: 'number' },
                    { name: 'parentalRetained12mMale', labelKey: 'gri401.parentalRetained12mMale', type: 'number' },
                    { name: 'parentalRetained12mFemale', labelKey: 'gri401.parentalRetained12mFemale', type: 'number' },
                    { name: 'formalParentalPolicy', labelKey: 'gri401.formalParentalPolicy', type: 'radio', options: YES_NO },
                    { name: 'parentalPolicyUpload', labelKey: 'gri401.parentalPolicyUpload', type: 'file' },
                ],
            },
        ],
    },

    /* ──────────────────────────────────────────── GRI 402 ──────────────────────────────────────────── */
    gri402: {
        draftKey: 'urimpact_esg_soc_gri402',
        griCode: 'GRI 402',
        titleKey: 'gri402.pageTitle',
        descKey: 'gri402.pageDesc',
        sections: [
            {
                titleKey: 'gri402.sec402_1',
                fields: [
                    { name: 'advanceNotice', labelKey: 'gri402.advanceNotice', type: 'radio', options: YES_NO },
                    { name: 'minNoticePeriodWeeks', labelKey: 'gri402.minNoticePeriodWeeks', type: 'number' },
                    { name: 'noticeDocumented', labelKey: 'gri402.noticeDocumented', type: 'radio', options: YES_NO },
                    { name: 'employeesConsulted', labelKey: 'gri402.employeesConsulted', type: 'radio', options: YES_NO },
                    { name: 'collectiveBargaining', labelKey: 'gri402.collectiveBargaining', type: 'radio', options: YES_NO },
                    { name: 'cbNotice', labelKey: 'gri402.cbNotice', type: 'radio', options: YES_NO, showWhen: (f) => f.collectiveBargaining === 'YES' },
                    { name: 'cbConsultation', labelKey: 'gri402.cbConsultation', type: 'radio', options: YES_NO, showWhen: (f) => f.collectiveBargaining === 'YES' },
                    { name: 'laborPolicyUpload', labelKey: 'gri402.laborPolicyUpload', type: 'file' },
                ],
            },
        ],
    },

    /* ──────────────────────────────────────────── GRI 403 ──────────────────────────────────────────── */
    gri403: {
        draftKey: 'urimpact_esg_soc_gri403',
        griCode: 'GRI 403',
        titleKey: 'gri403.pageTitle',
        descKey: 'gri403.pageDesc',
        sections: [
            /* 403-1 */
            {
                titleKey: 'gri403.sec403_1',
                fields: [
                    { name: 'hasOHS', labelKey: 'gri403.hasOHS', type: 'radio', options: YES_NO },
                    { name: 'ohsLegallyRequired', labelKey: 'gri403.ohsLegallyRequired', type: 'radio', options: YES_NO },
                    { name: 'ohsBasedOnStandard', labelKey: 'gri403.ohsBasedOnStandard', type: 'radio', options: YES_NO },
                    { name: 'ohsStandardFollowed', labelKey: 'gri403.ohsStandardFollowed', type: 'text' },
                    { name: 'allEmployeesCovered', labelKey: 'gri403.allEmployeesCovered', type: 'radio', options: YES_NO },
                    { name: 'contractorsCovered', labelKey: 'gri403.contractorsCovered', type: 'radio', options: YES_NO },
                    { name: 'anyExcluded', labelKey: 'gri403.anyExcluded', type: 'radio', options: YES_NO },
                    { name: 'exclusionExplanation', labelKey: 'gri403.exclusionExplanation', type: 'text', showWhen: (f) => f.anyExcluded === 'YES' },
                ],
            },
            /* 403-2 */
            {
                titleKey: 'gri403.sec403_2',
                fields: [
                    { name: 'hazardIdentification', labelKey: 'gri403.hazardIdentification', type: 'radio', options: YES_NO },
                    { name: 'riskAssessments', labelKey: 'gri403.riskAssessments', type: 'radio', options: YES_NO },
                    { name: 'incidentInvestigations', labelKey: 'gri403.incidentInvestigations', type: 'radio', options: YES_NO },
                    { name: 'hazardReportProcess', labelKey: 'gri403.hazardReportProcess', type: 'radio', options: YES_NO },
                    { name: 'retaliationProtection', labelKey: 'gri403.retaliationProtection', type: 'radio', options: YES_NO },
                    { name: 'canRefuseUnsafe', labelKey: 'gri403.canRefuseUnsafe', type: 'radio', options: YES_NO },
                    { name: 'refusalProtection', labelKey: 'gri403.refusalProtection', type: 'radio', options: YES_NO },
                    { name: 'hazardProcedureUpload', labelKey: 'gri403.hazardProcedureUpload', type: 'file' },
                ],
            },
            /* 403-3 */
            {
                titleKey: 'gri403.sec403_3',
                fields: [
                    { name: 'occHealthServices', labelKey: 'gri403.occHealthServices', type: 'radio', options: YES_NO },
                    { name: 'healthServicesAllWorkers', labelKey: 'gri403.healthServicesAllWorkers', type: 'radio', options: YES_NO },
                    { name: 'healthProfessionalsCertified', labelKey: 'gri403.healthProfessionalsCertified', type: 'radio', options: YES_NO },
                    { name: 'medicalConfidentiality', labelKey: 'gri403.medicalConfidentiality', type: 'radio', options: YES_NO },
                    { name: 'healthDataEmploymentDecisions', labelKey: 'gri403.healthDataEmploymentDecisions', type: 'radio', options: YES_NO },
                    { name: 'occHealthPolicyUpload', labelKey: 'gri403.occHealthPolicyUpload', type: 'file' },
                ],
            },
            /* 403-4 */
            {
                titleKey: 'gri403.sec403_4',
                fields: [
                    { name: 'workersInOHSDecisions', labelKey: 'gri403.workersInOHSDecisions', type: 'radio', options: YES_NO },
                    { name: 'hasSafetyCommittees', labelKey: 'gri403.hasSafetyCommittees', type: 'radio', options: YES_NO },
                    { name: 'ohsCommitteeFrequency', labelKey: 'gri403.ohsCommitteeFrequency', type: 'select', options: OHS_MEETING_FREQ },
                    { name: 'allWorkersRepresented', labelKey: 'gri403.allWorkersRepresented', type: 'radio', options: YES_NO },
                    { name: 'ohsWithUnions', labelKey: 'gri403.ohsWithUnions', type: 'radio', options: YES_NO },
                    { name: 'committeeRecordsUpload', labelKey: 'gri403.committeeRecordsUpload', type: 'file' },
                ],
            },
            /* 403-5 */
            {
                titleKey: 'gri403.sec403_5',
                fields: [
                    { name: 'ohsTraining', labelKey: 'gri403.ohsTraining', type: 'radio', options: YES_NO },
                    { name: 'ohsTrainingMandatory', labelKey: 'gri403.ohsTrainingMandatory', type: 'radio', options: YES_NO },
                    { name: 'contractorsInTraining', labelKey: 'gri403.contractorsInTraining', type: 'radio', options: YES_NO },
                    { name: 'trainingPaidHours', labelKey: 'gri403.trainingPaidHours', type: 'radio', options: YES_NO },
                    { name: 'trainingLocalLanguage', labelKey: 'gri403.trainingLocalLanguage', type: 'radio', options: YES_NO },
                    { name: 'workersTrained', labelKey: 'gri403.workersTrained', type: 'number' },
                    { name: 'trainingRecordsUpload', labelKey: 'gri403.trainingRecordsUpload', type: 'file' },
                ],
            },
            /* 403-6 */
            {
                titleKey: 'gri403.sec403_6',
                fields: [
                    { name: 'nonWorkHealthcare', labelKey: 'gri403.nonWorkHealthcare', type: 'radio', options: YES_NO },
                    { name: 'wellnessPrograms', labelKey: 'gri403.wellnessPrograms', type: 'radio', options: YES_NO },
                    { name: 'wellnessProgramTypes', labelKey: 'gri403.wellnessProgramTypes', type: 'checkboxes', options: WELLNESS_OPTIONS },
                    { name: 'familyCovered', labelKey: 'gri403.familyCovered', type: 'radio', options: YES_NO },
                    { name: 'wellnessVoluntary', labelKey: 'gri403.wellnessVoluntary', type: 'radio', options: YES_NO },
                    { name: 'wellnessPolicyUpload', labelKey: 'gri403.wellnessPolicyUpload', type: 'file' },
                ],
            },
            /* 403-7 */
            {
                titleKey: 'gri403.sec403_7',
                fields: [
                    { name: 'supplierOHSRisks', labelKey: 'gri403.supplierOHSRisks', type: 'radio', options: YES_NO },
                    { name: 'supplierOHSActions', labelKey: 'gri403.supplierOHSActions', type: 'radio', options: YES_NO },
                    { name: 'supplierOHSAudits', labelKey: 'gri403.supplierOHSAudits', type: 'radio', options: YES_NO },
                    { name: 'supplierOHSPolicyUpload', labelKey: 'gri403.supplierOHSPolicyUpload', type: 'file' },
                ],
            },
            /* 403-8 */
            {
                titleKey: 'gri403.sec403_8',
                fields: [
                    { name: 'totalWorkersCovered', labelKey: 'gri403.totalWorkersCovered', type: 'number' },
                    { name: 'pctWorkersCovered', labelKey: 'gri403.pctWorkersCovered', type: 'number' },
                ],
            },
            /* 403-9 */
            {
                titleKey: 'gri403.sec403_9',
                fields: [
                    { name: 'totalInjuries', labelKey: 'gri403.totalInjuries', type: 'number' },
                    { name: 'totalFatalities', labelKey: 'gri403.totalFatalities', type: 'number' },
                    { name: 'highConsequenceInjuries', labelKey: 'gri403.highConsequenceInjuries', type: 'number' },
                    { name: 'recordableInjuries', labelKey: 'gri403.recordableInjuries', type: 'number' },
                    { name: 'ltifrAvailable', labelKey: 'gri403.ltifrAvailable', type: 'radio', options: YES_NO },
                    { name: 'ltifr', labelKey: 'gri403.ltifr', type: 'number', showWhen: (f) => f.ltifrAvailable === 'YES' },
                    { name: 'totalHoursWorked', labelKey: 'gri403.totalHoursWorked', type: 'number' },
                ],
            },
            /* 403-10 */
            {
                titleKey: 'gri403.sec403_10',
                fields: [
                    { name: 'totalIllHealth', labelKey: 'gri403.totalIllHealth', type: 'number' },
                    { name: 'illHealthFatalities', labelKey: 'gri403.illHealthFatalities', type: 'number' },
                    { name: 'mainIllHealthTypes', labelKey: 'gri403.mainIllHealthTypes', type: 'text' },
                    { name: 'occDiseasesTracked', labelKey: 'gri403.occDiseasesTracked', type: 'radio', options: YES_NO },
                    { name: 'incidentRecordsUpload', labelKey: 'gri403.incidentRecordsUpload', type: 'file' },
                ],
            },
        ],
    },

    /* ──────────────────────────────────────────── GRI 404 ──────────────────────────────────────────── */
    gri404: {
        draftKey: 'urimpact_esg_soc_gri404',
        griCode: 'GRI 404',
        titleKey: 'gri404.pageTitle',
        descKey: 'gri404.pageDesc',
        sections: [
            /* 404-1 */
            {
                titleKey: 'gri404.sec404_1',
                fields: [
                    { name: 'totalTrainingHours', labelKey: 'gri404.totalTrainingHours', type: 'number' },
                    { name: 'totalEmployeesTrained', labelKey: 'gri404.totalEmployeesTrained', type: 'number' },
                ],
            },
            {
                titleKey: 'gri404.secTrainingGender',
                fields: [
                    { name: 'trainingHoursMale', labelKey: 'gri404.trainingHoursMale', type: 'number' },
                    { name: 'trainingHoursFemale', labelKey: 'gri404.trainingHoursFemale', type: 'number' },
                    { name: 'trainingHoursOther', labelKey: 'gri404.trainingHoursOther', type: 'number' },
                ],
            },
            {
                titleKey: 'gri404.secEmployeeCountGender',
                fields: [
                    { name: 'totalMaleEmployees', labelKey: 'gri404.totalMaleEmployees', type: 'number' },
                    { name: 'totalFemaleEmployees', labelKey: 'gri404.totalFemaleEmployees', type: 'number' },
                    { name: 'totalOtherEmployees', labelKey: 'gri404.totalOtherEmployees', type: 'number' },
                ],
            },
            {
                titleKey: 'gri404.secTrainingCategory',
                fields: [
                    { name: 'classifyByCategory', labelKey: 'gri404.classifyByCategory', type: 'radio', options: YES_NO },
                    { name: 'employeeCategories', labelKey: 'gri404.employeeCategories', type: 'checkboxes', options: EMPLOYEE_CATEGORIES },
                    { name: 'trainingHrsSeniorMgmt', labelKey: 'gri404.trainingHrsSeniorMgmt', type: 'number' },
                    { name: 'trainingHrsMiddleMgmt', labelKey: 'gri404.trainingHrsMiddleMgmt', type: 'number' },
                    { name: 'trainingHrsJuniorMgmt', labelKey: 'gri404.trainingHrsJuniorMgmt', type: 'number' },
                    { name: 'trainingHrsTechnical', labelKey: 'gri404.trainingHrsTechnical', type: 'number' },
                    { name: 'trainingHrsAdmin', labelKey: 'gri404.trainingHrsAdmin', type: 'number' },
                    { name: 'trainingHrsProduction', labelKey: 'gri404.trainingHrsProduction', type: 'number' },
                    { name: 'trainingRecordsUpload', labelKey: 'gri404.trainingRecordsUpload', type: 'file' },
                ],
            },
            /* 404-2 */
            {
                titleKey: 'gri404.sec404_2_skills',
                fields: [
                    { name: 'internalTraining', labelKey: 'gri404.internalTraining', type: 'radio', options: YES_NO },
                    { name: 'externalTraining', labelKey: 'gri404.externalTraining', type: 'radio', options: YES_NO },
                    { name: 'educationalReimbursement', labelKey: 'gri404.educationalReimbursement', type: 'radio', options: YES_NO },
                    { name: 'sabbaticalLeave', labelKey: 'gri404.sabbaticalLeave', type: 'radio', options: YES_NO },
                    { name: 'leadershipDev', labelKey: 'gri404.leadershipDev', type: 'radio', options: YES_NO },
                    { name: 'technicalSkillPrograms', labelKey: 'gri404.technicalSkillPrograms', type: 'radio', options: YES_NO },
                    { name: 'softSkillPrograms', labelKey: 'gri404.softSkillPrograms', type: 'radio', options: YES_NO },
                    { name: 'skillDevParticipants', labelKey: 'gri404.skillDevParticipants', type: 'number' },
                    { name: 'avgTrainingBudgetPerEmp', labelKey: 'gri404.avgTrainingBudgetPerEmp', type: 'number' },
                    { name: 'totalAnnualTrainingBudget', labelKey: 'gri404.totalAnnualTrainingBudget', type: 'number' },
                ],
            },
            {
                titleKey: 'gri404.sec404_2_transition',
                fields: [
                    { name: 'retirementPlanning', labelKey: 'gri404.retirementPlanning', type: 'radio', options: YES_NO },
                    { name: 'retrainingSupport', labelKey: 'gri404.retrainingSupport', type: 'radio', options: YES_NO },
                    { name: 'severanceComp', labelKey: 'gri404.severanceComp', type: 'radio', options: YES_NO },
                    { name: 'jobPlacementSupport', labelKey: 'gri404.jobPlacementSupport', type: 'radio', options: YES_NO },
                    { name: 'retirementCounseling', labelKey: 'gri404.retirementCounseling', type: 'radio', options: YES_NO },
                    { name: 'transitionDocumented', labelKey: 'gri404.transitionDocumented', type: 'radio', options: YES_NO },
                    { name: 'trainingDevPolicyUpload', labelKey: 'gri404.trainingDevPolicyUpload', type: 'file' },
                    { name: 'transitionPolicyUpload', labelKey: 'gri404.transitionPolicyUpload', type: 'file' },
                ],
            },
            /* 404-3 */
            {
                titleKey: 'gri404.sec404_3',
                fields: [
                    { name: 'regularPerformanceReviews', labelKey: 'gri404.regularPerformanceReviews', type: 'radio', options: YES_NO },
                    { name: 'reviewFrequency', labelKey: 'gri404.reviewFrequency', type: 'select', options: REVIEW_FREQ },
                    { name: 'careerDevInReviews', labelKey: 'gri404.careerDevInReviews', type: 'radio', options: YES_NO },
                    { name: 'reviewCriteriaCommunicated', labelKey: 'gri404.reviewCriteriaCommunicated', type: 'radio', options: YES_NO },
                ],
            },
            {
                titleKey: 'gri404.secReviewGender',
                fields: [
                    { name: 'reviewsMale', labelKey: 'gri404.reviewsMale', type: 'number' },
                    { name: 'reviewsFemale', labelKey: 'gri404.reviewsFemale', type: 'number' },
                    { name: 'reviewsOther', labelKey: 'gri404.reviewsOther', type: 'number' },
                ],
            },
            {
                titleKey: 'gri404.secReviewCategory',
                fields: [
                    { name: 'reviewsSeniorMgmt', labelKey: 'gri404.reviewsSeniorMgmt', type: 'number' },
                    { name: 'reviewsMiddleMgmt', labelKey: 'gri404.reviewsMiddleMgmt', type: 'number' },
                    { name: 'reviewsJuniorMgmt', labelKey: 'gri404.reviewsJuniorMgmt', type: 'number' },
                    { name: 'reviewsTechnical', labelKey: 'gri404.reviewsTechnical', type: 'number' },
                    { name: 'reviewsAdmin', labelKey: 'gri404.reviewsAdmin', type: 'number' },
                    { name: 'reviewsProduction', labelKey: 'gri404.reviewsProduction', type: 'number' },
                ],
            },
            {
                titleKey: 'gri404.secReviewProcess',
                fields: [
                    { name: 'peerReviews', labelKey: 'gri404.peerReviews', type: 'radio', options: YES_NO },
                    { name: 'managerEvaluations', labelKey: 'gri404.managerEvaluations', type: 'radio', options: YES_NO },
                    { name: 'hrInCareerReview', labelKey: 'gri404.hrInCareerReview', type: 'radio', options: YES_NO },
                    { name: 'appraisalPolicyUpload', labelKey: 'gri404.appraisalPolicyUpload', type: 'file' },
                ],
            },
        ],
    },

    /* ──────────────────────────────────────────── GRI 405 ──────────────────────────────────────────── */
    gri405: {
        draftKey: 'urimpact_esg_soc_gri405',
        griCode: 'GRI 405',
        titleKey: 'gri405.pageTitle',
        descKey: 'gri405.pageDesc',
        sections: [
            /* 405-1 Governance Diversity */
            {
                titleKey: 'gri405.secGovDiversity',
                fields: [
                    { name: 'totalGovMembers', labelKey: 'gri405.totalGovMembers', type: 'number' },
                ],
            },
            {
                titleKey: 'gri405.secGovGender',
                fields: [
                    { name: 'govMale', labelKey: 'gri405.govMale', type: 'number' },
                    { name: 'govFemale', labelKey: 'gri405.govFemale', type: 'number' },
                    { name: 'govOther', labelKey: 'gri405.govOther', type: 'number' },
                ],
            },
            {
                titleKey: 'gri405.secGovAge',
                fields: [
                    { name: 'govBelow30', labelKey: 'gri405.govBelow30', type: 'number' },
                    { name: 'gov30to50', labelKey: 'gri405.gov30to50', type: 'number' },
                    { name: 'govAbove50', labelKey: 'gri405.govAbove50', type: 'number' },
                ],
            },
            {
                titleKey: 'gri405.secGovOtherDiversity',
                fields: [
                    { name: 'trackBeyondGenderAge', labelKey: 'gri405.trackBeyondGenderAge', type: 'radio', options: YES_NO },
                    { name: 'diversityIndicators', labelKey: 'gri405.diversityIndicators', type: 'checkboxes', options: DIVERSITY_INDICATORS, showWhen: (f) => f.trackBeyondGenderAge === 'YES' },
                    { name: 'govDiverseMembers', labelKey: 'gri405.govDiverseMembers', type: 'number', showWhen: (f) => f.trackBeyondGenderAge === 'YES' },
                ],
            },
            /* 405-1 Employee Diversity */
            {
                titleKey: 'gri405.secEmpDiversity',
                fields: [
                    { name: 'totalEmployees', labelKey: 'gri405.totalEmployees', type: 'number' },
                ],
            },
            {
                titleKey: 'gri405.secEmpGender',
                fields: [
                    { name: 'empMale', labelKey: 'gri405.empMale', type: 'number' },
                    { name: 'empFemale', labelKey: 'gri405.empFemale', type: 'number' },
                    { name: 'empOther', labelKey: 'gri405.empOther', type: 'number' },
                ],
            },
            {
                titleKey: 'gri405.secEmpAge',
                fields: [
                    { name: 'empBelow30', labelKey: 'gri405.empBelow30', type: 'number' },
                    { name: 'emp30to50', labelKey: 'gri405.emp30to50', type: 'number' },
                    { name: 'empAbove50', labelKey: 'gri405.empAbove50', type: 'number' },
                ],
            },
            {
                titleKey: 'gri405.secEmpCategory',
                fields: [
                    { name: 'empSeniorMgmt', labelKey: 'gri405.empSeniorMgmt', type: 'number' },
                    { name: 'empMiddleMgmt', labelKey: 'gri405.empMiddleMgmt', type: 'number' },
                    { name: 'empJuniorMgmt', labelKey: 'gri405.empJuniorMgmt', type: 'number' },
                    { name: 'empTechnical', labelKey: 'gri405.empTechnical', type: 'number' },
                    { name: 'empAdmin', labelKey: 'gri405.empAdmin', type: 'number' },
                    { name: 'empProduction', labelKey: 'gri405.empProduction', type: 'number' },
                ],
            },
            {
                titleKey: 'gri405.secDIPractices',
                fields: [
                    { name: 'diPolicy', labelKey: 'gri405.diPolicy', type: 'radio', options: YES_NO },
                    { name: 'equalOpportunityHiring', labelKey: 'gri405.equalOpportunityHiring', type: 'radio', options: YES_NO },
                    { name: 'antiDiscriminationTrainings', labelKey: 'gri405.antiDiscriminationTrainings', type: 'radio', options: YES_NO },
                    { name: 'diversityMetricsMonitored', labelKey: 'gri405.diversityMetricsMonitored', type: 'radio', options: YES_NO },
                    { name: 'diPolicyUpload', labelKey: 'gri405.diPolicyUpload', type: 'file' },
                ],
            },
            /* 405-2 */
            {
                titleKey: 'gri405.sec405_2',
                fields: [
                    { name: 'trackGenderPayRatio', labelKey: 'gri405.trackGenderPayRatio', type: 'radio', options: YES_NO },
                    { name: 'equalPayDocumented', labelKey: 'gri405.equalPayDocumented', type: 'radio', options: YES_NO },
                ],
            },
            {
                titleKey: 'gri405.secSalaryRatio',
                fields: [
                    { name: 'salMaleSrMgmt', labelKey: 'gri405.salMaleSrMgmt', type: 'number' },
                    { name: 'salFemaleSrMgmt', labelKey: 'gri405.salFemaleSrMgmt', type: 'number' },
                    { name: 'remMaleSrMgmt', labelKey: 'gri405.remMaleSrMgmt', type: 'number' },
                    { name: 'remFemaleSrMgmt', labelKey: 'gri405.remFemaleSrMgmt', type: 'number' },
                    { name: 'salMaleMidMgmt', labelKey: 'gri405.salMaleMidMgmt', type: 'number' },
                    { name: 'salFemaleMidMgmt', labelKey: 'gri405.salFemaleMidMgmt', type: 'number' },
                    { name: 'remMaleMidMgmt', labelKey: 'gri405.remMaleMidMgmt', type: 'number' },
                    { name: 'remFemaleMidMgmt', labelKey: 'gri405.remFemaleMidMgmt', type: 'number' },
                    { name: 'salMaleJrMgmt', labelKey: 'gri405.salMaleJrMgmt', type: 'number' },
                    { name: 'salFemaleJrMgmt', labelKey: 'gri405.salFemaleJrMgmt', type: 'number' },
                    { name: 'remMaleJrMgmt', labelKey: 'gri405.remMaleJrMgmt', type: 'number' },
                    { name: 'remFemaleJrMgmt', labelKey: 'gri405.remFemaleJrMgmt', type: 'number' },
                    { name: 'salMaleTech', labelKey: 'gri405.salMaleTech', type: 'number' },
                    { name: 'salFemaleTech', labelKey: 'gri405.salFemaleTech', type: 'number' },
                    { name: 'remMaleTech', labelKey: 'gri405.remMaleTech', type: 'number' },
                    { name: 'remFemaleTech', labelKey: 'gri405.remFemaleTech', type: 'number' },
                    { name: 'salMaleAdmin', labelKey: 'gri405.salMaleAdmin', type: 'number' },
                    { name: 'salFemaleAdmin', labelKey: 'gri405.salFemaleAdmin', type: 'number' },
                    { name: 'remMaleAdmin', labelKey: 'gri405.remMaleAdmin', type: 'number' },
                    { name: 'remFemaleAdmin', labelKey: 'gri405.remFemaleAdmin', type: 'number' },
                    { name: 'salMaleProd', labelKey: 'gri405.salMaleProd', type: 'number' },
                    { name: 'salFemaleProd', labelKey: 'gri405.salFemaleProd', type: 'number' },
                    { name: 'remMaleProd', labelKey: 'gri405.remMaleProd', type: 'number' },
                    { name: 'remFemaleProd', labelKey: 'gri405.remFemaleProd', type: 'number' },
                ],
            },
            {
                titleKey: 'gri405.secOperationalCoverage',
                fields: [
                    { name: 'definesSignificantLocations', labelKey: 'gri405.definesSignificantLocations', type: 'radio', options: YES_NO },
                    { name: 'significantLocationsList', labelKey: 'gri405.significantLocationsList', type: 'text', showWhen: (f) => f.definesSignificantLocations === 'YES' },
                    { name: 'payEquityPolicyUpload', labelKey: 'gri405.payEquityPolicyUpload', type: 'file' },
                ],
            },
        ],
    },

    /* ──────────────────────────────────────────── GRI 406 ──────────────────────────────────────────── */
    gri406: {
        draftKey: 'urimpact_esg_soc_gri406',
        griCode: 'GRI 406',
        titleKey: 'gri406.pageTitle',
        descKey: 'gri406.pageDesc',
        sections: [
            {
                titleKey: 'gri406.secPolicy',
                fields: [
                    { name: 'hasNonDiscPolicy', labelKey: 'gri406.hasNonDiscPolicy', type: 'radio', options: YES_NO },
                    { name: 'coversGender', labelKey: 'gri406.coversGender', type: 'radio', options: YES_NO },
                    { name: 'coversReligion', labelKey: 'gri406.coversReligion', type: 'radio', options: YES_NO },
                    { name: 'coversRace', labelKey: 'gri406.coversRace', type: 'radio', options: YES_NO },
                    { name: 'coversDisability', labelKey: 'gri406.coversDisability', type: 'radio', options: YES_NO },
                    { name: 'coversAge', labelKey: 'gri406.coversAge', type: 'radio', options: YES_NO },
                    { name: 'coversSexualHarassment', labelKey: 'gri406.coversSexualHarassment', type: 'radio', options: YES_NO },
                ],
            },
            {
                titleKey: 'gri406.secTrainingGrievance',
                fields: [
                    { name: 'nonDiscTraining', labelKey: 'gri406.nonDiscTraining', type: 'radio', options: YES_NO },
                    { name: 'employeesTrained', labelKey: 'gri406.employeesTrained', type: 'number' },
                    { name: 'hasGrievanceMechanism', labelKey: 'gri406.hasGrievanceMechanism', type: 'radio', options: YES_NO },
                    { name: 'anonymousReporting', labelKey: 'gri406.anonymousReporting', type: 'radio', options: YES_NO },
                ],
            },
            {
                titleKey: 'gri406.secIncidents',
                fields: [
                    { name: 'totalComplaints', labelKey: 'gri406.totalComplaints', type: 'number' },
                    { name: 'complaintsInvestigated', labelKey: 'gri406.complaintsInvestigated', type: 'number' },
                    { name: 'complaintsResolved', labelKey: 'gri406.complaintsResolved', type: 'number' },
                    { name: 'complaintsPending', labelKey: 'gri406.complaintsPending', type: 'number' },
                    { name: 'legalCasesFiled', labelKey: 'gri406.legalCasesFiled', type: 'radio', options: YES_NO },
                    { name: 'confirmedIncidents', labelKey: 'gri406.confirmedIncidents', type: 'number' },
                    { name: 'correctiveActionsTaken', labelKey: 'gri406.correctiveActionsTaken', type: 'radio', options: YES_NO },
                    { name: 'correctiveActionTypes', labelKey: 'gri406.correctiveActionTypes', type: 'checkboxes', options: CORRECTIVE_ACTION_TYPES, showWhen: (f) => f.correctiveActionsTaken === 'YES' },
                ],
            },
            {
                titleKey: 'gri406.secReview',
                fields: [
                    { name: 'periodicReview', labelKey: 'gri406.periodicReview', type: 'radio', options: YES_NO },
                    { name: 'highRiskDeptLocation', labelKey: 'gri406.highRiskDeptLocation', type: 'radio', options: YES_NO },
                    { name: 'highRiskDetail', labelKey: 'gri406.highRiskDetail', type: 'text', showWhen: (f) => f.highRiskDeptLocation === 'YES' },
                ],
            },
        ],
    },

    /* ──────────────────────────────────────────── GRI 407 ──────────────────────────────────────────── */
    gri407: {
        draftKey: 'urimpact_esg_soc_gri407',
        griCode: 'GRI 407',
        titleKey: 'gri407.pageTitle',
        descKey: 'gri407.pageDesc',
        sections: [
            {
                titleKey: 'gri407.secEmployeeRights',
                fields: [
                    { name: 'allowUnions', labelKey: 'gri407.allowUnions', type: 'radio', options: YES_NO },
                    { name: 'formalFreedomPolicy', labelKey: 'gri407.formalFreedomPolicy', type: 'radio', options: YES_NO },
                    { name: 'cbaCoverage', labelKey: 'gri407.cbaCoverage', type: 'radio', options: YES_NO },
                    { name: 'cbaCoveragePercent', labelKey: 'gri407.cbaCoveragePercent', type: 'number' },
                    { name: 'unionRestrictions', labelKey: 'gri407.unionRestrictions', type: 'radio', options: YES_NO },
                ],
            },
            {
                titleKey: 'gri407.secRiskAssessment',
                fields: [
                    { name: 'highRiskSitesIdentified', labelKey: 'gri407.highRiskSitesIdentified', type: 'radio', options: YES_NO },
                    { name: 'highRiskSitesCount', labelKey: 'gri407.highRiskSitesCount', type: 'number', showWhen: (f) => f.highRiskSitesIdentified === 'YES' },
                    { name: 'suppliersAssessedLaborRights', labelKey: 'gri407.suppliersAssessedLaborRights', type: 'radio', options: YES_NO },
                    { name: 'suppliersAssessedCount', labelKey: 'gri407.suppliersAssessedCount', type: 'number', showWhen: (f) => f.suppliersAssessedLaborRights === 'YES' },
                    { name: 'suppliersWithRisks', labelKey: 'gri407.suppliersWithRisks', type: 'number', showWhen: (f) => f.suppliersAssessedLaborRights === 'YES' },
                    { name: 'supplierCorrectiveAction', labelKey: 'gri407.supplierCorrectiveAction', type: 'radio', options: YES_NO, showWhen: (f) => f.suppliersAssessedLaborRights === 'YES' },
                    { name: 'supplierActionTypes', labelKey: 'gri407.supplierActionTypes', type: 'checkboxes', options: SUPPLIER_ACTION_TYPES, showWhen: (f) => f.supplierCorrectiveAction === 'YES' },
                ],
            },
            {
                titleKey: 'gri407.secComplaints',
                fields: [
                    { name: 'unionComplaints', labelKey: 'gri407.unionComplaints', type: 'radio', options: YES_NO },
                    { name: 'unionComplaintsCount', labelKey: 'gri407.unionComplaintsCount', type: 'number', showWhen: (f) => f.unionComplaints === 'YES' },
                    { name: 'unionComplaintsResolved', labelKey: 'gri407.unionComplaintsResolved', type: 'number', showWhen: (f) => f.unionComplaints === 'YES' },
                ],
            },
            {
                titleKey: 'gri407.secAuditTraining',
                fields: [
                    { name: 'laborRightsAudits', labelKey: 'gri407.laborRightsAudits', type: 'radio', options: YES_NO },
                    { name: 'auditFrequency', labelKey: 'gri407.auditFrequency', type: 'select', options: AUDIT_FREQ, showWhen: (f) => f.laborRightsAudits === 'YES' },
                    { name: 'contractWorkersCovered', labelKey: 'gri407.contractWorkersCovered', type: 'radio', options: YES_NO },
                    { name: 'workerRightsTraining', labelKey: 'gri407.workerRightsTraining', type: 'radio', options: YES_NO },
                    { name: 'workersTrained', labelKey: 'gri407.workersTrained', type: 'number', showWhen: (f) => f.workerRightsTraining === 'YES' },
                ],
            },
        ],
    },

    /* ──────────────────────────────────────────── GRI 408 ──────────────────────────────────────────── */
    gri408: {
        draftKey: 'urimpact_esg_soc_gri408',
        griCode: 'GRI 408',
        titleKey: 'gri408.pageTitle',
        descKey: 'gri408.pageDesc',
        sections: [
            {
                titleKey: 'gri408.secPrevention',
                fields: [
                    { name: 'childLaborPolicy', labelKey: 'gri408.childLaborPolicy', type: 'radio', options: YES_NO },
                    { name: 'minimumHiringAge', labelKey: 'gri408.minimumHiringAge', type: 'number' },
                    { name: 'ageVerificationMandatory', labelKey: 'gri408.ageVerificationMandatory', type: 'radio', options: YES_NO },
                    { name: 'ageVerificationDocs', labelKey: 'gri408.ageVerificationDocs', type: 'checkboxes', options: AGE_VERIFICATION_DOCS },
                ],
            },
            {
                titleKey: 'gri408.secIncidents',
                fields: [
                    { name: 'childLaborIncidents', labelKey: 'gri408.childLaborIncidents', type: 'radio', options: YES_NO },
                    { name: 'childLaborIncidentsCount', labelKey: 'gri408.childLaborIncidentsCount', type: 'number', showWhen: (f) => f.childLaborIncidents === 'YES' },
                    { name: 'youngWorkersHazardous', labelKey: 'gri408.youngWorkersHazardous', type: 'radio', options: YES_NO },
                    { name: 'youngWorkersHazardousCount', labelKey: 'gri408.youngWorkersHazardousCount', type: 'number', showWhen: (f) => f.youngWorkersHazardous === 'YES' },
                ],
            },
            {
                titleKey: 'gri408.secSupplier',
                fields: [
                    { name: 'supplierChildLaborAssessment', labelKey: 'gri408.supplierChildLaborAssessment', type: 'radio', options: YES_NO },
                    { name: 'suppliersAssessed', labelKey: 'gri408.suppliersAssessed', type: 'number', showWhen: (f) => f.supplierChildLaborAssessment === 'YES' },
                    { name: 'suppliersHighRisk', labelKey: 'gri408.suppliersHighRisk', type: 'number', showWhen: (f) => f.supplierChildLaborAssessment === 'YES' },
                    { name: 'supplierContractsSuspended', labelKey: 'gri408.supplierContractsSuspended', type: 'radio', options: YES_NO },
                ],
            },
            {
                titleKey: 'gri408.secAuditTraining',
                fields: [
                    { name: 'childLaborAudits', labelKey: 'gri408.childLaborAudits', type: 'radio', options: YES_NO },
                    { name: 'childLaborAuditFrequency', labelKey: 'gri408.childLaborAuditFrequency', type: 'select', options: AUDIT_FREQ, showWhen: (f) => f.childLaborAudits === 'YES' },
                    { name: 'childLaborTraining', labelKey: 'gri408.childLaborTraining', type: 'radio', options: YES_NO },
                    { name: 'childLaborTrained', labelKey: 'gri408.childLaborTrained', type: 'number', showWhen: (f) => f.childLaborTraining === 'YES' },
                    { name: 'youngWorkerRecords', labelKey: 'gri408.youngWorkerRecords', type: 'radio', options: YES_NO },
                    { name: 'hazardousTasksRestricted', labelKey: 'gri408.hazardousTasksRestricted', type: 'radio', options: YES_NO },
                ],
            },
        ],
    },
};

export function emptySocialForm(config) {
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

export const SOCIAL_FORM_KEYS = new Set(Object.keys(SOCIAL_DISCLOSURES));

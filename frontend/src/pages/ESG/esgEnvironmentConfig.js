/** GRI 300-series environment disclosure forms */

export const ENV_DISCLOSURES = {
    gri301: {
        draftKey: 'urimpact_esg_env_gri301',
        griCode: 'GRI 301',
        titleKey: 'gri301.pageTitle',
        descKey: 'gri301.pageDesc',
        sections: [
            {
                titleKey: 'gri301.sectionMaterials',
                fields: [
                    { name: 'maxRawMaterialFacility', labelKey: 'gri301.maxRawMaterialFacility' },
                    { name: 'highestMaterialIntensityProduct', labelKey: 'gri301.highestMaterialIntensityProduct' },
                    { name: 'highestImpactMaterialCategory', labelKey: 'gri301.highestImpactMaterialCategory' },
                    { name: 'lowestRecycledUsageSites', labelKey: 'gri301.lowestRecycledUsageSites' },
                    { name: 'highestPackagingWasteUnits', labelKey: 'gri301.highestPackagingWasteUnits' },
                ],
            },
            {
                titleKey: 'gri301.sectionTrends',
                fields: [
                    { name: 'trendMaterialUsage', labelKey: 'gri301.trendMaterialUsage' },
                    { name: 'trendRecycledInputs', labelKey: 'gri301.trendRecycledInputs' },
                    { name: 'trendPackagingRecovery', labelKey: 'gri301.trendPackagingRecovery' },
                ],
            },
        ],
    },
    gri302: {
        draftKey: 'urimpact_esg_env_gri302',
        griCode: 'GRI 302',
        titleKey: 'gri302.pageTitle',
        descKey: 'gri302.pageDesc',
        sections: [
            {
                titleKey: 'gri302.sectionFuel',
                fields: [
                    { name: 'fuelNonRenewable', labelKey: 'gri302.fuelNonRenewable' },
                    { name: 'fuelRenewable', labelKey: 'gri302.fuelRenewable' },
                ],
            },
            {
                titleKey: 'gri302.sectionConsumption',
                fields: [
                    { name: 'electricityConsumption', labelKey: 'gri302.electricityConsumption' },
                    { name: 'heatingConsumption', labelKey: 'gri302.heatingConsumption' },
                    { name: 'coolingConsumption', labelKey: 'gri302.coolingConsumption' },
                    { name: 'steamConsumption', labelKey: 'gri302.steamConsumption' },
                ],
            },
            {
                titleKey: 'gri302.sectionSold',
                fields: [
                    { name: 'electricitySold', labelKey: 'gri302.electricitySold' },
                    { name: 'heatingSold', labelKey: 'gri302.heatingSold' },
                    { name: 'coolingSold', labelKey: 'gri302.coolingSold' },
                    { name: 'steamSold', labelKey: 'gri302.steamSold' },
                ],
            },
            {
                titleKey: 'gri302.sectionTotal',
                fields: [
                    { name: 'totalEnergyConsumption', labelKey: 'gri302.totalEnergyConsumption' },
                    { name: 'energyMethodologies', labelKey: 'gri302.energyMethodologies' },
                ],
            },
        ],
    },
    gri303: {
        draftKey: 'urimpact_esg_env_gri303',
        griCode: 'GRI 303',
        titleKey: 'gri303.pageTitle',
        descKey: 'gri303.pageDesc',
        sections: [
            {
                titleKey: 'gri303.sectionEffluent',
                fields: [
                    { name: 'effluentStandardsDescription', labelKey: 'gri303.effluentStandardsDescription' },
                    { name: 'standardsNoLocalRequirements', labelKey: 'gri303.standardsNoLocalRequirements' },
                    { name: 'internalWaterQualityStandards', labelKey: 'gri303.internalWaterQualityStandards' },
                    { name: 'sectorSpecificStandards', labelKey: 'gri303.sectorSpecificStandards' },
                    { name: 'receivingWaterbodyProfile', labelKey: 'gri303.receivingWaterbodyProfile' },
                ],
            },
        ],
    },
};

export function emptyEnvForm(config) {
    const fields = {};
    for (const section of config.sections) {
        for (const field of section.fields) {
            fields[field.name] = '';
        }
    }
    return fields;
}

export const ENV_FORM_KEYS = new Set(Object.keys(ENV_DISCLOSURES));

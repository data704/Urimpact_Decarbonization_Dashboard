/** Official workbook header row (sheet "Purchased Steaming"). */
export const PS_TEMPLATE_COLUMNS = [
    'Activity Type',
    'Source Type',
    'Consumption',
    'Consumption Unit',
    'Site ID',
    'Start Date',
    'End Date',
];

/** Values accepted by the API `normalizeConsumptionUnit`. */
export const PS_TEMPLATE_UNITS = ['kWh', 'MWh', 'GJ'];

/** Preset "Activity Type" values — currently only one. */
export const PS_ACTIVITY_TYPE_PRESETS = [
    { value: 'Activity based', labelKey: 'ghg.ps.activityOption.activityBased' },
];

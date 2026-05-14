/** Official workbook header row (sheet "Stationary Combustion"). */
export const STATIONARY_TEMPLATE_COLUMNS = [
    'Asset',
    'Fuel Used',
    'Fuel Used Quantity',
    'Fuel Used Unit',
    'Facility',
    'Date of transaction',
];

/** Values accepted by the API `normalizeTemplateFuelUnit` (typical labels from the template). */
export const STATIONARY_TEMPLATE_UNITS = ['Litre', 'kg', 'Metric ton', 'm3', 'kWh', 'MWh'];

/**
 * Preset "Fuel used" values for the manual form dropdown. Wording aligns with common template rows
 * and backend `mapFuelUsedToActivityType`.
 */
export const STATIONARY_FUEL_SELECT_PRESETS = [
    { value: 'Diesel', labelKey: 'ghg.stationary.fuelOption.diesel' },
    { value: 'Petrol', labelKey: 'ghg.stationary.fuelOption.petrol' },
    { value: 'Gasoline', labelKey: 'ghg.stationary.fuelOption.gasoline' },
    { value: 'Natural gas', labelKey: 'ghg.stationary.fuelOption.natural_gas' },
    { value: 'CNG', labelKey: 'ghg.stationary.fuelOption.cng' },
    { value: 'LPG', labelKey: 'ghg.stationary.fuelOption.lpg' },
    { value: 'Kerosene', labelKey: 'ghg.stationary.fuelOption.kerosene' },
    { value: 'Bituminous Coal', labelKey: 'ghg.stationary.fuelOption.bituminous_coal' },
    { value: 'Furnace oil', labelKey: 'ghg.stationary.fuelOption.furnace_oil' },
    { value: 'Biomass', labelKey: 'ghg.stationary.fuelOption.biomass' },
];

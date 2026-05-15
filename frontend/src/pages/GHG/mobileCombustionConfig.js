/** Official workbook header row (sheet "Mobile Combustion"). */
export const MOBILE_TEMPLATE_COLUMNS = [
    'Vehicle Type',
    'Fuel Used',
    'Fuel Used Quantity',
    'Fuel Used Unit',
    'Facility',
    'Date of transaction',
];

/** Same unit labels as stationary template (backend `normalizeTemplateFuelUnit`). */
export const MOBILE_TEMPLATE_UNITS = ['Litre', 'kg', 'Metric ton', 'm3', 'kWh', 'MWh'];

export const MOBILE_VEHICLE_SELECT_PRESETS = [
    { value: 'Car', labelKey: 'ghg.mobile.vehicleOption.car' },
    { value: 'Bus', labelKey: 'ghg.mobile.vehicleOption.bus' },
    { value: '2 Wheeler', labelKey: 'ghg.mobile.vehicleOption.twoWheeler' },
];

export const MOBILE_FUEL_SELECT_PRESETS = [
    { value: 'Diesel', labelKey: 'ghg.mobile.fuelOption.diesel' },
    { value: 'Petrol', labelKey: 'ghg.mobile.fuelOption.petrol' },
    { value: 'Gasoline', labelKey: 'ghg.mobile.fuelOption.gasoline' },
    { value: 'Natural gas', labelKey: 'ghg.mobile.fuelOption.natural_gas' },
    { value: 'CNG', labelKey: 'ghg.mobile.fuelOption.cng' },
    { value: 'LPG', labelKey: 'ghg.mobile.fuelOption.lpg' },
    { value: 'Kerosene', labelKey: 'ghg.mobile.fuelOption.kerosene' },
];

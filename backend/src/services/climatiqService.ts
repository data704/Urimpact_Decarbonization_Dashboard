import axios from 'axios';
import { config } from '../config/index.js';
import {
  EmissionCalculationInput,
  EmissionCalculationResult,
  ClimatiqEstimateRequest,
  ClimatiqEstimateResponse,
} from '../types/index.js';
import { logger } from '../utils/logger.js';
import { AppError } from '../middleware/errorHandler.js';

// Create Axios instance for Climatiq API
const climatiqApi = axios.create({
  baseURL: config.climatiq.apiUrl,
  headers: {
    Authorization: `Bearer ${config.climatiq.apiKey}`,
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30 seconds
});

// Activity ID mappings for common activities
const ACTIVITY_MAPPINGS: Record<string, string> = {
  // Electricity
  'electricity': 'electricity-supply_grid-source_supplier_mix',
  'electricity-dubai': 'electricity-supply_grid-source_residual_mix',
  'electricity-uae': 'electricity-supply_grid-source_residual_mix',
  
  // Natural Gas
  'natural-gas': 'fuel_type_natural_gas-fuel_use_stationary_combustion',
  'natural_gas': 'fuel_type_natural_gas-fuel_use_stationary_combustion',
  
  // Fuels
  'diesel': 'fuel_type_diesel-fuel_use_stationary_combustion',
  'petrol': 'fuel_type_motor_gasoline-fuel_use_stationary_combustion',
  'gasoline': 'fuel_type_motor_gasoline-fuel_use_stationary_combustion',
  'lpg': 'fuel_type_lpg-fuel_use_stationary_combustion',
  
  // Transportation
  'vehicle-diesel': 'passenger_vehicle-vehicle_type_car-fuel_source_diesel-engine_size_medium-vehicle_age_na-vehicle_weight_na',
  'vehicle-petrol': 'passenger_vehicle-vehicle_type_car-fuel_source_petrol-engine_size_medium-vehicle_age_na-vehicle_weight_na',
  'flight-short': 'passenger_flight-route_type_domestic-aircraft_type_na-distance_na-class_economy-rf_included',
  'flight-long': 'passenger_flight-route_type_international-aircraft_type_na-distance_na-class_economy-rf_included',
  
  // Water
  'water-supply': 'water-supply_type_mains-treatment_type_typical',
  'water-treatment': 'water-type_wastewater-treatment_type_typical',
};

// Unit mappings
const UNIT_MAPPINGS: Record<string, string> = {
  'kWh': 'kWh',
  'kwh': 'kWh',
  'MWh': 'MWh',
  'mwh': 'MWh',
  'L': 'l',
  'l': 'l',
  'liters': 'l',
  'litres': 'l',
  'gallons': 'gal',
  'gal': 'gal',
  'kg': 'kg',
  'tonnes': 't',
  't': 't',
  'km': 'km',
  'miles': 'mi',
  'mi': 'mi',
  'm3': 'm3',
  'cubic_meters': 'm3',
};

/**
 * Map activity type to Climatiq activity ID
 */
function getActivityId(activityType: string, region?: string): string {
  const normalizedType = activityType.toLowerCase().replace(/\s+/g, '-');
  
  // Check direct mapping
  if (ACTIVITY_MAPPINGS[normalizedType]) {
    return ACTIVITY_MAPPINGS[normalizedType];
  }

  // Check with region suffix
  const withRegion = `${normalizedType}-${region?.toLowerCase()}`;
  if (ACTIVITY_MAPPINGS[withRegion]) {
    return ACTIVITY_MAPPINGS[withRegion];
  }

  // Default mappings based on keywords
  if (normalizedType.includes('electric')) {
    return ACTIVITY_MAPPINGS['electricity'];
  }
  if (normalizedType.includes('gas') && !normalizedType.includes('petrol')) {
    return ACTIVITY_MAPPINGS['natural-gas'];
  }
  if (normalizedType.includes('diesel')) {
    return ACTIVITY_MAPPINGS['diesel'];
  }
  if (normalizedType.includes('petrol') || normalizedType.includes('gasoline')) {
    return ACTIVITY_MAPPINGS['petrol'];
  }

  // Return as-is if no mapping found (user might provide exact Climatiq ID)
  return activityType;
}

/**
 * Normalize unit for Climatiq API
 */
function normalizeUnit(unit: string): string {
  return UNIT_MAPPINGS[unit] || unit.toLowerCase();
}

/**
 * Determine parameter type from activity and unit
 */
function getParameterType(activityType: string, unit: string): 'energy' | 'volume' | 'weight' | 'distance' | 'money' {
  const normalizedUnit = unit.toLowerCase();
  
  if (['kwh', 'mwh', 'wh', 'gj', 'mj', 'btu', 'therm'].includes(normalizedUnit)) {
    return 'energy';
  }
  if (['l', 'gal', 'm3', 'ft3'].includes(normalizedUnit)) {
    return 'volume';
  }
  if (['kg', 't', 'lb', 'ton'].includes(normalizedUnit)) {
    return 'weight';
  }
  if (['km', 'mi', 'm'].includes(normalizedUnit)) {
    return 'distance';
  }
  if (['usd', 'aed', 'eur', 'gbp'].includes(normalizedUnit)) {
    return 'money';
  }
  
  // Default to energy for electricity-related activities
  if (activityType.toLowerCase().includes('electric')) {
    return 'energy';
  }
  
  return 'energy';
}

/**
 * Calculate emissions using Climatiq API
 */
export async function calculateEmissions(
  input: EmissionCalculationInput
): Promise<EmissionCalculationResult> {
  const activityId = getActivityId(input.activityType, input.region);
  const normalizedUnit = normalizeUnit(input.activityUnit);
  const parameterType = getParameterType(input.activityType, input.activityUnit);

  // Build request (format per Climatiq quickstart & API reference)
  const request: ClimatiqEstimateRequest = {
    emission_factor: {
      activity_id: activityId,
      data_version: '^21',
      ...(input.region && input.region !== 'GLOBAL' && { region: input.region }),
    },
    parameters: {
      [parameterType]: input.activityAmount,
      [`${parameterType}_unit`]: normalizedUnit,
    },
  };

  logger.debug('Climatiq API request:', request);

  // Check if API key is configured
  if (!config.climatiq.apiKey) {
    logger.warn('Climatiq API key not configured, using fallback calculation');
    return getFallbackCalculation(input);
  }

  try {
    // Climatiq estimate endpoint per https://www.climatiq.io/docs/guides/tutorials/quickstart
    const response = await climatiqApi.post<ClimatiqEstimateResponse>(
      '/data/v1/estimate',
      request
    );

    const data = response.data;

    logger.debug('Climatiq API response:', data);

    return {
      co2e: data.co2e,
      co2eUnit: data.co2e_unit,
      co2: data.constituent_gases?.co2 ?? undefined,
      ch4: data.constituent_gases?.ch4 ?? undefined,
      n2o: data.constituent_gases?.n2o ?? undefined,
      emissionFactor: data.emission_factor?.id ? 1 : data.co2e / input.activityAmount,
      emissionFactorUnit: `${data.co2e_unit}/${normalizedUnit}`,
      dataSource: data.emission_factor?.source || 'Emissions API',
      dataYear: data.emission_factor?.year,
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      logger.error('Climatiq API error:', {
        status: error.response?.status,
        data: error.response?.data,
      });

      // If activity not found, try fallback
      if (error.response?.status === 404 || error.response?.status === 400) {
        logger.warn('Activity not found in Climatiq, using fallback');
        return getFallbackCalculation(input);
      }

      throw new AppError(
        `Emissions calculation failed: ${error.response?.data?.message || error.message}`,
        500
      );
    }

    throw error;
  }
}

/**
 * Comprehensive emission factors for fallback calculations
 * Based on DEFRA, EPA, IEA, and regional UAE data
 * Used when Climatiq API is unavailable or not configured
 */
const FALLBACK_EMISSION_FACTORS: Record<string, { 
  factor: number; 
  unit: string; 
  source: string;
  co2Ratio: number;  // Ratio of CO2 to total CO2e
  ch4Ratio: number;  // Ratio of CH4 to total CO2e
  n2oRatio: number;  // Ratio of N2O to total CO2e
}> = {
  // ============ ELECTRICITY (kg CO2e per kWh) ============
  // UAE Regional Grid Factors
  'electricity': { factor: 0.404, unit: 'kg/kWh', source: 'UAE National Grid Average (IEA 2024)', co2Ratio: 0.98, ch4Ratio: 0.01, n2oRatio: 0.01 },
  'electricity-ae': { factor: 0.404, unit: 'kg/kWh', source: 'UAE National Grid (IEA 2024)', co2Ratio: 0.98, ch4Ratio: 0.01, n2oRatio: 0.01 },
  'electricity-ae-du': { factor: 0.385, unit: 'kg/kWh', source: 'DEWA Dubai Grid (2024)', co2Ratio: 0.98, ch4Ratio: 0.01, n2oRatio: 0.01 },
  'electricity-ae-az': { factor: 0.418, unit: 'kg/kWh', source: 'ADWEA Abu Dhabi Grid (2024)', co2Ratio: 0.98, ch4Ratio: 0.01, n2oRatio: 0.01 },
  'electricity-ae-sh': { factor: 0.412, unit: 'kg/kWh', source: 'SEWA Sharjah Grid (2024)', co2Ratio: 0.98, ch4Ratio: 0.01, n2oRatio: 0.01 },
  'electricity-ae-fu': { factor: 0.425, unit: 'kg/kWh', source: 'FEWA Grid (2024)', co2Ratio: 0.98, ch4Ratio: 0.01, n2oRatio: 0.01 },
  'electricity-dubai': { factor: 0.385, unit: 'kg/kWh', source: 'DEWA Dubai (2024)', co2Ratio: 0.98, ch4Ratio: 0.01, n2oRatio: 0.01 },
  'electricity-abudhabi': { factor: 0.418, unit: 'kg/kWh', source: 'ADWEA Abu Dhabi (2024)', co2Ratio: 0.98, ch4Ratio: 0.01, n2oRatio: 0.01 },
  
  // ============ FUELS - Stationary Combustion (kg CO2e per liter) ============
  'diesel': { factor: 2.70, unit: 'kg/L', source: 'DEFRA 2024', co2Ratio: 0.99, ch4Ratio: 0.005, n2oRatio: 0.005 },
  'petrol': { factor: 2.31, unit: 'kg/L', source: 'DEFRA 2024', co2Ratio: 0.99, ch4Ratio: 0.005, n2oRatio: 0.005 },
  'gasoline': { factor: 2.31, unit: 'kg/L', source: 'DEFRA 2024', co2Ratio: 0.99, ch4Ratio: 0.005, n2oRatio: 0.005 },
  'premium': { factor: 2.34, unit: 'kg/L', source: 'DEFRA 2024', co2Ratio: 0.99, ch4Ratio: 0.005, n2oRatio: 0.005 },
  'lpg': { factor: 1.56, unit: 'kg/L', source: 'DEFRA 2024', co2Ratio: 0.99, ch4Ratio: 0.005, n2oRatio: 0.005 },
  'kerosene': { factor: 2.54, unit: 'kg/L', source: 'DEFRA 2024', co2Ratio: 0.99, ch4Ratio: 0.005, n2oRatio: 0.005 },
  'fuel-oil': { factor: 3.18, unit: 'kg/L', source: 'DEFRA 2024', co2Ratio: 0.99, ch4Ratio: 0.005, n2oRatio: 0.005 },
  
  // ============ NATURAL GAS (kg CO2e per m3) ============
  'natural-gas': { factor: 2.02, unit: 'kg/m3', source: 'IPCC 2024', co2Ratio: 0.995, ch4Ratio: 0.003, n2oRatio: 0.002 },
  'natural_gas': { factor: 2.02, unit: 'kg/m3', source: 'IPCC 2024', co2Ratio: 0.995, ch4Ratio: 0.003, n2oRatio: 0.002 },
  'lng': { factor: 2.02, unit: 'kg/m3', source: 'IPCC 2024', co2Ratio: 0.995, ch4Ratio: 0.003, n2oRatio: 0.002 },
  
  // ============ WATER (kg CO2e per m3) ============
  'water': { factor: 0.344, unit: 'kg/m3', source: 'DEFRA 2024', co2Ratio: 0.95, ch4Ratio: 0.03, n2oRatio: 0.02 },
  'water-supply': { factor: 0.149, unit: 'kg/m3', source: 'DEFRA 2024 - Supply', co2Ratio: 0.95, ch4Ratio: 0.03, n2oRatio: 0.02 },
  'water-treatment': { factor: 0.272, unit: 'kg/m3', source: 'DEFRA 2024 - Treatment', co2Ratio: 0.90, ch4Ratio: 0.06, n2oRatio: 0.04 },
  
  // ============ TRANSPORTATION (kg CO2e per km) ============
  'vehicle-diesel': { factor: 0.171, unit: 'kg/km', source: 'DEFRA 2024 - Medium Diesel Car', co2Ratio: 0.99, ch4Ratio: 0.005, n2oRatio: 0.005 },
  'vehicle-petrol': { factor: 0.174, unit: 'kg/km', source: 'DEFRA 2024 - Medium Petrol Car', co2Ratio: 0.99, ch4Ratio: 0.005, n2oRatio: 0.005 },
  'vehicle-hybrid': { factor: 0.120, unit: 'kg/km', source: 'DEFRA 2024 - Hybrid Car', co2Ratio: 0.99, ch4Ratio: 0.005, n2oRatio: 0.005 },
  'vehicle-electric': { factor: 0.053, unit: 'kg/km', source: 'DEFRA 2024 - Electric Car (UAE grid)', co2Ratio: 0.98, ch4Ratio: 0.01, n2oRatio: 0.01 },
  'taxi': { factor: 0.149, unit: 'kg/km', source: 'DEFRA 2024 - Taxi', co2Ratio: 0.99, ch4Ratio: 0.005, n2oRatio: 0.005 },
  'bus': { factor: 0.089, unit: 'kg/km', source: 'DEFRA 2024 - Bus (per passenger)', co2Ratio: 0.99, ch4Ratio: 0.005, n2oRatio: 0.005 },
  
  // ============ FLIGHTS (kg CO2e per km) ============
  'flight-domestic': { factor: 0.246, unit: 'kg/km', source: 'DEFRA 2024 - Domestic Flight (Economy)', co2Ratio: 0.95, ch4Ratio: 0.02, n2oRatio: 0.03 },
  'flight-short': { factor: 0.151, unit: 'kg/km', source: 'DEFRA 2024 - Short Haul (Economy)', co2Ratio: 0.95, ch4Ratio: 0.02, n2oRatio: 0.03 },
  'flight-long': { factor: 0.148, unit: 'kg/km', source: 'DEFRA 2024 - Long Haul (Economy)', co2Ratio: 0.95, ch4Ratio: 0.02, n2oRatio: 0.03 },
  'flight-business': { factor: 0.429, unit: 'kg/km', source: 'DEFRA 2024 - Long Haul (Business)', co2Ratio: 0.95, ch4Ratio: 0.02, n2oRatio: 0.03 },
  
  // ============ WASTE (kg CO2e per kg or tonne) ============
  'waste-landfill': { factor: 0.587, unit: 'kg/kg', source: 'DEFRA 2024 - Mixed Waste Landfill', co2Ratio: 0.40, ch4Ratio: 0.55, n2oRatio: 0.05 },
  'waste-recycling': { factor: 0.021, unit: 'kg/kg', source: 'DEFRA 2024 - Mixed Recycling', co2Ratio: 0.90, ch4Ratio: 0.05, n2oRatio: 0.05 },
  'waste-incineration': { factor: 0.021, unit: 'kg/kg', source: 'DEFRA 2024 - Incineration with recovery', co2Ratio: 0.95, ch4Ratio: 0.03, n2oRatio: 0.02 },
  
  // ============ REFRIGERANTS (kg CO2e per kg) ============
  'refrigerant-r410a': { factor: 2088, unit: 'kg/kg', source: 'IPCC AR5 - R410A GWP', co2Ratio: 0, ch4Ratio: 0, n2oRatio: 0 },
  'refrigerant-r134a': { factor: 1430, unit: 'kg/kg', source: 'IPCC AR5 - R134a GWP', co2Ratio: 0, ch4Ratio: 0, n2oRatio: 0 },
  'refrigerant-r32': { factor: 675, unit: 'kg/kg', source: 'IPCC AR5 - R32 GWP', co2Ratio: 0, ch4Ratio: 0, n2oRatio: 0 },
};

/**
 * Fallback calculation using comprehensive emission factors
 * Used when Climatiq API is unavailable or not configured
 */
function getFallbackCalculation(
  input: EmissionCalculationInput
): EmissionCalculationResult {
  const normalizedType = input.activityType.toLowerCase().replace(/\s+/g, '-');
  const normalizedRegion = input.region?.toLowerCase().replace(/\s+/g, '-');
  
  // Try to find the best matching emission factor
  let factorData = null;
  
  // 1. Try exact match with region
  if (normalizedRegion) {
    const withRegion = `${normalizedType}-${normalizedRegion}`;
    factorData = FALLBACK_EMISSION_FACTORS[withRegion];
  }
  
  // 2. Try exact match without region
  if (!factorData) {
    factorData = FALLBACK_EMISSION_FACTORS[normalizedType];
  }
  
  // 3. Try partial match
  if (!factorData) {
    for (const [key, value] of Object.entries(FALLBACK_EMISSION_FACTORS)) {
      if (normalizedType.includes(key) || key.includes(normalizedType)) {
        factorData = value;
        break;
      }
    }
  }
  
  // 4. Try keyword-based matching
  if (!factorData) {
    if (normalizedType.includes('electric') || normalizedType.includes('kwh')) {
      factorData = FALLBACK_EMISSION_FACTORS['electricity'];
    } else if (normalizedType.includes('gas') && !normalizedType.includes('petrol') && !normalizedType.includes('gasoline')) {
      factorData = FALLBACK_EMISSION_FACTORS['natural-gas'];
    } else if (normalizedType.includes('diesel')) {
      factorData = FALLBACK_EMISSION_FACTORS['diesel'];
    } else if (normalizedType.includes('petrol') || normalizedType.includes('gasoline')) {
      factorData = FALLBACK_EMISSION_FACTORS['petrol'];
    } else if (normalizedType.includes('water')) {
      factorData = FALLBACK_EMISSION_FACTORS['water'];
    } else if (normalizedType.includes('flight') || normalizedType.includes('air')) {
      factorData = FALLBACK_EMISSION_FACTORS['flight-short'];
    } else if (normalizedType.includes('vehicle') || normalizedType.includes('car')) {
      factorData = FALLBACK_EMISSION_FACTORS['vehicle-petrol'];
    }
  }

  // 5. Default to electricity if nothing matches (most common use case)
  if (!factorData) {
    factorData = { 
      factor: 0.4, 
      unit: 'kg/unit', 
      source: 'Default Estimate (UAE Average)', 
      co2Ratio: 0.95, 
      ch4Ratio: 0.03, 
      n2oRatio: 0.02 
    };
  }

  const co2e = input.activityAmount * factorData.factor;
  
  // Calculate constituent gases based on ratios
  const co2 = co2e * factorData.co2Ratio;
  const ch4 = co2e * factorData.ch4Ratio;
  const n2o = co2e * factorData.n2oRatio;

  logger.info(`Fallback emission calculation: ${input.activityAmount} ${input.activityUnit} of ${input.activityType} = ${co2e.toFixed(2)} kg CO2e (using ${factorData.source})`);

  return {
    co2e: parseFloat(co2e.toFixed(4)),
    co2eUnit: 'kg',
    co2: parseFloat(co2.toFixed(4)),
    ch4: parseFloat(ch4.toFixed(6)),
    n2o: parseFloat(n2o.toFixed(6)),
    emissionFactor: factorData.factor,
    emissionFactorUnit: factorData.unit,
    dataSource: `Local Calculation - ${factorData.source}`,
    dataYear: new Date().getFullYear(),
  };
}

/**
 * Search for emission factors
 */
export async function searchEmissionFactors(query: string, region?: string) {
  if (!config.climatiq.apiKey) {
    logger.warn('Climatiq API key not configured');
    return [];
  }

  try {
    const response = await climatiqApi.get('/emission-factors', {
      params: {
        query,
        region: region || undefined,
        results_per_page: 20,
      },
    });

    return response.data.results || [];
  } catch (error) {
    logger.error('Failed to search emission factors:', error);
    return [];
  }
}

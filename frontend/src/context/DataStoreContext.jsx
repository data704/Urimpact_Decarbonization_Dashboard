import { createContext, useContext, useState, useEffect } from 'react';
import { getAuthToken } from '../api/client.js';

const DataStoreContext = createContext();

// Storage keys
const KEYS = {
    SCOPE1_ENTRIES: 'urimpact_scope1_entries',
    SCOPE2_ENTRIES: 'urimpact_scope2_entries',
    ACTIVITIES: 'urimpact_activities'
};

// Source labels for activities
const SCOPE1_SOURCES = ['Fleet Receipt', 'Fuel Invoice', 'Vehicle Refuel', 'Diesel Receipt', 'Natural Gas Bill', 'LPG Invoice', 'Gasoline Receipt'];
const SCOPE2_SOURCES = ['Utility Bill', 'Electricity Bill', 'Electricity Invoice', 'Energy Statement', 'Grid Bill', 'Power Bill'];

// Demo data
const getDemoScope1 = () => [
    {
        id: 1,
        date: '2025-12-15',
        fuelType: 'Diesel',
        combustionType: 'mobile',
        amount: 500,
        unit: 'Liters',
        vehicleId: 'VH-001',
        emissions: 198,
        status: 'verified',
        costAmount: 720,
        currency: 'USD'
    },
    {
        id: 2,
        date: '2025-12-10',
        fuelType: 'Natural Gas',
        combustionType: 'stationary',
        amount: 1200,
        unit: 'm³',
        vehicleId: '',
        emissions: 213,
        status: 'verified',
        costAmount: 540,
        currency: 'USD'
    },
    {
        id: 3,
        date: '2025-12-05',
        fuelType: 'Diesel',
        combustionType: 'mobile',
        amount: 350,
        unit: 'Liters',
        vehicleId: 'VH-003',
        emissions: 139,
        status: 'verified',
        costAmount: 520,
        currency: 'USD'
    }
];

const getDemoScope2 = () => [
    {
        id: 1,
        date: '2025-12-15',
        electricity: 12500,
        unit: 'kWh',
        calcMethod: 'location',
        supplier: 'City Power Company',
        gridRegion: 'US - WECC',
        emissions: 520,
        status: 'verified',
        costAmount: 1480,
        currency: 'USD'
    },
    {
        id: 2,
        date: '2025-12-01',
        electricity: 18000,
        unit: 'kWh',
        calcMethod: 'location',
        supplier: 'Green Energy Corp',
        gridRegion: 'US - RFC',
        emissions: 680,
        status: 'verified',
        costAmount: 2120,
        currency: 'USD'
    },
    {
        id: 3,
        date: '2025-11-20',
        electricity: 9500,
        unit: 'kWh',
        calcMethod: 'location',
        supplier: 'City Power Company',
        gridRegion: 'US - WECC',
        emissions: 400,
        status: 'verified',
        costAmount: 1085,
        currency: 'USD'
    }
];

const getDemoActivities = () => [
    { id: 1, source: 'Fleet Receipt', date: '2025-12-15', status: 'verified', amount: 198, type: 'scope1' },
    { id: 2, source: 'Electricity Bill', date: '2025-12-10', status: 'verified', amount: 520, type: 'scope2' },
    { id: 3, source: 'Fuel Invoice', date: '2025-12-05', status: 'verified', amount: 139, type: 'scope1' },
    { id: 4, source: 'Utility Bill', date: '2025-11-20', status: 'verified', amount: 400, type: 'scope2' },
    { id: 5, source: 'Natural Gas Bill', date: '2025-11-15', status: 'verified', amount: 213, type: 'scope1' }
];

// Emission calculation functions
const calculateScope1Emissions = (entry) => {
    const factors = {
        'Diesel': { 'Liters': 2.68, 'Gallons': 10.15, 'kg': 3.16 },
        'Gasoline/Petrol': { 'Liters': 2.31, 'Gallons': 8.74, 'kg': 3.08 },
        'Natural Gas': { 'm³': 1.89, 'kg': 2.75 },
        'LPG': { 'Liters': 1.51, 'Gallons': 5.72, 'kg': 2.98 },
        'Biodiesel': { 'Liters': 0.5, 'Gallons': 1.89, 'kg': 0.6 }
    };
    
    const factor = factors[entry.fuelType]?.[entry.unit] || 2.5;
    return Math.round(entry.amount * factor / 1000 * 100) / 100;
};

const calculateScope2Emissions = (entry) => {
    const gridFactors = {
        'US - WECC': 0.000322,
        'US - RFC': 0.000440,
        'US - SERC': 0.000390,
        'EU - Average': 0.000275,
        'UK - Grid': 0.000233
    };
    
    let electricity = entry.electricity;
    if (entry.unit === 'MWh') {
        electricity *= 1000;
    }
    
    const factor = gridFactors[entry.gridRegion] || 0.0004;
    return Math.round(electricity * factor * 100) / 100;
};

export function DataStoreProvider({ children }) {
    const [scope1Entries, setScope1Entries] = useState([]);
    const [scope2Entries, setScope2Entries] = useState([]);
    const [activities, setActivities] = useState([]);

    // When user is logged in to backend, do not use demo or persisted local data
    useEffect(() => {
        const token = getAuthToken();
        if (token) {
            setScope1Entries([]);
            setScope2Entries([]);
            setActivities([]);
            [KEYS.SCOPE1_ENTRIES, KEYS.SCOPE2_ENTRIES, KEYS.ACTIVITIES].forEach((key) => localStorage.removeItem(key));
            return;
        }
        const storedScope1 = localStorage.getItem(KEYS.SCOPE1_ENTRIES);
        const storedScope2 = localStorage.getItem(KEYS.SCOPE2_ENTRIES);
        const storedActivities = localStorage.getItem(KEYS.ACTIVITIES);
        setScope1Entries(storedScope1 ? JSON.parse(storedScope1) : []);
        setScope2Entries(storedScope2 ? JSON.parse(storedScope2) : []);
        setActivities(storedActivities ? JSON.parse(storedActivities) : []);
    }, []);

    // Add Scope 1 entry
    const addScope1Entry = (entry) => {
        const newEntry = {
            ...entry,
            id: Date.now(),
            status: 'verified',
            costAmount: Number(entry.costAmount) || 0,
            currency: entry.currency || 'USD',
            emissions: calculateScope1Emissions(entry)
        };

        const newEntries = [newEntry, ...scope1Entries];
        setScope1Entries(newEntries);
        localStorage.setItem(KEYS.SCOPE1_ENTRIES, JSON.stringify(newEntries));

        // Add activity
        const source = SCOPE1_SOURCES[newEntries.length % SCOPE1_SOURCES.length];
        addActivity({
            source,
            date: entry.date,
            status: 'verified',
            amount: newEntry.emissions,
            type: 'scope1'
        });

        return newEntry;
    };

    // Add Scope 2 entry
    const addScope2Entry = (entry) => {
        const newEntry = {
            ...entry,
            id: Date.now(),
            status: 'verified',
            costAmount: Number(entry.costAmount) || 0,
            currency: entry.currency || 'USD',
            emissions: calculateScope2Emissions(entry)
        };

        const newEntries = [newEntry, ...scope2Entries];
        setScope2Entries(newEntries);
        localStorage.setItem(KEYS.SCOPE2_ENTRIES, JSON.stringify(newEntries));

        // Add activity
        const source = SCOPE2_SOURCES[newEntries.length % SCOPE2_SOURCES.length];
        addActivity({
            source,
            date: entry.date,
            status: 'verified',
            amount: newEntry.emissions,
            type: 'scope2'
        });

        return newEntry;
    };

    // Add activity
    const addActivity = (activity) => {
        const newActivity = { ...activity, id: Date.now() };
        const newActivities = [newActivity, ...activities].slice(0, 10);
        setActivities(newActivities);
        localStorage.setItem(KEYS.ACTIVITIES, JSON.stringify(newActivities));
    };

    // Get totals
    const getTotalScope1 = () => scope1Entries.reduce((sum, entry) => sum + (entry.emissions || 0), 0);
    const getTotalScope2 = () => scope2Entries.reduce((sum, entry) => sum + (entry.emissions || 0), 0);
    const getTotalEmissions = () => getTotalScope1() + getTotalScope2();

    // Get monthly data for charts
    const getMonthlyData = () => {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const scope1Data = new Array(12).fill(0);
        const scope2Data = new Array(12).fill(0);
        
        scope1Entries.forEach(entry => {
            const month = new Date(entry.date).getMonth();
            scope1Data[month] += entry.emissions || 0;
        });
        
        scope2Entries.forEach(entry => {
            const month = new Date(entry.date).getMonth();
            scope2Data[month] += entry.emissions || 0;
        });

        return {
            labels: months,
            scope1: scope1Data.map(v => Math.round(v * 100) / 100),
            scope2: scope2Data.map(v => Math.round(v * 100) / 100)
        };
    };

    // Get Scope 1 breakdown
    const getScope1Breakdown = () => {
        const breakdown = { 'Mobile Combustion': 0, 'Stationary Combustion': 0 };
        
        scope1Entries.forEach(entry => {
            if (entry.combustionType === 'mobile') {
                breakdown['Mobile Combustion'] += entry.emissions || 0;
            } else {
                breakdown['Stationary Combustion'] += entry.emissions || 0;
            }
        });
        
        return breakdown;
    };

    // Aggregated activity data for report table (from data input)
    const getReportActivityData = () => {
        let mobileAmount = 0, mobileUnit = 'L', stationaryAmount = 0, stationaryUnit = 'm³', totalKwh = 0;
        scope1Entries.forEach(entry => {
            const amt = Number(entry.amount) || 0;
            if (entry.combustionType === 'mobile') {
                mobileAmount += amt;
                if (entry.unit) mobileUnit = entry.unit === 'Liters' ? 'L' : entry.unit === 'Gallons' ? 'Gal' : entry.unit;
            } else {
                stationaryAmount += amt;
                if (entry.unit) stationaryUnit = entry.unit;
            }
        });
        scope2Entries.forEach(entry => {
            let kwh = Number(entry.electricity) || 0;
            if (entry.unit === 'MWh') kwh = kwh * 1000;
            totalKwh += kwh;
        });
        const fmt = (n, decimals) => Number(n).toLocaleString('en-US', { maximumFractionDigits: decimals ?? 0, minimumFractionDigits: 0 });
        return {
            mobile: { label: mobileAmount > 0 ? `${fmt(mobileAmount)} ${mobileUnit}` : '0 L' },
            stationary: { label: stationaryAmount > 0 ? `${fmt(stationaryAmount)} ${stationaryUnit}` : '0 m³' },
            scope2: { label: totalKwh >= 1000 ? `${fmt(totalKwh / 1000, 1)} MWh` : `${fmt(totalKwh)} kWh` }
        };
    };

    // Reporting period from data (min/max dates) or null for default
    const getReportingPeriodLabel = () => {
        const dates = [...scope1Entries.map(e => e.date), ...scope2Entries.map(e => e.date)].filter(Boolean);
        if (dates.length === 0) return null;
        const min = dates.reduce((a, b) => (a < b ? a : b));
        const max = dates.reduce((a, b) => (a > b ? a : b));
        const fmt = (d) => new Date(d).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        return `${fmt(min)} – ${fmt(max)}`;
    };

    // Get amount spent
    const getAmountSpent = () => {
        const rates = { USD: 1, EUR: 1.08, GBP: 1.27, CAD: 0.74, AUD: 0.66, SAR: 0.27 };
        const toUsd = (amount, currency) => {
            if (!amount || amount <= 0) return 0;
            return amount * (rates[currency] || 1);
        };
        
        let total = 0;
        scope1Entries.forEach(entry => {
            if (entry.costAmount && entry.costAmount > 0) {
                total += toUsd(entry.costAmount, entry.currency);
            } else {
                total += (entry.amount || 0) * 0.8;
            }
        });
        scope2Entries.forEach(entry => {
            if (entry.costAmount && entry.costAmount > 0) {
                total += toUsd(entry.costAmount, entry.currency);
            } else {
                const kwh = entry.unit === 'MWh' ? (entry.electricity || 0) * 1000 : (entry.electricity || 0);
                total += kwh * 0.12;
            }
        });
        return Math.round(total);
    };

    // Clear all local data (no demo reset)
    const resetToDemo = () => {
        setScope1Entries([]);
        setScope2Entries([]);
        setActivities([]);
        [KEYS.SCOPE1_ENTRIES, KEYS.SCOPE2_ENTRIES, KEYS.ACTIVITIES].forEach((key) => localStorage.removeItem(key));
    };

    const value = {
        scope1Entries,
        scope2Entries,
        activities,
        addScope1Entry,
        addScope2Entry,
        getTotalScope1,
        getTotalScope2,
        getTotalEmissions,
        getMonthlyData,
        getScope1Breakdown,
        getReportActivityData,
        getReportingPeriodLabel,
        getAmountSpent,
        resetToDemo
    };

    return (
        <DataStoreContext.Provider value={value}>
            {children}
        </DataStoreContext.Provider>
    );
}

export function useDataStore() {
    const context = useContext(DataStoreContext);
    if (!context) {
        throw new Error('useDataStore must be used within a DataStoreProvider');
    }
    return context;
}

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { useDataStore } from '../../context/DataStoreContext';
import { uploadReceiptAndExtract, uploadReceiptsMultiple, processDocument, submitReceiptExtraction, submitReceiptBatch, submitManualEmission, getAuthToken, getEmissions, deleteEmission, deleteEmissionsBulk } from '../../api/client.js';
import { isAdministrator } from '../../utils/roles';
import './DataInput.css';
import '../Dashboard/Dashboard.css';

// Upload limits (must match backend: MAX_FILE_SIZE, uploadMultiple.files)
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_FILES_COUNT = 10;
const MAX_FILE_SIZE_MB = 10;

const SITES_KEY_PREFIX = 'urimpact_data_input_sites_';
const ACTIVITY_KEY_PREFIX = 'urimpact_site_activity_';

const COUNTRY_OPTIONS = [
    'United Arab Emirates',
    'Saudi Arabia',
    'Qatar',
    'Kuwait',
    'Bahrain',
    'Oman',
];
const FACILITY_TYPES = ['Office', 'Warehouse', 'Manufacturing Plant', 'Distribution Centre', 'Data Centre', 'Retail Outlet'];
const BOUNDARY_OPTIONS = ['Operational Control', 'Financial Control', 'Equity Share'];
const CURRENCY_OPTIONS = ['AED — UAE Dirham', 'SAR — Saudi Riyal', 'USD — US Dollar', 'EUR — Euro', 'GBP — British Pound'];

/** English stored values → i18n key suffix under dataInput.options */
const DI_COUNTRY_I18N = {
    'United Arab Emirates': 'uae',
    'Saudi Arabia': 'saudi',
    Qatar: 'qatar',
    Kuwait: 'kuwait',
    Bahrain: 'bahrain',
    Oman: 'oman',
};
const DI_FACILITY_I18N = {
    Office: 'office',
    Warehouse: 'warehouse',
    'Manufacturing Plant': 'manufacturingPlant',
    'Distribution Centre': 'distributionCentre',
    'Data Centre': 'dataCentre',
    'Retail Outlet': 'retailOutlet',
};
const DI_BOUNDARY_I18N = {
    'Operational Control': 'operationalControl',
    'Financial Control': 'financialControl',
    'Equity Share': 'equityShare',
};
const DI_CURRENCY_LINE_I18N = {
    'AED — UAE Dirham': 'aed',
    'SAR — Saudi Riyal': 'sar',
    'USD — US Dollar': 'usd',
    'EUR — Euro': 'eur',
    'GBP — British Pound': 'gbp',
};
const DI_FUEL_TYPE_I18N = {
    Diesel: 'diesel',
    'Gasoline/Petrol': 'gasolinePetrol',
    'Natural Gas': 'naturalGas',
    LPG: 'lpg',
    Biodiesel: 'biodiesel',
};
const DI_FUEL_UNIT_I18N = {
    Liters: 'liters',
    Gallons: 'gallons',
    kg: 'kg',
    'm³': 'm3',
};
const DI_GRID_REGION_I18N = {
    'Saudi Arabia - National': 'saNational',
    'Saudi Arabia - Eastern': 'saEastern',
    'Saudi Arabia - Western': 'saWestern',
    'Saudi Arabia - Central': 'saCentral',
};

function sitesStorageKey(orgKey) {
    return `${SITES_KEY_PREFIX}${orgKey}`;
}

function defaultSites() {
    const t = Date.now();
    return [
        {
            id: `site-${t}-a`,
            name: 'Dubai Warehouse',
            code: 'DXB-WH-01',
            country: 'United Arab Emirates',
            city: 'Dubai',
            facilityType: 'Warehouse',
            boundary: 'Operational Control',
            currency: 'AED — UAE Dirham',
            utilityProvider: 'DEWA',
        },
        {
            id: `site-${t}-b`,
            name: 'Riyadh Office',
            code: 'RUH-OFC-01',
            country: 'Saudi Arabia',
            city: 'Riyadh',
            facilityType: 'Office',
            boundary: 'Operational Control',
            currency: 'SAR — Saudi Riyal',
            utilityProvider: '',
        },
    ];
}

function loadSites(orgKey) {
    try {
        const raw = localStorage.getItem(sitesStorageKey(orgKey));
        if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
    } catch (_) { /* ignore */ }
    const seed = defaultSites();
    try {
        localStorage.setItem(sitesStorageKey(orgKey), JSON.stringify(seed));
    } catch (_) { /* ignore */ }
    return seed;
}

function saveSitesList(orgKey, list) {
    localStorage.setItem(sitesStorageKey(orgKey), JSON.stringify(list));
}

function countryChip(country) {
    const m = {
        'United Arab Emirates': 'UAE',
        'Saudi Arabia': 'KSA',
        Qatar: 'Qatar',
        Kuwait: 'Kuwait',
        Bahrain: 'Bahrain',
        Oman: 'Oman',
    };
    return m[country] || (country && String(country).slice(0, 4)) || '—';
}

function bumpSiteActivity(orgKey, siteId, periodKey, { docCount = 0, manualRows = 0 }) {
    if (!siteId || !periodKey) return;
    const key = `${ACTIVITY_KEY_PREFIX}${orgKey}`;
    let data = {};
    try {
        data = JSON.parse(localStorage.getItem(key) || '{}');
    } catch (_) {
        data = {};
    }
    if (!data[siteId]) data[siteId] = { periods: {}, lastUploadAt: null };
    if (!data[siteId].periods[periodKey]) data[siteId].periods[periodKey] = { docs: 0, manualRows: 0 };
    data[siteId].periods[periodKey].docs += docCount;
    data[siteId].periods[periodKey].manualRows += manualRows;
    if (docCount > 0 || manualRows > 0) data[siteId].lastUploadAt = new Date().toISOString();
    localStorage.setItem(key, JSON.stringify(data));
}

function readSiteActivity(orgKey) {
    try {
        return JSON.parse(localStorage.getItem(`${ACTIVITY_KEY_PREFIX}${orgKey}`) || '{}');
    } catch (_) {
        return {};
    }
}

function removeSiteActivity(orgKey, siteId) {
    if (!siteId) return;
    const key = `${ACTIVITY_KEY_PREFIX}${orgKey}`;
    let data = {};
    try {
        data = JSON.parse(localStorage.getItem(key) || '{}');
    } catch (_) {
        data = {};
    }
    if (data && typeof data === 'object' && siteId in data) {
        delete data[siteId];
        localStorage.setItem(key, JSON.stringify(data));
    }
}

const kgToTonnes = (kg) => (kg == null ? 0 : kg / 1000);

const FUEL_ACTIVITY_TYPES = ['diesel', 'petrol', 'gasoline', 'natural_gas', 'natural-gas', 'lpg', 'biodiesel'];
const isFuelActivity = (activityType) =>
    FUEL_ACTIVITY_TYPES.some(f => String(activityType || '').toLowerCase().trim().includes(f));

function DataInput() {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const { user } = useAuth();
    const orgKey = user?.organizationId != null ? String(user.organizationId) : user?.id != null ? String(user.id) : 'guest';
    const { addScope1Entry, addScope2Entry } = useDataStore();
    const [inputMethod, setInputMethod] = useState('upload');
    const [sites, setSites] = useState(() => loadSites(orgKey));
    const [selectedSiteId, setSelectedSiteId] = useState(() => {
        const list = loadSites(orgKey);
        return list[0]?.id ?? 'all';
    });
    const [reportingYear, setReportingYear] = useState(() => new Date().getFullYear());
    const [addSiteOpen, setAddSiteOpen] = useState(false);
    const [newSite, setNewSite] = useState({
        name: '',
        code: '',
        country: 'United Arab Emirates',
        city: '',
        facilityType: '',
        boundary: 'Operational Control',
        currency: 'AED — UAE Dirham',
        utilityProvider: '',
    });
    const [activityTick, setActivityTick] = useState(0);

    useEffect(() => {
        const list = loadSites(orgKey);
        setSites(list);
        if (selectedSiteId !== 'all' && !list.some((s) => s.id === selectedSiteId)) {
            setSelectedSiteId(list[0]?.id ?? 'all');
        }
    }, [orgKey]);

    const persistSites = useCallback(
        (next) => {
            saveSitesList(orgKey, next);
            setSites(next);
        },
        [orgKey]
    );

    const currentSite = useMemo(
        () => (selectedSiteId === 'all' ? null : sites.find((s) => s.id === selectedSiteId) ?? null),
        [sites, selectedSiteId]
    );

    const [notification, setNotification] = useState(null);
    
    // Scope 1 entries state
    const [scope1Entries, setScope1Entries] = useState([{
        id: 1,
        date: '',
        fuelType: 'Diesel',
        combustionType: 'mobile',
        amount: '',
        unit: 'Liters',
        vehicleId: '',
        costAmount: '',
        currency: 'USD'
    }]);
    
    // Scope 2 entries state
    const [scope2Entries, setScope2Entries] = useState([{
        id: 1,
        date: '',
        electricity: '',
        unit: 'kWh',
        supplier: '',
        gridRegion: 'Saudi Arabia - National',
        costAmount: '',
        currency: 'USD'
    }]);

    const fuelTypes = ['Diesel', 'Gasoline/Petrol', 'Natural Gas', 'LPG', 'Biodiesel'];
    const fuelUnits = ['Liters', 'Gallons', 'kg', 'm³'];
    const gridRegions = ['Saudi Arabia - National', 'Saudi Arabia - Eastern', 'Saudi Arabia - Western', 'Saudi Arabia - Central'];
    const currencies = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'SAR'];

    const dateLocale = i18n.language === 'ar' ? 'ar-SA' : 'en-US';
    const monthNamesLong = useMemo(
        () => Array.from({ length: 12 }, (_, i) =>
            new Date(2000, i, 1).toLocaleDateString(dateLocale, { month: 'long' })
        ),
        [dateLocale]
    );

    const formatLastUpload = useCallback((iso) => {
        if (!iso) return t('dataInput.emDash');
        const ts = new Date(iso).getTime();
        if (Number.isNaN(ts)) return t('dataInput.emDash');
        const diff = Date.now() - ts;
        if (diff < 60000) return t('dataInput.timeJustNow');
        if (diff < 3600000) return t('dataInput.timeMinAgo', { count: Math.floor(diff / 60000) });
        if (diff < 86400000) return t('dataInput.timeHoursAgo', { count: Math.floor(diff / 3600000) });
        if (diff < 604800000) return t('dataInput.timeDaysAgo', { count: Math.floor(diff / 86400000) });
        return new Date(iso).toLocaleDateString(dateLocale);
    }, [t, dateLocale]);

    const optLabel = useCallback((category, map, value) => {
        const k = map[value];
        return k ? t(`dataInput.options.${category}.${k}`) : value;
    }, [t]);

    const showNotification = (message, type = 'success') => {
        setNotification({ message, type });
        setTimeout(() => setNotification(null), 3000);
    };

    const kgToTonnes = (kg) => {
        if (kg == null || Number.isNaN(Number(kg))) return 0;
        return Number(kg) / 1000;
    };

    const normalizeDate = (d) => {
        if (!d) return '';
        if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
        const dt = new Date(d);
        if (Number.isNaN(dt.getTime())) return '';
        return dt.toISOString().slice(0, 10);
    };

    const addDemoEntryFromBackendEmission = (opts) => {
        const { emission, scope, siteId, siteName, date } = opts || {};
        const tonnes = kgToTonnes(emission?.co2e ?? emission?.co2eKg ?? emission?.kg ?? emission?.value);
        if (tonnes <= 0) return;

        const scopeUpper = String(scope || '').toUpperCase();
        if (
            scopeUpper.includes('SCOPE_2') ||
            scopeUpper.includes('SCOPE2') ||
            scopeUpper.includes('SCOPE-2') ||
            scopeUpper.includes('SCOPE 2') ||
            scopeUpper.includes('SCOPE2E')
        ) {
            addScope2Entry({
                date: normalizeDate(date),
                electricity: 0,
                unit: 'kWh',
                gridRegion: '',
                emissions: tonnes,
                siteId,
                siteName,
                currency: 'USD',
            });
            return;
        }

        // Default to Scope 1
        addScope1Entry({
            date: normalizeDate(date),
            fuelType: 'Diesel',
            combustionType: 'mobile',
            amount: 0,
            unit: 'Liters',
            emissions: tonnes,
            siteId,
            siteName,
            currency: 'USD',
        });
    };

    // Scope 1 handlers
    const addScope1Row = () => {
        setScope1Entries([...scope1Entries, {
            id: Date.now(),
            date: '',
            fuelType: 'Diesel',
            combustionType: 'mobile',
            amount: '',
            unit: 'Liters',
            vehicleId: '',
            costAmount: '',
            currency: 'USD'
        }]);
    };

    const removeScope1Row = (id) => {
        if (scope1Entries.length > 1) {
            setScope1Entries(scope1Entries.filter(entry => entry.id !== id));
        }
    };

    const updateScope1Entry = (id, field, value) => {
        setScope1Entries(scope1Entries.map(entry => 
            entry.id === id ? { ...entry, [field]: value } : entry
        ));
    };

    // Scope 2 handlers
    const addScope2Row = () => {
        setScope2Entries([...scope2Entries, {
            id: Date.now(),
            date: '',
            electricity: '',
            unit: 'kWh',
            supplier: '',
            gridRegion: 'Saudi Arabia - National',
            costAmount: '',
            currency: 'USD'
        }]);
    };

    const removeScope2Row = (id) => {
        if (scope2Entries.length > 1) {
            setScope2Entries(scope2Entries.filter(entry => entry.id !== id));
        }
    };

    const updateScope2Entry = (id, field, value) => {
        setScope2Entries(scope2Entries.map(entry => 
            entry.id === id ? { ...entry, [field]: value } : entry
        ));
    };

    // Map manual form values to emissions API (activityType, unit, category, region)
    const fuelTypeToActivity = (fuelType) => {
        const map = { 'Diesel': 'diesel', 'Gasoline/Petrol': 'gasoline', 'Natural Gas': 'natural_gas', 'LPG': 'lpg', 'Biodiesel': 'biodiesel' };
        return map[fuelType] || fuelType?.toLowerCase().replace(/\s+/g, '_') || 'diesel';
    };
    const fuelTypeToCategory = (fuelType) => (fuelType === 'Natural Gas' ? 'NATURAL_GAS' : 'FUEL_COMBUSTION');
    const manualUnitToApi = (unit) => {
        const map = { 'Liters': 'l', 'Gallons': 'gal', 'kg': 'kg', 'm³': 'm3' };
        return map[unit] || unit;
    };
    const gridRegionToRegion = (gridRegion) => {
        if (!gridRegion) return 'SA';
        const s = String(gridRegion).trim();
        if (s.startsWith('Saudi Arabia')) return 'SA';
        return s.replace(/\s*-\s*/g, '-').trim();
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (selectedSiteId === 'all' || !currentSite) {
            showNotification(t('dataInput.toast.selectSiteManual'), 'error');
            return;
        }

        const scope1Valid = scope1Entries.filter(entry => entry.date && entry.amount);
        const scope2Valid = scope2Entries.filter(entry => entry.date && entry.electricity);
        if (scope1Valid.length === 0 && scope2Valid.length === 0) {
            showNotification(t('dataInput.toast.addEntryWithData'), 'error');
            return;
        }

        const token = getAuthToken();
        if (!token) {
            showNotification(t('dataInput.toast.loginManualDemo'), 'error');
            return;
        }

        setSubmittingManual(true);
        try {
            const payloads = [];
            scope1Valid.forEach(entry => {
                payloads.push({
                    activityType: fuelTypeToActivity(entry.fuelType),
                    activityAmount: parseFloat(entry.amount),
                    activityUnit: manualUnitToApi(entry.unit),
                    scope: 'SCOPE_1',
                    category: fuelTypeToCategory(entry.fuelType),
                    region: 'AE',
                    siteId: selectedSiteId,
                    siteName: currentSite.name,
                    billingPeriodStart: entry.date ? new Date(entry.date + 'T00:00:00.000Z').toISOString() : undefined,
                });
            });
            scope2Valid.forEach(entry => {
                payloads.push({
                    activityType: 'electricity',
                    activityAmount: parseFloat(entry.electricity),
                    activityUnit: entry.unit === 'MWh' ? 'MWh' : 'kWh',
                    scope: 'SCOPE_2',
                    category: 'ELECTRICITY',
                    region: gridRegionToRegion(entry.gridRegion),
                    siteId: selectedSiteId,
                    siteName: currentSite.name,
                    billingPeriodStart: entry.date ? new Date(entry.date + 'T00:00:00.000Z').toISOString() : undefined,
                });
            });

            const results = await Promise.all(payloads.map(p => submitManualEmission(p)));
            const totalCo2e = results.reduce((sum, r) => sum + (r?.co2e ?? 0), 0);
            const count = results.length;

            const ymd = scope1Valid[0]?.date || scope2Valid[0]?.date;
            const actKey =
                ymd && ymd.length >= 7 ? `${ymd.slice(0, 4)}-${ymd.slice(5, 7)}` : periodKey;
            bumpSiteActivity(orgKey, selectedSiteId, actKey, { manualRows: count });
            setActivityTick((t) => t + 1);

            scope1Valid.forEach(entry => addScope1Entry({ ...entry, amount: parseFloat(entry.amount), siteId: selectedSiteId, siteName: currentSite.name }));
            scope2Valid.forEach(entry => addScope2Entry({ ...entry, electricity: parseFloat(entry.electricity), siteId: selectedSiteId, siteName: currentSite.name }));

        setScope1Entries([{
            id: 1,
            date: '',
            fuelType: 'Diesel',
            combustionType: 'mobile',
            amount: '',
            unit: 'Liters',
            vehicleId: '',
            costAmount: '',
            currency: 'USD'
        }]);
        setScope2Entries([{
            id: 1,
            date: '',
            electricity: '',
            unit: 'kWh',
            supplier: '',
                gridRegion: 'Saudi Arabia - National',
            costAmount: '',
            currency: 'USD'
        }]);

            showNotification(t('dataInput.toast.emissionsSaved', { count, total: totalCo2e.toFixed(1) }), 'success');
            navigate('/', { state: { fromSubmit: true, submitMessage: t('dataInput.navigateManualSaved', { count }), count } });
        } catch (err) {
            showNotification(err?.message || t('dataInput.toast.saveEmissionsFailed'), 'error');
        } finally {
            setSubmittingManual(false);
        }
    };

    const [uploadingReceipt, setUploadingReceipt] = useState(false);
    const [pendingVerifications, setPendingVerifications] = useState([]);
    const now = new Date();
    const [expectedDocMonth, setExpectedDocMonth] = useState(now.getMonth() + 1); // 1-12
    const [expectedDocYear, setExpectedDocYear] = useState(now.getFullYear());

    const periodKey = `${expectedDocYear}-${String(expectedDocMonth).padStart(2, '0')}`;
    const siteActivity = useMemo(() => {
        void activityTick;
        return readSiteActivity(orgKey);
    }, [orgKey, activityTick]);

    const summaryStats = useMemo(() => {
        if (!currentSite) return { docs: 0, manualRows: 0, lastUpload: null };
        const act = siteActivity[currentSite.id];
        const p = act?.periods?.[periodKey];
        return {
            docs: p?.docs ?? 0,
            manualRows: p?.manualRows ?? 0,
            lastUpload: act?.lastUploadAt ?? null,
        };
    }, [currentSite, siteActivity, periodKey]);
    const [submittingId, setSubmittingId] = useState(null);
    const [submittingBatchId, setSubmittingBatchId] = useState(null);
    const [submittingAll, setSubmittingAll] = useState(false);
    const [submittingManual, setSubmittingManual] = useState(false);
    const hasToken = Boolean(getAuthToken());
    const [diEmissions, setDiEmissions] = useState([]);
    const [diEmissionsLoading, setDiEmissionsLoading] = useState(false);
    const [diEmissionsError, setDiEmissionsError] = useState(null);
    const [diDeletingId, setDiDeletingId] = useState(null);
    const [diSelectedEmissionIds, setDiSelectedEmissionIds] = useState([]);
    const [diDeleteError, setDiDeleteError] = useState(null);
    const canManageSites = isAdministrator(user?.role);

    useEffect(() => {
        if (!hasToken || selectedSiteId === 'all' || !currentSite) {
            setDiEmissions([]);
            setDiEmissionsError(null);
            setDiEmissionsLoading(false);
            return;
        }
        let cancelled = false;
        setDiEmissionsLoading(true);
        setDiEmissionsError(null);
        const startStr = `${reportingYear}-01-01`;
        const endStr = `${reportingYear}-12-31`;
        getEmissions({ startDate: startStr, endDate: endStr, limit: '100' })
            .then(({ data }) => {
                if (cancelled) return;
                const list = data || [];
                const filtered = list.filter((e) => e.siteId == null || e.siteId === selectedSiteId);
                setDiEmissions(filtered);
            })
            .catch((err) => {
                if (!cancelled) setDiEmissionsError(err?.message || 'Failed to load submissions');
            })
            .finally(() => {
                if (!cancelled) setDiEmissionsLoading(false);
            });
        return () => { cancelled = true; };
    }, [hasToken, reportingYear, selectedSiteId, currentSite, activityTick]);

    const sortedDiEmissions = useMemo(() => {
        const list = [...diEmissions];
        list.sort((a, b) => {
            const da = new Date(a.billingPeriodStart || a.calculatedAt).getTime();
            const db = new Date(b.billingPeriodStart || b.calculatedAt).getTime();
            return db - da;
        });
        return list;
    }, [diEmissions]);

    const diRecentActivitiesRows = useMemo(
        () => sortedDiEmissions.slice(0, 5).map((e) => ({
            id: e.id,
            source: e.activityType,
            date: e.billingPeriodStart || e.calculatedAt,
            type: e.scope === 'SCOPE_1' ? 'scope1' : e.scope === 'SCOPE_2' ? 'scope2' : 'scope3',
            amount: kgToTonnes(e.co2e),
            dataSource: e.dataSource || t('dataInput.emDash'),
        })),
        [sortedDiEmissions, t]
    );

    const diReceiptRows = useMemo(
        () => sortedDiEmissions
            .filter((e) => Boolean(e.documentId || e.document?.id))
            .slice(0, 10)
            .map((e) => ({
                id: e.id,
                fileName: e.document?.fileName || t('dataInput.defaultReceiptName'),
                source: e.activityType,
                date: e.billingPeriodStart || e.calculatedAt,
                type: e.scope === 'SCOPE_1' ? 'scope1' : e.scope === 'SCOPE_2' ? 'scope2' : 'scope3',
                amount: kgToTonnes(e.co2e),
                dataSource: e.dataSource || t('dataInput.emDash'),
            })),
        [sortedDiEmissions, t]
    );

    const diFormatNumber = (num) => {
        if (num == null || Number.isNaN(num)) return '0';
        return Number(num).toLocaleString(dateLocale, { maximumFractionDigits: 2 });
    };

    const diFormatDate = (dateStr) => {
        if (!dateStr) return t('dataInput.emDash');
        const d = new Date(dateStr);
        if (Number.isNaN(d.getTime())) return t('dataInput.emDash');
        return d.toLocaleDateString(dateLocale, {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        });
    };

    const handleDiDeleteEmission = async (emissionId) => {
        if (!emissionId || !hasToken) return;
        setDiDeleteError(null);
        setDiDeletingId(emissionId);
        try {
            await deleteEmission(emissionId);
            setDiSelectedEmissionIds((prev) => prev.filter((id) => id !== emissionId));
            setActivityTick((t) => t + 1);
        } catch (err) {
            setDiDeleteError(err?.message || t('dashboard.failedToDelete'));
        } finally {
            setDiDeletingId(null);
        }
    };

    const toggleDiEmissionSelected = (emissionId) => {
        setDiSelectedEmissionIds((prev) =>
            prev.includes(emissionId) ? prev.filter((id) => id !== emissionId) : [...prev, emissionId]
        );
    };

    const handleDiBulkDelete = async () => {
        if (!hasToken || !diSelectedEmissionIds.length) return;
        setDiDeleteError(null);
        setDiDeletingId('bulk');
        try {
            await deleteEmissionsBulk(diSelectedEmissionIds);
            setDiSelectedEmissionIds([]);
            setActivityTick((t) => t + 1);
        } catch (err) {
            setDiDeleteError(err?.message || t('dashboard.failedToDeleteBulk'));
        } finally {
            setDiDeletingId(null);
        }
    };

    const dateFromExtraction = (fields) =>
        fields?.billingPeriodStart || fields?.documentDate || fields?.billingPeriodEnd || '';

    /** True if extracted date (ISO or YYYY-MM-DD) is in the same month/year as expected */
    const extractedDateMatchesExpected = (extractedDateStr, expectedYear, expectedMonth) => {
        if (!extractedDateStr || !expectedYear || !expectedMonth) return true;
        const d = new Date(extractedDateStr);
        if (Number.isNaN(d.getTime())) return true;
        return d.getFullYear() === expectedYear && (d.getMonth() + 1) === expectedMonth;
    };

    const getExpectedDateString = () =>
        `${expectedDocYear}-${String(expectedDocMonth).padStart(2, '0')}-01`;

    const buildPendingItem = (documentId, fileName, fields, expectedDate, siteMeta) => {
        const extracted = dateFromExtraction(fields);
        const expectedYear = expectedDate ? parseInt(expectedDate.slice(0, 4), 10) : null;
        const expectedMonth = expectedDate ? parseInt(expectedDate.slice(5, 7), 10) : null;
        const dateMismatch = Boolean(extracted && expectedYear && expectedMonth && !extractedDateMatchesExpected(extracted, expectedYear, expectedMonth));
        return {
            documentId,
            fileName,
            product: fields?.product ?? '',
            supplier: fields?.supplier ?? fields?.provider ?? '',
            date: extracted || expectedDate || '',
            activityType: fields?.activityType ?? '',
            activityAmount: fields?.activityAmount ?? '',
            activityUnit: fields?.activityUnit ?? '',
            region: fields?.region ?? 'AE',
            scope: fields?.scope ?? '',
            category: fields?.category ?? '',
            billingPeriodStart: fields?.billingPeriodStart ?? '',
            billingPeriodEnd: fields?.billingPeriodEnd ?? '',
            dateMismatch,
            siteId: siteMeta?.siteId,
            siteName: siteMeta?.siteName,
        };
    };

    const handleFileUpload = async (e) => {
        const fileList = e.target.files;
        if (!fileList?.length) return;

        if (selectedSiteId === 'all' || !currentSite) {
            showNotification(t('dataInput.toast.selectSiteUpload'), 'error');
            e.target.value = '';
            return;
        }
        const siteMeta = { siteId: selectedSiteId, siteName: currentSite.name };

        const token = getAuthToken();
        if (!token) {
            showNotification(t('dataInput.toast.loginUploadDemo'), 'error');
            e.target.value = '';
            return;
        }

        const files = Array.from(fileList);

        if (files.length > MAX_FILES_COUNT) {
            showNotification(t('dataInput.toast.maxFiles', { max: MAX_FILES_COUNT }), 'error');
            e.target.value = '';
            return;
        }

        const oversized = files.filter(f => f.size > MAX_FILE_SIZE_BYTES);
        if (oversized.length) {
            const names = oversized.map(f => `"${f.name}" (${(f.size / 1024 / 1024).toFixed(1)} MB)`).join(', ');
            showNotification(t('dataInput.toast.fileTooLarge', { maxMb: MAX_FILE_SIZE_MB, names }), 'error');
            e.target.value = '';
            return;
        }

        setUploadingReceipt(true);

        try {
            if (files.length === 1) {
                showNotification(t('dataInput.toast.uploadingSingle', { file: files[0].name }), 'info');
                const result = await uploadReceiptAndExtract(files[0]);
                const fileName = result?.fileName || files[0].name;
                const docId = result?.documentId;
                const expectedDate = getExpectedDateString();
                if (result?.multiple && Array.isArray(result?.extractedFields)) {
                    const newItems = result.extractedFields.map((fields) => buildPendingItem(docId, fileName, fields, expectedDate, siteMeta));
                    setPendingVerifications(prev => [...prev, ...newItems]);
                    if (newItems.some((i) => i.dateMismatch)) {
                        showNotification(t('dataInput.toast.dateMismatchSingle', { month: monthNamesLong[expectedDocMonth - 1], year: expectedDocYear }), 'warning');
                    } else {
                        showNotification(t('dataInput.toast.entriesExtractedSubmitAll', { count: newItems.length }), 'success');
                    }
                } else {
                    const fields = result?.extractedFields || {};
                    const item = buildPendingItem(docId, fileName, fields, expectedDate, siteMeta);
                    setPendingVerifications(prev => [...prev, item]);
                    if (item.dateMismatch) {
                        showNotification(t('dataInput.toast.dateMismatchSingle', { month: monthNamesLong[expectedDocMonth - 1], year: expectedDocYear }), 'warning');
                    } else {
                        showNotification(t('dataInput.toast.verifyNumbersSubmit'), 'success');
                    }
                }
            } else {
                showNotification(t('dataInput.toast.uploadingMany', { count: files.length }), 'info');
                const documents = await uploadReceiptsMultiple(files);
                let totalEntries = 0;
                let hasDateMismatch = false;
                const expectedDate = getExpectedDateString();
                for (let i = 0; i < documents.length; i++) {
                    showNotification(t('dataInput.toast.extracting', { current: i + 1, total: documents.length, fileName: documents[i].fileName }), 'info');
                    const result = await processDocument(documents[i].id, documents[i].fileName);
                    const fileName = result?.fileName || documents[i].fileName;
                    const docId = result?.documentId;
                    if (result?.multiple && Array.isArray(result?.extractedFields)) {
                        const newItems = result.extractedFields.map((fields) => buildPendingItem(docId, fileName, fields, expectedDate, siteMeta));
                        if (newItems.some((it) => it.dateMismatch)) hasDateMismatch = true;
                        setPendingVerifications(prev => [...prev, ...newItems]);
                        totalEntries += newItems.length;
                    } else {
                        const fields = result?.extractedFields || {};
                        const item = buildPendingItem(docId, fileName, fields, expectedDate, siteMeta);
                        if (item.dateMismatch) hasDateMismatch = true;
                        setPendingVerifications(prev => [...prev, item]);
                        totalEntries += 1;
                    }
                }
                if (hasDateMismatch) {
                    showNotification(t('dataInput.toast.dateMismatchBatch', { month: monthNamesLong[expectedDocMonth - 1], year: expectedDocYear }), 'warning');
                } else {
                    showNotification(
                        totalEntries > documents.length
                            ? t('dataInput.toast.entriesExtractedMany', { totalEntries })
                            : t('dataInput.toast.receiptsExtractedMany', { count: documents.length }),
                        'success'
                    );
                }
            }
        } catch (err) {
            const msg = err?.message || t('dataInput.toast.uploadFailed');
            showNotification(msg.includes('401') ? t('dataInput.toast.sessionExpired') : msg, 'error');
        } finally {
            setUploadingReceipt(false);
            e.target.value = '';
        }
    };

    const updatePendingField = (index, field, value) => {
        setPendingVerifications(prev =>
            prev.map((item, i) => {
                if (i !== index) return item;
                const next = { ...item, [field]: value };
                if (field === 'date' && value) {
                    next.dateMismatch = !extractedDateMatchesExpected(value, expectedDocYear, expectedDocMonth);
                }
                return next;
            })
        );
    };

    const handleSubmitVerification = async (index) => {
        const item = pendingVerifications[index];
        if (!item?.documentId) return;
        const amount = Number(item.activityAmount);
        if (!item.activityType || Number.isNaN(amount) || !item.activityUnit) {
            showNotification(t('dataInput.toast.fillActivityFields'), 'error');
            return;
        }

        setSubmittingId(item.documentId);
        try {
            const dateToSend = item.date || item.billingPeriodStart || undefined;
            const result = await submitReceiptExtraction(item.documentId, {
                activityType: item.activityType,
                activityAmount: amount,
                activityUnit: item.activityUnit,
                region: item.region || 'AE',
                scope: item.scope || undefined,
                category: item.category || undefined,
                siteId: item.siteId ?? undefined,
                siteName: item.siteName ?? undefined,
                billingPeriodStart: dateToSend || undefined,
                billingPeriodEnd: item.billingPeriodEnd || undefined,
                documentDate: dateToSend || undefined,
            });

            // Keep local demo data in sync for dashboard filtering if the token expires later.
            addDemoEntryFromBackendEmission({
                emission: result?.emission,
                scope: item.scope,
                siteId: item.siteId,
                siteName: item.siteName,
                date: item.billingPeriodStart || item.date || undefined,
            });

            showNotification(t('dataInput.toast.savedCo2eNavigate', { amount: result?.emission?.co2e?.toFixed(2) ?? t('dataInput.emDash') }), 'success');
            const pk = `${expectedDocYear}-${String(expectedDocMonth).padStart(2, '0')}`;
            if (item.siteId) {
                bumpSiteActivity(orgKey, item.siteId, pk, { docCount: 1 });
                setActivityTick((x) => x + 1);
            }
            setPendingVerifications(prev => prev.filter((_, i) => i !== index));
            navigate('/', { state: { fromSubmit: true, submitMessage: t('dataInput.navigateSingleEmission', { amount: result?.emission?.co2e?.toFixed(2) ?? t('dataInput.emDash') }), count: 1 } });
        } catch (err) {
            showNotification(err?.message || t('dataInput.toast.submitFailed'), 'error');
        } finally {
            setSubmittingId(null);
        }
    };

    const handleSubmitBatch = async (documentId) => {
        const indices = pendingVerifications
            .map((item, i) => ({ item, i }))
            .filter(({ item }) => item.documentId === documentId);
        if (indices.length === 0) return;
        const entries = indices.map(({ item }) => ({
            activityType: item.activityType,
            activityAmount: Number(item.activityAmount),
            activityUnit: item.activityUnit,
            region: item.region || 'AE',
            scope: item.scope || undefined,
            category: item.category || undefined,
            siteId: item.siteId ?? undefined,
            siteName: item.siteName ?? undefined,
            documentDate: item.date || item.billingPeriodStart || undefined,
            billingPeriodStart: item.billingPeriodStart || undefined,
            billingPeriodEnd: item.billingPeriodEnd || undefined,
        }));
        const invalid = entries.find(e => !e.activityType || Number.isNaN(e.activityAmount) || !e.activityUnit);
        if (invalid) {
            showNotification(t('dataInput.toast.fillAllEntriesBatch'), 'error');
            return;
        }
        setSubmittingBatchId(documentId);
        try {
            const result = await submitReceiptBatch(documentId, entries);
            const count = result?.emissions?.length ?? entries.length;
            const skipped = result?.skipped?.length ?? 0;
            const msg = skipped > 0
                ? t('dataInput.toast.batchSavedSkipped', { count, skipped })
                : t('dataInput.toast.batchSaved', { count });
            showNotification(msg, 'success');

            // Keep demo/local data in sync for dashboard filtering if the token expires later.
            const emissionsList = Array.isArray(result?.emissions) ? result.emissions : [];
            if (skipped === 0 && emissionsList.length === entries.length) {
                emissionsList.forEach((emission, i) => {
                    addDemoEntryFromBackendEmission({
                        emission,
                        scope: emission?.scope ?? entries[i]?.scope,
                        siteId: entries[i]?.siteId,
                        siteName: entries[i]?.siteName,
                        date: entries[i]?.billingPeriodStart || entries[i]?.documentDate || entries[i]?.date || undefined,
                    });
                });
            }

            const pk = `${expectedDocYear}-${String(expectedDocMonth).padStart(2, '0')}`;
            const sid = indices[0]?.item?.siteId;
            if (sid) {
                bumpSiteActivity(orgKey, sid, pk, { docCount: count });
                setActivityTick((x) => x + 1);
            }
            const removeIndices = new Set(indices.map(({ i }) => i));
            setPendingVerifications(prev => prev.filter((_, i) => !removeIndices.has(i)));
            navigate('/', { state: { fromSubmit: true, submitMessage: t('dataInput.navigateEmissionsSaved', { count }), count } });
        } catch (err) {
            showNotification(err?.message || t('dataInput.toast.batchSubmitFailed'), 'error');
        } finally {
            setSubmittingBatchId(null);
        }
    };

    const clearPendingVerification = (index) => {
        setPendingVerifications(prev => prev.filter((_, i) => i !== index));
    };

    /**
     * Submit all pending receipts (all documents) at once.
     * Groups by documentId and calls submit (single) or submit-batch (multi) per document in parallel.
     */
    const handleSubmitAll = async () => {
        const scoped = pendingVerifications
            .map((item, i) => ({ item, i }))
            .filter(({ item }) => item.siteId === selectedSiteId);
        if (scoped.length === 0) return;

        const docIdsSeen = new Set();
        const groups = [];
        scoped.forEach(({ item, i }) => {
            if (docIdsSeen.has(item.documentId)) return;
            docIdsSeen.add(item.documentId);
            const indices = scoped.filter((x) => x.item.documentId === item.documentId).map((x) => x.i);
            groups.push({ documentId: item.documentId, indices });
        });

        const invalid = scoped.find(
            ({ item: p }) => !p.activityType || Number.isNaN(Number(p.activityAmount)) || !p.activityUnit
        );
        if (invalid) {
            showNotification(t('dataInput.toast.fillAllBeforeSubmitAll'), 'error');
            return;
        }

        setSubmittingAll(true);
        try {
            const promises = groups.map((group) => {
                const entries = group.indices.map((i) => {
                    const item = pendingVerifications[i];
                    const amount = Number(item.activityAmount);
                    const dateToSend = item.date || item.billingPeriodStart || undefined;
                    return {
                        activityType: item.activityType,
                        activityAmount: amount,
                        activityUnit: item.activityUnit,
                        region: item.region || 'AE',
                        scope: item.scope || undefined,
                        category: item.category || undefined,
                        siteId: item.siteId ?? undefined,
                        siteName: item.siteName ?? undefined,
                        documentDate: dateToSend || undefined,
                        billingPeriodStart: item.billingPeriodStart || undefined,
                        billingPeriodEnd: item.billingPeriodEnd || undefined,
                    };
                });
                if (entries.length === 1) {
                    return submitReceiptExtraction(group.documentId, {
                        activityType: entries[0].activityType,
                        activityAmount: entries[0].activityAmount,
                        activityUnit: entries[0].activityUnit,
                        region: entries[0].region,
                        scope: entries[0].scope,
                        category: entries[0].category,
                        siteId: entries[0].siteId,
                        siteName: entries[0].siteName,
                        billingPeriodStart: entries[0].billingPeriodStart,
                        billingPeriodEnd: entries[0].billingPeriodEnd,
                        documentDate: entries[0].documentDate,
                    }).then((result) => ({
                        count: 1,
                        emissions: result?.emission ? [result.emission] : [],
                        entries,
                        skipped: 0,
                    }));
                }
                return submitReceiptBatch(group.documentId, entries).then((result) => ({
                    count: result?.emissions?.length ?? entries.length,
                    emissions: result?.emissions ?? [],
                    entries,
                    skipped: result?.skipped?.length ?? 0,
                }));
            });

            const results = await Promise.all(promises);
            const totalCount = results.reduce((sum, r) => sum + r.count, 0);
            const pk = `${expectedDocYear}-${String(expectedDocMonth).padStart(2, '0')}`;

            // Keep demo/local data in sync for dashboard filtering if the token expires later.
            results.forEach((r) => {
                const emissionsList = Array.isArray(r?.emissions) ? r.emissions : [];
                const usedEntries = Array.isArray(r?.entries) ? r.entries : [];
                const skipped = Number(r?.skipped ?? 0);

                if (skipped !== 0) return;
                if (!emissionsList.length || emissionsList.length !== usedEntries.length) return;

                emissionsList.forEach((emission, i) => {
                    addDemoEntryFromBackendEmission({
                        emission,
                        scope: emission?.scope ?? usedEntries[i]?.scope,
                        siteId: usedEntries[i]?.siteId,
                        siteName: usedEntries[i]?.siteName,
                        date: usedEntries[i]?.billingPeriodStart || usedEntries[i]?.documentDate || usedEntries[i]?.date || undefined,
                    });
                });
            });

            groups.forEach((group, gi) => {
                const item = pendingVerifications[group.indices[0]];
                const sid = item?.siteId;
                const c = results[gi]?.count ?? 0;
                if (sid && c > 0) {
                    bumpSiteActivity(orgKey, sid, pk, { docCount: c });
                }
            });
            setActivityTick((x) => x + 1);
            showNotification(t('dataInput.toast.submitAllSaved', { totalCount }), 'success');
            const removeSet = new Set(groups.flatMap((g) => g.indices));
            setPendingVerifications((prev) => prev.filter((_, idx) => !removeSet.has(idx)));
            navigate('/', { state: { fromSubmit: true, submitMessage: t('dataInput.navigateEmissionsSaved', { count: totalCount }), count: totalCount } });
        } catch (err) {
            showNotification(err?.message || t('dataInput.toast.submitAllFailed'), 'error');
        } finally {
            setSubmittingAll(false);
        }
    };

    const handleSaveNewSite = () => {
        if (!newSite.name.trim() || !newSite.code.trim() || !newSite.city.trim() || !newSite.facilityType) {
            showNotification(t('dataInput.toast.fillSiteFields'), 'error');
            return;
        }
        const id = `site-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
        const row = { id, ...newSite, name: newSite.name.trim(), code: newSite.code.trim(), city: newSite.city.trim() };
        persistSites([...sites, row]);
        setSelectedSiteId(id);
        setAddSiteOpen(false);
        setNewSite({
            name: '',
            code: '',
            country: 'United Arab Emirates',
            city: '',
            facilityType: '',
            boundary: 'Operational Control',
            currency: 'AED — UAE Dirham',
            utilityProvider: '',
        });
        showNotification(t('dataInput.toast.siteAdded', { name: row.name }), 'success');
    };

    const handleDeleteSelectedSite = () => {
        if (!canManageSites) {
            showNotification(t('dataInput.toast.adminDeleteOnly'), 'error');
            return;
        }
        if (!selectedSiteId || selectedSiteId === 'all' || !currentSite) {
            showNotification(t('dataInput.toast.selectSiteDelete'), 'warning');
            return;
        }
        if (sites.length <= 1) {
            showNotification(t('dataInput.toast.oneSiteMinimum'), 'warning');
            return;
        }
        const hasPendingForSite = pendingVerifications.some((p) => p.siteId === selectedSiteId);
        if (hasPendingForSite) {
            showNotification(t('dataInput.toast.pendingBeforeDelete'), 'warning');
            return;
        }
        const ok = window.confirm(t('dataInput.confirmDeleteSite', { name: currentSite.name }));
        if (!ok) return;

        const nextSites = sites.filter((s) => s.id !== selectedSiteId);
        persistSites(nextSites);
        removeSiteActivity(orgKey, selectedSiteId);
        setActivityTick((t) => t + 1);
        setSelectedSiteId(nextSites[0]?.id ?? 'all');
        showNotification(t('dataInput.toast.siteDeleted', { name: currentSite.name }), 'success');
    };

    useEffect(() => {
        const onKey = (e) => {
            if (e.key === 'Escape') setAddSiteOpen(false);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);

    const siteNameDisplay = currentSite?.name ?? t('dataInput.defaultSiteName');

    return (
        <div className="data-input-content">
            {/* Notification */}
            {notification && (
                <div className={`notification ${notification.type}`}>
                    <i className={`fas fa-${notification.type === 'success' ? 'check-circle' : notification.type === 'error' ? 'exclamation-circle' : notification.type === 'warning' ? 'exclamation-triangle' : 'info-circle'}`}></i>
                    <span>{notification.message}</span>
                </div>
            )}

            <div className="page-header di-page-header">
                <h1>{t('dataInput.title')}</h1>
                <p>{t('dataInput.subtitle')}</p>
            </div>

            <div className="di-site-context-card">
                <div className="di-site-context-top">
                    <div className="di-site-selector-group">
                        <span className="di-field-label">{t('dataInput.selectedSite')}</span>
                        <div className="di-site-select-wrap">
                            <i className="fas fa-map-marker-alt di-site-select-icon" aria-hidden />
                            <select
                                className="di-site-dropdown"
                                value={selectedSiteId}
                                onChange={(e) => setSelectedSiteId(e.target.value)}
                            >
                                <option value="all">{t('dataInput.allSites')}</option>
                                {sites.map((s) => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    {currentSite && (
                        <div className="di-site-meta-chips">
                            <span className="di-chip"><i className="fas fa-globe" /> {countryChip(currentSite.country)}</span>
                            <span className="di-chip"><i className="fas fa-industry" /> {optLabel('facility', DI_FACILITY_I18N, currentSite.facilityType)}</span>
                            <span className="di-chip"><i className="fas fa-border-all" /> {currentSite.boundary ? optLabel('boundary', DI_BOUNDARY_I18N, currentSite.boundary) : t('dataInput.emDash')}</span>
                        </div>
                    )}
                    <div className="di-year-selector-group">
                        <span className="di-field-label">{t('dataInput.reportingYear')}</span>
                        <select className="di-year-dropdown" value={reportingYear} onChange={(e) => setReportingYear(Number(e.target.value))}>
                            {Array.from({ length: 12 }, (_, i) => new Date().getFullYear() - 5 + i).map((y) => (
                                <option key={y} value={y}>{y}</option>
                            ))}
                        </select>
                    </div>
                    <div className="di-site-actions">
                        <button type="button" className="di-add-site-btn" onClick={() => setAddSiteOpen(true)}>
                            <i className="fas fa-plus" /> {t('dataInput.addSite')}
                        </button>
                        {canManageSites && (
                            <button
                                type="button"
                                className="di-delete-site-btn"
                                onClick={handleDeleteSelectedSite}
                                disabled={selectedSiteId === 'all' || !currentSite || sites.length <= 1}
                                title={selectedSiteId === 'all' ? t('dataInput.deleteSiteTitleSelect') : t('dataInput.deleteSiteTitle')}
                            >
                                <i className="fas fa-trash-alt" /> {t('dataInput.deleteSite')}
                            </button>
                        )}
                    </div>
                </div>
                <div className="di-site-pills-bar">
                    <button type="button" className={`di-site-pill${selectedSiteId === 'all' ? ' active' : ''}`} onClick={() => setSelectedSiteId('all')}>{t('dataInput.allSites')}</button>
                    {sites.map((s) => (
                        <button key={s.id} type="button" className={`di-site-pill${selectedSiteId === s.id ? ' active' : ''}`} onClick={() => setSelectedSiteId(s.id)}>
                            <span className="di-pill-dot" /> {s.name}
                        </button>
                    ))}
                    <button type="button" className="di-pill-add-btn" onClick={() => setAddSiteOpen(true)}>
                        <i className="fas fa-plus" /> {t('dataInput.addSite')}
                    </button>
                </div>
            </div>

            <div className={`di-all-sites-banner${selectedSiteId === 'all' ? ' di-visible' : ''}`}>
                <i className="fas fa-exclamation-triangle" />
                <div className="di-all-sites-banner-text">
                    <strong>{t('dataInput.noSiteBannerTitle')}</strong>
                    <span>{t('dataInput.noSiteBannerBody')}</span>
                </div>
            </div>

            {selectedSiteId !== 'all' && currentSite && (
            <>
            <div className="di-method-row">
                <button type="button" className={`di-method-card${inputMethod === 'upload' ? ' active' : ''}`} onClick={() => setInputMethod('upload')}>
                    <div className="di-method-icon"><i className="fas fa-cloud-upload-alt" /></div>
                    <div className="di-method-text">
                        <h3>{t('dataInput.uploadMethodTitle')}</h3>
                        <p>{t('dataInput.uploadMethodDesc')}</p>
                        <span className="di-site-context-label">{t('dataInput.uploadMethodContext', { site: siteNameDisplay })}</span>
                    </div>
                </button>
                <button type="button" className={`di-method-card${inputMethod === 'manual' ? ' active' : ''}`} onClick={() => setInputMethod('manual')}>
                    <div className="di-method-icon"><i className="fas fa-table" /></div>
                    <div className="di-method-text">
                        <h3>{t('dataInput.manualMethodTitle')}</h3>
                        <p>{t('dataInput.manualMethodDesc')}</p>
                        <span className="di-site-context-label">{t('dataInput.manualMethodContext', { site: siteNameDisplay })}</span>
                    </div>
                </button>
            </div>

            <div className="di-upload-layout">
            <div className="di-upload-main">
            {inputMethod === 'manual' ? (
                <form className="di-manual-panel card data-section" onSubmit={handleSubmit} style={{ marginBottom: 0 }}>
                    <h4 className="di-manual-title">{t('dataInput.manualPanelTitle', { site: siteNameDisplay })}</h4>
                    <p className="di-manual-intro">{t('dataInput.manualPanelIntro')}</p>
                    {/* Scope 1 Section */}
                    <div className="card data-section">
                        <div className="section-header">
                            <div className="section-title">
                                <span className="scope-badge scope1">{t('dataInput.scope1Badge')}</span>
                                <h2>{t('dataInput.directEmissions')}</h2>
                            </div>
                            <button type="button" className="btn btn-add" onClick={addScope1Row}>
                                <i className="fas fa-plus"></i>
                                {t('dataInput.addEntry')}
                            </button>
                        </div>

                        <div className="entries-container">
                            {scope1Entries.map((entry, index) => (
                                <div key={entry.id} className="entry-card">
                                    <div className="entry-header">
                                        <span className="entry-number">{t('dataInput.entryNumber', { n: index + 1 })}</span>
                                        {scope1Entries.length > 1 && (
                                            <button 
                                                type="button" 
                                                className="btn-remove"
                                                onClick={() => removeScope1Row(entry.id)}
                                            >
                                                <i className="fas fa-times"></i>
                                            </button>
                                        )}
                                    </div>
                                    <div className="entry-grid">
                                        <div className="form-group">
                                            <label>{t('dataInput.date')}</label>
                                            <input
                                                type="date"
                                                value={entry.date}
                                                onChange={(e) => updateScope1Entry(entry.id, 'date', e.target.value)}
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label>{t('dataInput.combustionType')}</label>
                                            <select
                                                value={entry.combustionType}
                                                onChange={(e) => updateScope1Entry(entry.id, 'combustionType', e.target.value)}
                                            >
                                                <option value="mobile">{t('dataInput.combustionMobile')}</option>
                                                <option value="stationary">{t('dataInput.combustionStationary')}</option>
                                            </select>
                                        </div>
                                        <div className="form-group">
                                            <label>{t('dataInput.fuelType')}</label>
                                            <select
                                                value={entry.fuelType}
                                                onChange={(e) => updateScope1Entry(entry.id, 'fuelType', e.target.value)}
                                            >
                                                {fuelTypes.map(fuel => (
                                                    <option key={fuel} value={fuel}>{optLabel('fuelType', DI_FUEL_TYPE_I18N, fuel)}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="form-group">
                                            <label>{t('dataInput.amount')}</label>
                                            <input
                                                type="number"
                                                placeholder={t('dataInput.placeholderZero')}
                                                value={entry.amount}
                                                onChange={(e) => updateScope1Entry(entry.id, 'amount', e.target.value)}
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label>{t('dataInput.unit')}</label>
                                            <select
                                                value={entry.unit}
                                                onChange={(e) => updateScope1Entry(entry.id, 'unit', e.target.value)}
                                            >
                                                {fuelUnits.map(unit => (
                                                    <option key={unit} value={unit}>{optLabel('fuelUnit', DI_FUEL_UNIT_I18N, unit)}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="form-group">
                                            <label>{t('dataInput.vehicleIdOptional')}</label>
                                            <input
                                                type="text"
                                                placeholder={t('dataInput.placeholderVehicle')}
                                                value={entry.vehicleId}
                                                onChange={(e) => updateScope1Entry(entry.id, 'vehicleId', e.target.value)}
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label>{t('dataInput.costAmount')}</label>
                                            <input
                                                type="number"
                                                placeholder={t('dataInput.placeholderZero')}
                                                value={entry.costAmount}
                                                onChange={(e) => updateScope1Entry(entry.id, 'costAmount', e.target.value)}
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label>{t('dataInput.currency')}</label>
                                            <select
                                                value={entry.currency}
                                                onChange={(e) => updateScope1Entry(entry.id, 'currency', e.target.value)}
                                            >
                                                {currencies.map(curr => (
                                                    <option key={curr} value={curr}>{curr}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Scope 2 Section */}
                    <div className="card data-section">
                        <div className="section-header">
                            <div className="section-title">
                                <span className="scope-badge scope2">{t('dataInput.scope2Badge')}</span>
                                <h2>{t('dataInput.indirectEmissions')}</h2>
                            </div>
                            <button type="button" className="btn btn-add" onClick={addScope2Row}>
                                <i className="fas fa-plus"></i>
                                {t('dataInput.addEntry')}
                            </button>
                        </div>

                        <div className="entries-container">
                            {scope2Entries.map((entry, index) => (
                                <div key={entry.id} className="entry-card">
                                    <div className="entry-header">
                                        <span className="entry-number">{t('dataInput.entryNumber', { n: index + 1 })}</span>
                                        {scope2Entries.length > 1 && (
                                            <button 
                                                type="button" 
                                                className="btn-remove"
                                                onClick={() => removeScope2Row(entry.id)}
                                            >
                                                <i className="fas fa-times"></i>
                                            </button>
                                        )}
                                    </div>
                                    <div className="entry-grid">
                                        <div className="form-group">
                                            <label>{t('dataInput.date')}</label>
                                            <input
                                                type="date"
                                                value={entry.date}
                                                onChange={(e) => updateScope2Entry(entry.id, 'date', e.target.value)}
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label>{t('dataInput.electricityConsumption')}</label>
                                            <input
                                                type="number"
                                                placeholder={t('dataInput.placeholderZero')}
                                                value={entry.electricity}
                                                onChange={(e) => updateScope2Entry(entry.id, 'electricity', e.target.value)}
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label>{t('dataInput.unit')}</label>
                                            <select
                                                value={entry.unit}
                                                onChange={(e) => updateScope2Entry(entry.id, 'unit', e.target.value)}
                                            >
                                                <option value="kWh">kWh</option>
                                                <option value="MWh">MWh</option>
                                            </select>
                                        </div>
                                        <div className="form-group">
                                            <label>{t('dataInput.gridRegion')}</label>
                                            <select
                                                value={entry.gridRegion}
                                                onChange={(e) => updateScope2Entry(entry.id, 'gridRegion', e.target.value)}
                                            >
                                                {gridRegions.map(region => (
                                                    <option key={region} value={region}>{optLabel('gridRegion', DI_GRID_REGION_I18N, region)}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="form-group">
                                            <label>{t('dataInput.supplier')}</label>
                                            <input
                                                type="text"
                                                placeholder={t('dataInput.placeholderSupplier')}
                                                value={entry.supplier}
                                                onChange={(e) => updateScope2Entry(entry.id, 'supplier', e.target.value)}
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label>{t('dataInput.costAmount')}</label>
                                            <input
                                                type="number"
                                                placeholder={t('dataInput.placeholderZero')}
                                                value={entry.costAmount}
                                                onChange={(e) => updateScope2Entry(entry.id, 'costAmount', e.target.value)}
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label>{t('dataInput.currency')}</label>
                                            <select
                                                value={entry.currency}
                                                onChange={(e) => updateScope2Entry(entry.id, 'currency', e.target.value)}
                                            >
                                                {currencies.map(curr => (
                                                    <option key={curr} value={curr}>{curr}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Submit Button */}
                    <div className="submit-section">
                        <button type="submit" className="btn btn-primary btn-submit" disabled={submittingManual}>
                            {submittingManual ? <><i className="fas fa-spinner fa-spin"></i> {t('dataInput.saving')}</> : <><i className="fas fa-check"></i> {t('dataInput.submitData')}</>}
                        </button>
                        <p className="help-text" style={{ marginTop: '0.5rem' }}>{t('dataInput.submitHelp')}</p>
                    </div>
                </form>
            ) : (
                <div className="card upload-section">
                    <div className="expected-doc-date">
                        <div className="expected-doc-date-header">
                            <i className="fas fa-calendar-alt"></i>
                            <span>{t('dataInput.expectedDocDate')}</span>
                        </div>
                        <p className="expected-doc-date-hint">{t('dataInput.expectedDocHint')}</p>
                        <div className="expected-doc-date-fields">
                            <div className="form-group">
                                <label>{t('dataInput.month')}</label>
                                <select
                                    value={expectedDocMonth}
                                    onChange={(e) => setExpectedDocMonth(Number(e.target.value))}
                                >
                                    {monthNamesLong.map((m, i) => (
                                        <option key={i} value={i + 1}>{m}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group">
                                <label>{t('dataInput.year')}</label>
                                <select
                                    value={expectedDocYear}
                                    onChange={(e) => setExpectedDocYear(Number(e.target.value))}
                                >
                                    {Array.from({ length: 15 }, (_, i) => new Date().getFullYear() - 5 + i).map((y) => (
                                        <option key={y} value={y}>{y}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className="di-uploading-for-badge">
                            <i className="fas fa-map-marker-alt" /> {t('dataInput.uploadingFor')} <strong>{siteNameDisplay}</strong>
                        </div>
                    </div>
                    <div className={`upload-area di-dropzone ${uploadingReceipt ? 'upload-area--loading' : ''}`}>
                        <div className="upload-icon">
                            <i className={`fas ${uploadingReceipt ? 'fa-spinner fa-spin' : 'fa-cloud-upload-alt'}`}></i>
                        </div>
                        <h3>{uploadingReceipt ? t('dataInput.readingReceipt') : t('dataInput.dragDropTitle')}</h3>
                        <p>{uploadingReceipt ? t('dataInput.readingReceiptBody') : t('dataInput.dragDropHelp', { maxMb: MAX_FILE_SIZE_MB, maxFiles: MAX_FILES_COUNT })}</p>
                        <div className="di-dropzone-site-badge"><i className="fas fa-map-marker-alt" /> {t('dataInput.filesGoTo')} <strong>{siteNameDisplay}</strong></div>
                        <input 
                            type="file" 
                            accept=".pdf,.xlsx,.xls,.jpg,.jpeg,.png,.gif,.webp"
                            multiple
                            onChange={handleFileUpload}
                            disabled={uploadingReceipt}
                        />
                    </div>
                    {pendingVerifications.some((p) => p.siteId === selectedSiteId) && (() => {
                        const scoped = pendingVerifications
                            .map((item, index) => ({ item, index }))
                            .filter((x) => x.item.siteId === selectedSiteId);
                        const docIdsSeen = new Set();
                        const groups = [];
                        scoped.forEach(({ item, index: idx }) => {
                            if (docIdsSeen.has(item.documentId)) return;
                            docIdsSeen.add(item.documentId);
                            const indices = scoped.filter((x) => x.item.documentId === item.documentId).map((x) => x.index);
                            groups.push({ documentId: item.documentId, fileName: item.fileName, indices });
                        });
                        const n = scoped.length;
                        return (
                        <div className="upload-verify-list">
                            <div className="upload-verify-list-header">
                                <div>
                                    <h4><i className="fas fa-check-double"></i> {t('dataInput.verifyHeading', { site: siteNameDisplay, count: n, entriesWord: n !== 1 ? t('dataInput.entriesWordMany') : t('dataInput.entriesWordOne') })}</h4>
                                    <p className="upload-verify-hint">{t('dataInput.verifyHint')}</p>
                                </div>
                                <button
                                    type="button"
                                    className="btn btn-primary btn-submit-all"
                                    onClick={handleSubmitAll}
                                    disabled={submittingAll || n === 0}
                                >
                                    {submittingAll ? <><i className="fas fa-spinner fa-spin"></i> {t('dataInput.submittingAll')}</> : <><i className="fas fa-paper-plane"></i> {t('dataInput.submitAll')}</>}
                                </button>
                            </div>
                            {groups.map((group) => (
                                <div key={group.documentId} className={group.indices.length > 1 ? 'upload-verify-batch' : ''}>
                                    {group.indices.length > 1 && (
                                        <div className="upload-verify-batch-header">
                                            <span className="upload-verify-batch-title">{group.fileName} ({t('dataInput.entriesInFile', { count: group.indices.length })})</span>
                                            <button
                                                type="button"
                                                className="btn btn-primary"
                                                onClick={() => handleSubmitBatch(group.documentId)}
                                                disabled={submittingBatchId === group.documentId}
                                            >
                                                {submittingBatchId === group.documentId ? <><i className="fas fa-spinner fa-spin"></i> {t('dataInput.sending')}</> : <><i className="fas fa-paper-plane"></i> {t('dataInput.submitBatchEntries', { count: group.indices.length })}</>}
                                            </button>
                                        </div>
                                    )}
                                    {group.indices.map((index) => {
                                        const item = pendingVerifications[index];
                                        return (
                                        <div key={`${item.documentId}-${index}`} className="upload-verify-card">
                                            <div className="upload-verify-card-title">{group.indices.length > 1 ? t('dataInput.verifyRowTitle', { file: group.fileName, row: group.indices.indexOf(index) + 1 }) : item.fileName}</div>
                                            <div className="upload-verify-fields">
                                                {isFuelActivity(item.activityType) && (
                                                    <div className="form-group">
                                                        <label>{t('dataInput.productFuelName')}</label>
                                                        <input
                                                            type="text"
                                                            value={item.product}
                                                            onChange={(e) => updatePendingField(index, 'product', e.target.value)}
                                                            placeholder={t('dataInput.placeholderProductFuel')}
                                                        />
                                                    </div>
                                                )}
                                                <div className={`form-group${item.dateMismatch ? ' form-group-date-mismatch' : ''}`}>
                                                    <label>{t('dataInput.date')}</label>
                                                    <input
                                                        type="date"
                                                        value={item.date}
                                                        onChange={(e) => updatePendingField(index, 'date', e.target.value)}
                                                        placeholder="YYYY-MM-DD"
                                                    />
                                                    {item.dateMismatch ? (
                                                        <span className="help-text date-mismatch-warning">
                                                            <i className="fas fa-exclamation-triangle"></i> {t('dataInput.dateMismatchWarning', { month: monthNamesLong[expectedDocMonth - 1], year: expectedDocYear })}
                                                        </span>
                                                    ) : (
                                                        <span className="help-text">{t('dataInput.dateHelpExtracted')}</span>
                                                    )}
                                                </div>
                                                <div className="form-group">
                                                    <label>{t('dataInput.activityType')}</label>
                                                    <input
                                                        type="text"
                                                        value={item.activityType}
                                                        onChange={(e) => updatePendingField(index, 'activityType', e.target.value)}
                                                        placeholder={t('dataInput.placeholderActivityType')}
                                                    />
                                                </div>
                                                <div className="form-group">
                                                    <label>{t('dataInput.amountRequired')}</label>
                                                    <input
                                                        type="number"
                                                        value={item.activityAmount}
                                                        onChange={(e) => updatePendingField(index, 'activityAmount', e.target.value)}
                                                        placeholder="0"
                                                        step="any"
                                                    />
                                                </div>
                                                <div className="form-group">
                                                    <label>{t('dataInput.unitRequired')}</label>
                                                    <input
                                                        type="text"
                                                        value={item.activityUnit}
                                                        onChange={(e) => updatePendingField(index, 'activityUnit', e.target.value)}
                                                        placeholder={t('dataInput.placeholderUnit')}
                                                    />
                                                </div>
                                                <div className="form-group">
                                                    <label>{t('dataInput.regionOptional')}</label>
                                                    <input
                                                        type="text"
                                                        value={item.region}
                                                        onChange={(e) => updatePendingField(index, 'region', e.target.value)}
                                                        placeholder={t('dataInput.placeholderRegion')}
                                                    />
                                                </div>
                                                <div className="form-group">
                                                    <label>{t('dataInput.supplierOptional')}</label>
                                                    <input
                                                        type="text"
                                                        value={item.supplier ?? ''}
                                                        onChange={(e) => updatePendingField(index, 'supplier', e.target.value)}
                                                        placeholder={t('dataInput.placeholderSupplierLong')}
                                                    />
                                                </div>
                                            </div>
                                            <div className="upload-verify-actions">
                                                <button type="button" className="btn btn-secondary" onClick={() => clearPendingVerification(index)}>
                                                    {t('dataInput.cancel')}
                                                </button>
                                                {group.indices.length === 1 && (
                                                    <button
                                                        type="button"
                                                        className="btn btn-primary"
                                                        onClick={() => handleSubmitVerification(index)}
                                                        disabled={submittingId === item.documentId}
                                                    >
                                                        {submittingId === item.documentId ? <><i className="fas fa-spinner fa-spin"></i> {t('dataInput.sending')}</> : <><i className="fas fa-paper-plane"></i> {t('dataInput.submit')}</>}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        );
                                    })}
                                </div>
                            ))}
                        </div>
                        );
                    })()}
                    <div className="upload-info">
                        <p><i className="fas fa-info-circle"></i> {t('dataInput.uploadInfoAi')}</p>
                        <p><i className="fas fa-weight-hanging"></i> {t('dataInput.uploadInfoLimit', { maxMb: MAX_FILE_SIZE_MB, maxFiles: MAX_FILES_COUNT })}</p>
                        <p><i className="fas fa-shield-alt"></i> {t('dataInput.uploadInfoLogin')}</p>
                    </div>
                </div>
            )}
            </div>
            <aside className="di-summary-panel">
                <div className="di-summary-card">
                    <div className="di-summary-card-header">
                        <h4>{t('dataInput.siteSummary')}</h4>
                        <i className="fas fa-map-marker-alt di-summary-icon" />
                    </div>
                    <div className="di-summary-site-name">
                        <i className="fas fa-map-marker-alt" /> {siteNameDisplay}
                    </div>
                    <div className="di-summary-stat-row">
                        <span className="di-summary-stat-label">{t('dataInput.receiptsSavedPeriod')}</span>
                        <span className="di-summary-stat-value">{summaryStats.docs}</span>
                    </div>
                    <div className="di-summary-stat-row">
                        <span className="di-summary-stat-label">{t('dataInput.manualRowsSavedPeriod')}</span>
                        <span className="di-summary-stat-value">{summaryStats.manualRows}</span>
                    </div>
                    <div className="di-summary-stat-row">
                        <span className="di-summary-stat-label">{t('dataInput.lastActivity')}</span>
                        <span className="di-summary-stat-value">{formatLastUpload(summaryStats.lastUpload)}</span>
                    </div>
                    <div className="di-summary-stat-row">
                        <span className="di-summary-stat-label">{t('dataInput.reportingPeriod')}</span>
                        <span className="di-summary-stat-value">{monthNamesLong[expectedDocMonth - 1]} {expectedDocYear}</span>
                    </div>
                    <div className="di-summary-stat-row">
                        <span className="di-summary-stat-label">{t('dataInput.facilityType')}</span>
                        <span className="di-summary-stat-value">{currentSite?.facilityType ? optLabel('facility', DI_FACILITY_I18N, currentSite.facilityType) : t('dataInput.emDash')}</span>
                    </div>
                    <div className="di-summary-stat-row">
                        <span className="di-summary-stat-label">{t('dataInput.siteCode')}</span>
                        <span className="di-summary-stat-value">{currentSite?.code ?? t('dataInput.emDash')}</span>
                    </div>
                </div>
                <div className="di-summary-card di-quick-tips">
                    <div className="di-summary-card-header">
                        <h4>{t('dataInput.quickTips')}</h4>
                        <i className="fas fa-lightbulb di-summary-icon" />
                    </div>
                    <ul className="di-tips-list">
                        <li><i className="fas fa-check" /> {t('dataInput.tipVerifySite')}</li>
                        <li><i className="fas fa-check" /> {t('dataInput.tipOriginalBills')}</li>
                        <li><i className="fas fa-check" /> {t('dataInput.tipReviewAi')}</li>
                        <li><i className="fas fa-check" /> {t('dataInput.tipEachFacility')}</li>
                    </ul>
                </div>
            </aside>
            </div>

            <div className="di-recent-sections">
                {diDeleteError && (
                    <div className="di-delete-error-banner" role="alert">
                        <i className="fas fa-exclamation-circle" />
                        <span>{diDeleteError}</span>
                        <button type="button" className="di-delete-error-dismiss" onClick={() => setDiDeleteError(null)} aria-label={t('dataInput.dismiss')}>
                            &times;
                        </button>
                    </div>
                )}
                {!hasToken && (
                    <p className="di-recent-hint">{t('dataInput.loginHintRecent', { site: siteNameDisplay, year: reportingYear })}</p>
                )}
                {hasToken && diEmissionsLoading && (
                    <p className="di-recent-hint"><i className="fas fa-spinner fa-spin" /> {t('dataInput.loadingRecent')}</p>
                )}
                {hasToken && !diEmissionsLoading && diEmissionsError && (
                    <p className="di-recent-error">{diEmissionsError}</p>
                )}
                {hasToken && !diEmissionsLoading && !diEmissionsError && (
                    <>
                        <div className="card facility-card di-recent-card">
                            <div className="card-header">
                                <h2>
                                    <i className="fas fa-history" />
                                    {t('dataInput.recentActivities')}
                                </h2>
                            </div>
                            <div className="facility-table-wrapper">
                                <table className="facility-table">
                                    <thead>
                                        <tr>
                                            {hasToken && (
                                                <th style={{ width: '2.5rem' }}>
                                                    <input
                                                        type="checkbox"
                                                        aria-label={t('dashboard.selectAllRecent')}
                                                        checked={
                                                            diRecentActivitiesRows.length > 0 &&
                                                            diRecentActivitiesRows.every((activity) => activity.id && diSelectedEmissionIds.includes(activity.id))
                                                        }
                                                        onChange={(ev) => {
                                                            if (ev.target.checked) {
                                                                const ids = diRecentActivitiesRows.map((a) => a.id).filter(Boolean);
                                                                setDiSelectedEmissionIds((prev) => Array.from(new Set([...prev, ...ids])));
                                                            } else {
                                                                setDiSelectedEmissionIds((prev) =>
                                                                    prev.filter((id) => !diRecentActivitiesRows.some((a) => a.id === id))
                                                                );
                                                            }
                                                        }}
                                                    />
                                                </th>
                                            )}
                                            <th>{t('dashboard.source')}</th>
                                            <th>{t('dashboard.date')}</th>
                                            <th>{t('dashboard.type')}</th>
                                            <th>{t('dashboard.emissions')}</th>
                                            <th>{t('dashboard.dataSource')}</th>
                                            <th>{t('dashboard.status')}</th>
                                            {hasToken && <th className="th-actions">{t('dashboard.actions')}</th>}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {diRecentActivitiesRows.length === 0 && (
                                            <tr>
                                                <td colSpan={hasToken ? 8 : 6} className="di-recent-empty-cell">
                                                    {t('dataInput.emptyEmissions', { year: reportingYear })}
                                                </td>
                                            </tr>
                                        )}
                                        {diRecentActivitiesRows.map((activity, index) => (
                                            <tr key={activity.id || index}>
                                                {hasToken && (
                                                    <td>
                                                        {activity.id && (
                                                            <input
                                                                type="checkbox"
                                                                checked={diSelectedEmissionIds.includes(activity.id)}
                                                                onChange={() => toggleDiEmissionSelected(activity.id)}
                                                                aria-label={t('dashboard.selectThisEmission')}
                                                            />
                                                        )}
                                                    </td>
                                                )}
                                                <td>{activity.source}</td>
                                                <td>{activity.date ? diFormatDate(activity.date) : t('dataInput.emDash')}</td>
                                                <td>
                                                    <span className={`type-badge ${activity.type}`}>
                                                        {activity.type === 'scope1' ? t('dashboard.scope1') : activity.type === 'scope2' ? t('dashboard.scope2') : t('dashboard.scope3')}
                                                    </span>
                                                </td>
                                                <td>{diFormatNumber(activity.amount)} tCO₂e</td>
                                                <td><span className="source-badge">{activity.dataSource || t('dataInput.emDash')}</span></td>
                                                <td>
                                                    <span className="status-badge verified">{t('dashboard.verified')}</span>
                                                </td>
                                                {hasToken && (
                                                    <td className="td-actions">
                                                        {activity.id ? (
                                                            <button
                                                                type="button"
                                                                className="btn-icon btn-delete"
                                                                onClick={() => handleDiDeleteEmission(activity.id)}
                                                                disabled={diDeletingId === activity.id}
                                                                title={t('dashboard.deleteThisRecord')}
                                                                aria-label={t('dashboard.delete')}
                                                            >
                                                                {diDeletingId === activity.id ? <i className="fas fa-spinner fa-spin" /> : <i className="fas fa-trash-alt" />}
                                                            </button>
                                                        ) : null}
                                                    </td>
                                                )}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {hasToken && (
                            <div className="dashboard-bulk-actions">
                                <button
                                    type="button"
                                    className="btn btn-danger"
                                    disabled={!diSelectedEmissionIds.length || diDeletingId === 'bulk'}
                                    onClick={handleDiBulkDelete}
                                    title={diSelectedEmissionIds.length ? t('dashboard.deleteSelectedTooltip', { count: diSelectedEmissionIds.length }) : t('dashboard.selectRecordsToEnable')}
                                >
                                    {diDeletingId === 'bulk' ? (
                                        <>
                                            <i className="fas fa-spinner fa-spin" /> {t('dashboard.deleting')}
                                        </>
                                    ) : (
                                        <>
                                            <i className="fas fa-trash-alt" /> {t('dashboard.deleteSelected')}
                                        </>
                                    )}
                                </button>
                                {diSelectedEmissionIds.length > 0 && (
                                    <span className="dashboard-bulk-count">
                                        {t('dashboard.selected', { count: diSelectedEmissionIds.length })}
                                    </span>
                                )}
                            </div>
                        )}

                        <div className="card facility-card di-recent-card">
                            <div className="card-header">
                                <h2>
                                    <i className="fas fa-receipt" />
                                    {t('dataInput.recentReceiptsTitle')}
                                </h2>
                            </div>
                            <p className="di-recent-card-sub">{t('dataInput.recentReceiptsSub')}</p>
                            <div className="facility-table-wrapper">
                                <table className="facility-table">
                                    <thead>
                                        <tr>
                                            <th>{t('dataInput.receiptFile')}</th>
                                            <th>{t('dashboard.source')}</th>
                                            <th>{t('dashboard.date')}</th>
                                            <th>{t('dashboard.type')}</th>
                                            <th>{t('dashboard.emissions')}</th>
                                            <th>{t('dashboard.dataSource')}</th>
                                            {hasToken && <th className="th-actions">{t('dashboard.actions')}</th>}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {diReceiptRows.length === 0 && (
                                            <tr>
                                                <td colSpan={hasToken ? 7 : 6} className="di-recent-empty-cell">
                                                    {t('dataInput.emptyReceipts', { year: reportingYear })}
                                                </td>
                                            </tr>
                                        )}
                                        {diReceiptRows.map((row, index) => (
                                            <tr key={row.id || index}>
                                                <td><span className="source-badge" title={row.fileName}>{row.fileName}</span></td>
                                                <td>{row.source}</td>
                                                <td>{row.date ? diFormatDate(row.date) : t('dataInput.emDash')}</td>
                                                <td>
                                                    <span className={`type-badge ${row.type}`}>
                                                        {row.type === 'scope1' ? t('dashboard.scope1') : row.type === 'scope2' ? t('dashboard.scope2') : t('dashboard.scope3')}
                                                    </span>
                                                </td>
                                                <td>{diFormatNumber(row.amount)} tCO₂e</td>
                                                <td><span className="source-badge">{row.dataSource || t('dataInput.emDash')}</span></td>
                                                {hasToken && (
                                                    <td className="td-actions">
                                                        {row.id ? (
                                                            <button
                                                                type="button"
                                                                className="btn-icon btn-delete"
                                                                onClick={() => handleDiDeleteEmission(row.id)}
                                                                disabled={diDeletingId === row.id}
                                                                title={t('dashboard.deleteThisRecord')}
                                                                aria-label={t('dashboard.delete')}
                                                            >
                                                                {diDeletingId === row.id ? <i className="fas fa-spinner fa-spin" /> : <i className="fas fa-trash-alt" />}
                                                            </button>
                                                        ) : null}
                                                    </td>
                                                )}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </>
                )}
            </div>
            </>
            )}

            {addSiteOpen && (
                <div className="di-modal-overlay" role="presentation" onClick={(e) => e.target === e.currentTarget && setAddSiteOpen(false)}>
                    <div className="di-modal" role="dialog" aria-labelledby="di-modal-title">
                        <div className="di-modal-header">
                            <div className="di-modal-header-left">
                                <div className="di-modal-header-icon"><i className="fas fa-map-marker-alt" /></div>
                                <div>
                                    <h2 id="di-modal-title">{t('dataInput.modalAddSiteTitle')}</h2>
                                    <p>{t('dataInput.modalAddSiteSubtitle')}</p>
                                </div>
                            </div>
                            <button type="button" className="di-modal-close" onClick={() => setAddSiteOpen(false)} aria-label={t('decarb.close')}>
                                <i className="fas fa-times" />
                            </button>
                        </div>
                        <div className="di-modal-body">
                            <div className="di-modal-form-grid">
                                <div className="form-group">
                                    <label>{t('dataInput.modalSiteName')}</label>
                                    <input className="di-modal-input" value={newSite.name} onChange={(e) => setNewSite((s) => ({ ...s, name: e.target.value }))} placeholder={t('dataInput.placeholderSiteName')} />
                                </div>
                                <div className="form-group">
                                    <label>{t('dataInput.modalSiteCode')}</label>
                                    <input className="di-modal-input" value={newSite.code} onChange={(e) => setNewSite((s) => ({ ...s, code: e.target.value }))} placeholder={t('dataInput.placeholderSiteCode')} />
                                </div>
                                <div className="form-group">
                                    <label>{t('dataInput.modalCountry')}</label>
                                    <select className="di-modal-input" value={newSite.country} onChange={(e) => setNewSite((s) => ({ ...s, country: e.target.value }))}>
                                        {COUNTRY_OPTIONS.map((c) => (
                                            <option key={c} value={c}>{optLabel('country', DI_COUNTRY_I18N, c)}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>{t('dataInput.modalCity')}</label>
                                    <input className="di-modal-input" value={newSite.city} onChange={(e) => setNewSite((s) => ({ ...s, city: e.target.value }))} placeholder={t('dataInput.placeholderCity')} />
                                </div>
                                <div className="form-group">
                                    <label>{t('dataInput.modalFacilityType')}</label>
                                    <select className="di-modal-input" value={newSite.facilityType} onChange={(e) => setNewSite((s) => ({ ...s, facilityType: e.target.value }))}>
                                        <option value="">{t('dataInput.modalSelectType')}</option>
                                        {FACILITY_TYPES.map((f) => (
                                            <option key={f} value={f}>{optLabel('facility', DI_FACILITY_I18N, f)}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>{t('dataInput.modalBoundary')}</label>
                                    <select className="di-modal-input" value={newSite.boundary} onChange={(e) => setNewSite((s) => ({ ...s, boundary: e.target.value }))}>
                                        {BOUNDARY_OPTIONS.map((b) => (
                                            <option key={b} value={b}>{optLabel('boundary', DI_BOUNDARY_I18N, b)}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>{t('dataInput.modalDefaultCurrency')}</label>
                                    <select className="di-modal-input" value={newSite.currency} onChange={(e) => setNewSite((s) => ({ ...s, currency: e.target.value }))}>
                                        {CURRENCY_OPTIONS.map((c) => (
                                            <option key={c} value={c}>{optLabel('currencyLine', DI_CURRENCY_LINE_I18N, c)}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>{t('dataInput.modalUtilityProvider')}</label>
                                    <input className="di-modal-input" value={newSite.utilityProvider} onChange={(e) => setNewSite((s) => ({ ...s, utilityProvider: e.target.value }))} placeholder={t('dataInput.placeholderUtility')} />
                                </div>
                            </div>
                        </div>
                        <div className="di-modal-footer">
                            <button type="button" className="btn btn-secondary" onClick={() => setAddSiteOpen(false)}>{t('dataInput.cancel')}</button>
                            <button type="button" className="btn btn-primary" onClick={handleSaveNewSite}><i className="fas fa-check" /> {t('dataInput.saveSite')}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default DataInput;

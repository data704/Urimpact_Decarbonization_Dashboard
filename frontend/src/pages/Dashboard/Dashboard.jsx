import { useEffect, useRef, useState, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    LineElement,
    PointElement,
    ArcElement,
    Title,
    Tooltip,
    Legend,
    Filler
} from 'chart.js';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import { useAuth } from '../../context/AuthContext';
import { useDataStore } from '../../context/DataStoreContext';
import { getAuthToken, getDashboard, getEmissions, deleteEmission, deleteEmissionsBulk, getRecentActivity } from '../../api/client';
import './Dashboard.css';

const kgToTonnes = (kg) => (kg == null ? 0 : kg / 1000);
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const SITES_KEY_PREFIX = 'urimpact_data_input_sites_';
const SITE_COLORS = ['#0d9488', '#3b82f6', '#8b5cf6', '#14B8A6', '#6366F1'];

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

function loadSitesForOrg(orgKey) {
    if (typeof window === 'undefined') return [];
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

// Register Chart.js components
ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    LineElement,
    PointElement,
    ArcElement,
    Title,
    Tooltip,
    Legend,
    Filler
);

function Dashboard() {
    const location = useLocation();
    const { user } = useAuth();
    const { 
        scope1Entries, 
        scope2Entries, 
        activities,
        getTotalScope1, 
        getTotalScope2, 
        getTotalEmissions,
        getMonthlyData,
        getScope1Breakdown
    } = useDataStore();

    const [apiDashboard, setApiDashboard] = useState(null);
    const [apiEmissions, setApiEmissions] = useState([]);
    const [apiLoading, setApiLoading] = useState(true);
    const [apiError, setApiError] = useState(null);
    const [deletingId, setDeletingId] = useState(null);
    const [selectedEmissionIds, setSelectedEmissionIds] = useState([]);
    const [deleteError, setDeleteError] = useState(null);
    const fromSubmit = location.state?.fromSubmit === true;
    const submitMessage = location.state?.submitMessage;

    const currentYear = new Date().getFullYear();
    const [filterYear, setFilterYear] = useState(currentYear);
    const [filterPeriod, setFilterPeriod] = useState('all'); // 'all' | 'Q1' | 'Q2' | 'Q3' | 'Q4' | 0-11 | number[] for calendar multi-select

    const [calendarModalOpen, setCalendarModalOpen] = useState(false);
    const [calendarYearEmissions, setCalendarYearEmissions] = useState([]);
    const [calendarSelectedMonths, setCalendarSelectedMonths] = useState([]);

    // Recent activity feed (who did what)
    const [activityLogs, setActivityLogs] = useState([]);
    const [activityError, setActivityError] = useState(null);

    const hasToken = Boolean(getAuthToken());
    const orgKey =
        user?.organizationId != null
            ? String(user.organizationId)
            : user?.id != null
                ? String(user.id)
                : 'guest';

    // Demo-only UI for single-site vs multi-site compare
    const [sites, setSites] = useState([]);
    const [viewMode, setViewMode] = useState('all'); // 'all' | 'single' | 'compare'
    const [selectedSiteId, setSelectedSiteId] = useState('all');
    const [compareSiteIds, setCompareSiteIds] = useState([]);

    useEffect(() => {
        setSites(loadSitesForOrg(orgKey));
    }, [orgKey]);

    useEffect(() => {
        if (viewMode !== 'single') return;
        if (selectedSiteId !== 'all' && sites.some((s) => s.id === selectedSiteId)) return;
        setSelectedSiteId(sites[0]?.id ?? 'all');
    }, [viewMode, selectedSiteId, sites]);

    useEffect(() => {
        setCompareSiteIds((prev) => prev.filter((id) => sites.some((s) => s.id === id)));
    }, [sites]);

    const showSiteControls = sites.length > 0;
    const showSiteColumn = showSiteControls;

    const dateRange = useMemo(() => {
        const start = new Date(filterYear, 0, 1);
        const end = new Date(filterYear, 11, 31, 23, 59, 59, 999);
        if (filterPeriod === 'all') return { startDate: start, endDate: end };
        if (Array.isArray(filterPeriod) && filterPeriod.length > 0) {
            const minM = Math.min(...filterPeriod);
            const maxM = Math.max(...filterPeriod);
            const lastDay = new Date(filterYear, maxM + 1, 0);
            return { startDate: new Date(filterYear, minM, 1), endDate: new Date(filterYear, maxM, lastDay.getDate(), 23, 59, 59, 999) };
        }
        if (filterPeriod === 'Q1') return { startDate: new Date(filterYear, 0, 1), endDate: new Date(filterYear, 2, 31, 23, 59, 59, 999) };
        if (filterPeriod === 'Q2') return { startDate: new Date(filterYear, 3, 1), endDate: new Date(filterYear, 5, 30, 23, 59, 59, 999) };
        if (filterPeriod === 'Q3') return { startDate: new Date(filterYear, 6, 1), endDate: new Date(filterYear, 8, 30, 23, 59, 59, 999) };
        if (filterPeriod === 'Q4') return { startDate: new Date(filterYear, 9, 1), endDate: new Date(filterYear, 11, 31, 23, 59, 59, 999) };
        const month = typeof filterPeriod === 'number' ? filterPeriod : parseInt(filterPeriod, 10);
        if (!Number.isNaN(month) && month >= 0 && month <= 11) {
            const lastDay = new Date(filterYear, month + 1, 0);
            return { startDate: new Date(filterYear, month, 1), endDate: new Date(filterYear, month, lastDay.getDate(), 23, 59, 59, 999) };
        }
        return { startDate: start, endDate: end };
    }, [filterYear, filterPeriod]);

    useEffect(() => {
        if (!hasToken) {
            setApiLoading(false);
            setApiDashboard(null);
            setApiEmissions([]);
            return;
        }
        let cancelled = false;
        setApiLoading(true);
        setApiError(null);
        const startStr = dateRange.startDate.toISOString().slice(0, 10);
        const endStr = dateRange.endDate.toISOString().slice(0, 10);
        Promise.all([
            getDashboard({ startDate: startStr, endDate: endStr }),
            getEmissions({ startDate: startStr, endDate: endStr, limit: '100' })
        ])
            .then(([dashboard, { data: emissions }]) => {
                if (!cancelled) {
                    setApiDashboard(dashboard);
                    setApiEmissions(emissions || []);
                }
            })
            .catch((err) => {
                if (!cancelled) {
                    setApiError(err?.message || 'Failed to load dashboard');
                    setApiDashboard(null);
                    setApiEmissions([]);
                }
            })
            .finally(() => {
                if (!cancelled) setApiLoading(false);
            });
        return () => { cancelled = true; };
    }, [hasToken, fromSubmit, filterYear, filterPeriod]);

    // Load recent activity from audit logs
    useEffect(() => {
        if (!hasToken) {
            setActivityLogs([]);
            return;
        }
        let cancelled = false;
        getRecentActivity(15)
            .then((logs) => {
                if (!cancelled) {
                    setActivityLogs(Array.isArray(logs) ? logs : []);
                    setActivityError(null);
                }
            })
            .catch((err) => {
                if (!cancelled) {
                    setActivityError(err?.message || null);
                    setActivityLogs([]);
                }
            });
        return () => { cancelled = true; };
    }, [hasToken, fromSubmit]);

    useEffect(() => {
        if (!hasToken) {
            setActivityLogs([]);
            return;
        }
        let cancelled = false;
        getRecentActivity(15)
            .then((logs) => {
                if (!cancelled) {
                    setActivityLogs(Array.isArray(logs) ? logs : []);
                    setActivityError(null);
                }
            })
            .catch((err) => {
                if (!cancelled) {
                    setActivityError(err?.message || null);
                    setActivityLogs([]);
                }
            });
        return () => { cancelled = true; };
    }, [hasToken, fromSubmit]);

    useEffect(() => {
        if (!calendarModalOpen || !hasToken) {
            if (!calendarModalOpen) setCalendarYearEmissions([]);
            return;
        }
        let cancelled = false;
        const startStr = `${filterYear}-01-01`;
        const endStr = `${filterYear}-12-31`;
        getEmissions({ startDate: startStr, endDate: endStr, limit: '500' })
            .then(({ data }) => { if (!cancelled) setCalendarYearEmissions(data || []); })
            .catch(() => { if (!cancelled) setCalendarYearEmissions([]); });
        return () => { cancelled = true; };
    }, [calendarModalOpen, filterYear, hasToken]);

    const submissionsByMonth = useMemo(() => {
        const counts = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0, 11: 0 };
        (calendarYearEmissions || []).forEach((e) => {
            const activityDate = e.billingPeriodStart || e.calculatedAt;
            const d = activityDate ? new Date(activityDate) : null;
            if (d && d.getFullYear() === filterYear) {
                const m = d.getMonth();
                if (m >= 0 && m <= 11) counts[m] = (counts[m] || 0) + 1;
            }
        });
        return counts;
    }, [calendarYearEmissions, filterYear]);

    const openCalendarModal = () => {
        if (filterPeriod === 'all') setCalendarSelectedMonths([]);
        else if (filterPeriod === 'Q1') setCalendarSelectedMonths([0, 1, 2]);
        else if (filterPeriod === 'Q2') setCalendarSelectedMonths([3, 4, 5]);
        else if (filterPeriod === 'Q3') setCalendarSelectedMonths([6, 7, 8]);
        else if (filterPeriod === 'Q4') setCalendarSelectedMonths([9, 10, 11]);
        else if (Array.isArray(filterPeriod)) setCalendarSelectedMonths([...filterPeriod]);
        else setCalendarSelectedMonths([typeof filterPeriod === 'number' ? filterPeriod : parseInt(String(filterPeriod), 10) || 0]);
        setCalendarModalOpen(true);
    };

    const applyCalendarSelection = () => {
        if (calendarSelectedMonths.length === 0) setFilterPeriod('all');
        else if (calendarSelectedMonths.length === 1) setFilterPeriod(calendarSelectedMonths[0]);
        else setFilterPeriod([...calendarSelectedMonths].sort((a, b) => a - b));
        setCalendarModalOpen(false);
    };

    const toggleCalendarMonth = (idx) => {
        setCalendarSelectedMonths((prev) =>
            prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx].sort((a, b) => a - b)
        );
    };

    const refreshDashboard = () => {
        if (!hasToken) return;
        setApiLoading(true);
        setApiError(null);
        const startStr = dateRange.startDate.toISOString().slice(0, 10);
        const endStr = dateRange.endDate.toISOString().slice(0, 10);
        Promise.all([
            getDashboard({ startDate: startStr, endDate: endStr }),
            getEmissions({ startDate: startStr, endDate: endStr, limit: '100' })
        ])
            .then(([dashboard, { data: emissions }]) => {
                setApiDashboard(dashboard);
                setApiEmissions(emissions || []);
            })
            .catch((err) => {
                setApiError(err?.message || 'Failed to load dashboard');
            })
            .finally(() => setApiLoading(false));
    };

    const periodLabel = filterPeriod === 'all'
        ? 'All Time'
        : Array.isArray(filterPeriod) && filterPeriod.length > 0
            ? (filterPeriod.length === 12 ? 'All Time' : `${MONTHS[filterPeriod[0]]} – ${MONTHS[filterPeriod[filterPeriod.length - 1]]}`)
            : (filterPeriod === 'Q1' || filterPeriod === 'Q2' || filterPeriod === 'Q3' || filterPeriod === 'Q4')
                ? filterPeriod
                : MONTHS[typeof filterPeriod === 'number' ? filterPeriod : parseInt(String(filterPeriod), 10) || 0];
    const years = Array.from({ length: 11 }, (_, i) => currentYear - 5 + i);
    const trendMonthsWithData = useMemo(() => new Set((apiDashboard?.emissions?.trend || []).filter(t => (t.scope1 || 0) + (t.scope2 || 0) > 0).map(t => t.month)), [apiDashboard]);

    const handleDeleteEmission = async (emissionId) => {
        if (!emissionId || !hasToken) return;
        setDeleteError(null);
        setDeletingId(emissionId);
        try {
            await deleteEmission(emissionId);
            refreshDashboard();
        } catch (err) {
            setDeleteError(err?.message || 'Failed to delete');
        } finally {
            setDeletingId(null);
        }
    };

    const toggleEmissionSelected = (emissionId) => {
        setSelectedEmissionIds((prev) =>
            prev.includes(emissionId) ? prev.filter((id) => id !== emissionId) : [...prev, emissionId]
        );
    };

    const handleBulkDelete = async () => {
        if (!hasToken || !selectedEmissionIds.length) return;
        setDeleteError(null);
        setDeletingId('bulk');
        try {
            await deleteEmissionsBulk(selectedEmissionIds);
            setSelectedEmissionIds([]);
            refreshDashboard();
        } catch (err) {
            setDeleteError(err?.message || 'Failed to delete selected records');
        } finally {
            setDeletingId(null);
        }
    };

    const scope1List = useMemo(() => apiEmissions.filter((e) => e.scope === 'SCOPE_1'), [apiEmissions]);
    const scope2List = useMemo(() => apiEmissions.filter((e) => e.scope === 'SCOPE_2'), [apiEmissions]);

    const demoSiteFilterIds = useMemo(() => {
        if (!showSiteControls) return null;
        if (viewMode === 'all') return null;
        if (viewMode === 'single') return selectedSiteId !== 'all' ? [selectedSiteId] : null;
        if (viewMode === 'compare') return compareSiteIds;
        return null;
    }, [showSiteControls, viewMode, selectedSiteId, compareSiteIds]);

    const normalizeKey = (v) => {
        if (v == null) return null;
        const s = String(v).trim();
        return s === '' ? null : s;
    };

    // Normalize IDs so lookups work even if backend returns "001" vs "1".
    const normalizeSiteIdKey = (v) => {
        const s = normalizeKey(v);
        if (s == null) return null;
        return /^\d+$/.test(s) ? String(parseInt(s, 10)) : s;
    };

    const getApiSiteId = (entry) => {
        const v =
            entry?.siteId ??
            entry?.site_id ??
            entry?.site?.id ??
            entry?.site?.siteId ??
            entry?.site?.facilityId ??
            entry?.site?.facility_id ??
            entry?.site?.facility?.id ??
            entry?.facilityId ??
            entry?.facility_id ??
            entry?.facility?.id ??
            entry?.facility?.facilityId ??
            entry?.facility?.siteId ??
            entry?.facility?.site_id ??
            null;
        return normalizeSiteIdKey(v);
    };

    const getApiSiteName = (entry) => {
        const v =
            entry?.siteName ??
            entry?.site_name ??
            entry?.site?.name ??
            entry?.site?.siteName ??
            entry?.site?.site_name ??
            entry?.site?.facilityName ??
            entry?.site?.facility_name ??
            entry?.facilityName ??
            entry?.facility_name ??
            entry?.facility?.name ??
            entry?.facility?.facilityName ??
            entry?.facility?.facility_name ??
            entry?.facility?.siteName ??
            entry?.facility?.site_name ??
            entry?.site?.facilityName ??
            entry?.facility?.facilityName ??
            null;
        return normalizeKey(v);
    };

    const apiEmissionsFilteredBySite = useMemo(() => {
        if (!hasToken) return apiEmissions;
        if (demoSiteFilterIds == null) return apiEmissions;

        // Normalize selected ids so set matching works with backend id formats.
        const set = new Set(
            (demoSiteFilterIds || [])
                .map(normalizeSiteIdKey)
                .filter(Boolean)
        );
        const normalizeName = (v) => {
            const s = normalizeKey(v);
            return s ? s.toLowerCase().replace(/\s+/g, ' ') : null;
        };

        const selectedNames = new Set(
            (sites || [])
                .filter((s) => set.has(normalizeSiteIdKey(s.id)))
                .map((s) => normalizeName(s.name))
                .filter(Boolean)
        );

        const filtered = apiEmissions.filter((e) => {
            const apiSiteId = getApiSiteId(e);
            const apiSiteName = getApiSiteName(e);
            const idMatch = apiSiteId != null && set.has(apiSiteId);
            const apiNameNorm = normalizeName(apiSiteName);
            const nameMatch =
                apiNameNorm != null &&
                (selectedNames.has(apiNameNorm) ||
                    Array.from(selectedNames).some((n) => apiNameNorm.includes(n) || n.includes(apiNameNorm)));
            return idMatch || nameMatch;
        });

        if (filtered.length) return filtered;
        // If user hasn't picked any sites for compare mode, show empty state.
        if (set.size === 0) return [];
        // If backend returns some site info but none match the selected site,
        // show empty (so filtering is actually correct).
        const hasAnySiteInfo = apiEmissions.some(
            (e) => getApiSiteId(e) != null || getApiSiteName(e) != null
        );
        // If backend never returns site info at all, keep previous behavior (show everything).
        return hasAnySiteInfo ? [] : apiEmissions;
    }, [apiEmissions, demoSiteFilterIds, hasToken, sites]);

    const scope1ListFiltered = useMemo(
        () => apiEmissionsFilteredBySite.filter((e) => e.scope === 'SCOPE_1'),
        [apiEmissionsFilteredBySite]
    );

    const scope2ListFiltered = useMemo(
        () => apiEmissionsFilteredBySite.filter((e) => e.scope === 'SCOPE_2'),
        [apiEmissionsFilteredBySite]
    );

    const demoFilteredScope1Entries = useMemo(() => {
        if (!showSiteControls || demoSiteFilterIds == null) return scope1Entries;
        if (!demoSiteFilterIds.length) return [];
        const set = new Set(
            (demoSiteFilterIds || [])
                .map(normalizeSiteIdKey)
                .filter(Boolean)
        );
        return scope1Entries.filter((e) => set.has(normalizeSiteIdKey(e.siteId)));
    }, [showSiteControls, demoSiteFilterIds, scope1Entries]);

    const demoFilteredScope2Entries = useMemo(() => {
        if (!showSiteControls || demoSiteFilterIds == null) return scope2Entries;
        if (!demoSiteFilterIds.length) return [];
        const set = new Set(
            (demoSiteFilterIds || [])
                .map(normalizeSiteIdKey)
                .filter(Boolean)
        );
        return scope2Entries.filter((e) => set.has(normalizeSiteIdKey(e.siteId)));
    }, [showSiteControls, demoSiteFilterIds, scope2Entries]);

    const demoScope1Total = useMemo(
        () => demoFilteredScope1Entries.reduce((sum, e) => sum + (e.emissions || 0), 0),
        [demoFilteredScope1Entries]
    );

    const demoScope2Total = useMemo(
        () => demoFilteredScope2Entries.reduce((sum, e) => sum + (e.emissions || 0), 0),
        [demoFilteredScope2Entries]
    );

    const demoTotalEmissions = demoScope1Total + demoScope2Total;

    const apiTotalEmissions = apiDashboard?.emissions?.total?.totalCo2eTonnes ?? null;
    const apiScope1Total = apiDashboard?.emissions?.byScope?.SCOPE_1?.totalTonnes ?? null;
    const apiScope2Total = apiDashboard?.emissions?.byScope?.SCOPE_2?.totalTonnes ?? null;

    const totalEmissions = hasToken ? (apiTotalEmissions ?? getTotalEmissions()) : demoTotalEmissions;
    const scope1Total = hasToken ? (apiScope1Total ?? getTotalScope1()) : demoScope1Total;
    const scope2Total = hasToken ? (apiScope2Total ?? getTotalScope2()) : demoScope2Total;

    const monthlyData = useMemo(() => {
        // Token mode (backend): use site-filtered API emissions when not in "All Sites" mode.
        if (hasToken) {
            if (viewMode === 'all' && apiDashboard?.emissions?.trend?.length) {
                const trend = apiDashboard.emissions.trend;
                const labels = trend.map((t) => MONTHS[parseInt(t.month.slice(5, 7), 10) - 1]);
                const scope1Data = trend.map((t) => kgToTonnes(t.scope1 || 0));
                const scope2Data = trend.map((t) => kgToTonnes(t.scope2 || 0));
                return { labels, scope1: scope1Data, scope2: scope2Data };
            }

            const scope1Data = new Array(12).fill(0);
            const scope2Data = new Array(12).fill(0);

            apiEmissionsFilteredBySite.forEach((e) => {
                const activityDate = e.billingPeriodStart || e.calculatedAt;
                if (!activityDate) return;
                const d = new Date(activityDate);
                if (Number.isNaN(d.getTime())) return;
                const m = d.getMonth();
                if (m < 0 || m > 11) return;

                const emissionsT = kgToTonnes(e.co2e || 0);
                if (e.scope === 'SCOPE_1') scope1Data[m] += emissionsT;
                if (e.scope === 'SCOPE_2') scope2Data[m] += emissionsT;
            });

            return {
                labels: MONTHS,
                scope1: scope1Data.map((v) => Math.round(v * 100) / 100),
                scope2: scope2Data.map((v) => Math.round(v * 100) / 100),
            };
        }

        // Demo mode: compute monthly totals based on selected site(s)
        const scope1Data = new Array(12).fill(0);
        const scope2Data = new Array(12).fill(0);

        demoFilteredScope1Entries.forEach((e) => {
            if (!e?.date) return;
            const d = new Date(e.date);
            if (Number.isNaN(d.getTime())) return;
            const m = d.getMonth();
            if (m >= 0 && m <= 11) scope1Data[m] += e.emissions || 0;
        });

        demoFilteredScope2Entries.forEach((e) => {
            if (!e?.date) return;
            const d = new Date(e.date);
            if (Number.isNaN(d.getTime())) return;
            const m = d.getMonth();
            if (m >= 0 && m <= 11) scope2Data[m] += e.emissions || 0;
        });

        return {
            labels: MONTHS,
            scope1: scope1Data.map((v) => Math.round(v * 100) / 100),
            scope2: scope2Data.map((v) => Math.round(v * 100) / 100),
        };
    }, [
        hasToken,
        viewMode,
        apiDashboard,
        apiEmissionsFilteredBySite,
        demoFilteredScope1Entries,
        demoFilteredScope2Entries,
    ]);

    const scope1Breakdown = useMemo(() => {
        if (scope1ListFiltered.length) {
            const byCat = {};
            scope1ListFiltered.forEach((e) => {
                const label = e.category?.replace(/_/g, ' ') ?? 'Other';
                byCat[label] = (byCat[label] || 0) + kgToTonnes(e.co2e);
            });
            return Object.keys(byCat).length ? byCat : { 'No data': 0 };
        }
        if (!hasToken && showSiteControls) {
            const breakdown = { 'Mobile Combustion': 0, 'Stationary Combustion': 0 };
            demoFilteredScope1Entries.forEach((e) => {
                const label = e.combustionType === 'mobile' ? 'Mobile Combustion' : 'Stationary Combustion';
                breakdown[label] += e.emissions || 0;
            });
            return breakdown;
        }
        return getScope1Breakdown();
    }, [scope1ListFiltered, hasToken, showSiteControls, demoFilteredScope1Entries, getScope1Breakdown]);

    // Chart options
    const lineChartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: false
            },
            tooltip: {
                backgroundColor: '#1E293B',
                titleColor: '#F8FAFC',
                bodyColor: '#94A3B8',
                padding: 12,
                cornerRadius: 8,
                displayColors: true
            }
        },
        scales: {
            x: {
                grid: {
                    display: false
                },
                ticks: {
                    color: '#64748B'
                }
            },
            y: {
                grid: {
                    color: 'rgba(148, 163, 184, 0.1)'
                },
                ticks: {
                    color: '#64748B'
                }
            }
        }
    };

    const doughnutOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: false
            }
        },
        cutout: '70%'
    };

    const lineChartData = {
        labels: monthlyData.labels,
        datasets: [
            {
                label: 'Scope 1',
                data: monthlyData.scope1,
                borderColor: '#14B8A6',
                backgroundColor: 'rgba(20, 184, 166, 0.1)',
                fill: true,
                tension: 0.4
            },
            {
                label: 'Scope 2',
                data: monthlyData.scope2,
                borderColor: '#3B82F6',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                fill: true,
                tension: 0.4
            }
        ]
    };

    const siteMetaById = useMemo(() => {
        const map = {};
        (sites || []).forEach((s, i) => {
            const key = normalizeSiteIdKey(s.id);
            if (!key) return;
            map[key] = {
                name: s.name,
                color: SITE_COLORS[i % SITE_COLORS.length],
            };
        });
        return map;
    }, [sites]);

    const barChartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            // We already render a custom legend (site chips) above for compare mode.
            legend: { display: false },
            tooltip: {
                backgroundColor: '#1E293B',
                titleColor: '#F8FAFC',
                bodyColor: '#94A3B8',
                padding: 12,
                cornerRadius: 8,
                displayColors: true,
            },
        },
        scales: {
            x: {
                grid: {
                    display: false,
                },
                ticks: {
                    color: '#64748B',
                },
                categoryPercentage: 0.85,
                barPercentage: 0.9,
            },
            y: {
                grid: {
                    color: 'rgba(148, 163, 184, 0.1)',
                },
                ticks: {
                    color: '#64748B',
                    callback: (value) => `${value}`,
                },
                beginAtZero: true,
            },
        },
        elements: {
            bar: {
                borderRadius: 8,
                borderSkipped: false,
            },
        },
    };

    const compareBarChartData = useMemo(() => {
        if (!showSiteControls || viewMode !== 'compare') return null;
        const selected = compareSiteIds || [];
        const unique = Array.from(new Set(selected));
        if (!unique.length) return null;

        const labels = MONTHS;

        const computeMonthlyTotalsForSite = (siteId) => {
            const siteName = siteMetaById?.[siteId]?.name ?? siteId;
            const color = siteMetaById?.[siteId]?.color ?? SITE_COLORS[0];
            const scope1Totals = new Array(12).fill(0);
            const scope2Totals = new Array(12).fill(0);

            if (hasToken) {
                apiEmissions
                    .filter((e) => getApiSiteId(e) === siteId)
                    .forEach((e) => {
                        const activityDate = e.billingPeriodStart || e.calculatedAt;
                        if (!activityDate) return;
                        const d = new Date(activityDate);
                        if (Number.isNaN(d.getTime())) return;
                        const m = d.getMonth();
                        if (m < 0 || m > 11) return;
                        const emissionsT = kgToTonnes(e.co2e || 0);
                        if (e.scope === 'SCOPE_1') scope1Totals[m] += emissionsT;
                        if (e.scope === 'SCOPE_2') scope2Totals[m] += emissionsT;
                    });
            } else {
                scope1Entries
                    .filter((e) => e?.siteId === siteId)
                    .forEach((e) => {
                        if (!e?.date) return;
                        const d = new Date(e.date);
                        if (Number.isNaN(d.getTime())) return;
                        const m = d.getMonth();
                        if (m >= 0 && m <= 11) scope1Totals[m] += e.emissions || 0;
                    });

                scope2Entries
                    .filter((e) => e?.siteId === siteId)
                    .forEach((e) => {
                        if (!e?.date) return;
                        const d = new Date(e.date);
                        if (Number.isNaN(d.getTime())) return;
                        const m = d.getMonth();
                        if (m >= 0 && m <= 11) scope2Totals[m] += e.emissions || 0;
                    });
            }

            return {
                siteId,
                siteName,
                color,
                scope1Totals,
                scope2Totals,
            };
        };

        const perSite = unique.map((siteId) => computeMonthlyTotalsForSite(siteId));
        const anySiteHasData = perSite.some((s) => s.scope1Totals.some((v) => v > 0) || s.scope2Totals.some((v) => v > 0));

        // If backend doesn't return per-site identifiers, fall back to using all emissions totals for each selected site.
        if (hasToken) {
            const anySiteHasData = perSite.some(
                (s) => s.scope1Totals.some((v) => v > 0) || s.scope2Totals.some((v) => v > 0)
            );

            if (!anySiteHasData && apiEmissions.length) {
                const overallScope1 = new Array(12).fill(0);
                const overallScope2 = new Array(12).fill(0);

                apiEmissions.forEach((e) => {
                    const activityDate = e.billingPeriodStart || e.calculatedAt;
                    if (!activityDate) return;
                    const d = new Date(activityDate);
                    if (Number.isNaN(d.getTime())) return;
                    const m = d.getMonth();
                    if (m < 0 || m > 11) return;
                    const emissionsT = kgToTonnes(e.co2e || 0);
                    if (e.scope === 'SCOPE_1') overallScope1[m] += emissionsT;
                    if (e.scope === 'SCOPE_2') overallScope2[m] += emissionsT;
                });

                const datasets = perSite.flatMap((s) => [
                    {
                        label: `${s.siteName} (Scope 1)`,
                        data: overallScope1.map((v) => Math.round(v * 100) / 100),
                        backgroundColor: `${s.color}CC`,
                        borderColor: s.color,
                        borderWidth: 1,
                        barThickness: 14,
                    },
                    {
                        label: `${s.siteName} (Scope 2)`,
                        data: overallScope2.map((v) => Math.round(v * 100) / 100),
                        backgroundColor: `${s.color}55`,
                        borderColor: s.color,
                        borderWidth: 1,
                        barThickness: 14,
                    },
                ]);

                return { labels, datasets };
            }
        }

        // Compare view: grouped bars (Scope 1 and Scope 2 side-by-side) per site and month.
        const datasets = perSite.flatMap((s) => [
            {
                label: `${s.siteName} (Scope 1)`,
                data: s.scope1Totals.map((v) => Math.round(v * 100) / 100),
                backgroundColor: `${s.color}CC`,
                borderColor: s.color,
                borderWidth: 1,
                barThickness: 14,
            },
            {
                label: `${s.siteName} (Scope 2)`,
                data: s.scope2Totals.map((v) => Math.round(v * 100) / 100),
                backgroundColor: `${s.color}55`,
                borderColor: s.color,
                borderWidth: 1,
                barThickness: 14,
            },
        ]);

        return { labels, datasets };
    }, [
        showSiteControls,
        viewMode,
        compareSiteIds,
        siteMetaById,
        hasToken,
        apiEmissions,
        scope1Entries,
        scope2Entries,
        getApiSiteId,
    ]);

    const scope1Labels = Object.keys(scope1Breakdown);
    const scope1Values = Object.values(scope1Breakdown);
    const scope1Colors = ['#14B8A6', '#0D9488', '#0F766E', '#115E59', '#134E4A'].slice(0, Math.max(scope1Labels.length, 1));
    const scope1DoughnutData = {
        labels: scope1Labels.length ? scope1Labels : ['No data'],
        datasets: [{
            data: scope1Values.length ? scope1Values : [0],
            backgroundColor: scope1Colors,
            borderWidth: 0
        }]
    };

    const scope2DoughnutData = {
        labels: ['Purchased Electricity'],
        datasets: [{
            data: [scope2Total],
            backgroundColor: ['#3B82F6'],
            borderWidth: 0
        }]
    };

    const formatNumber = (num) => {
        if (num == null || Number.isNaN(num)) return '0';
        return Number(num).toLocaleString('en-US', { maximumFractionDigits: 2 });
    };

    const formatDate = (dateStr) => {
        return new Date(dateStr).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    };

    const activePerformanceSiteIds = useMemo(() => {
        // Prefer the user-selected sites (when compare/single mode is used) to match expectations.
        if (showSiteControls && viewMode === 'compare' && compareSiteIds?.length) {
            return Array.from(new Set(compareSiteIds));
        }
        if (showSiteControls && viewMode === 'single' && selectedSiteId && selectedSiteId !== 'all') {
            return [selectedSiteId];
        }

        if (sites?.length) return sites.map((s) => s.id);

        // Fallback: derive from API records.
        if (hasToken) {
            const set = new Set();
            apiEmissions.forEach((e) => set.add(getApiSiteId(e)));
            return Array.from(set).filter(Boolean);
        }

        return [];
    }, [showSiteControls, viewMode, compareSiteIds, selectedSiteId, sites, hasToken, apiEmissions]);

    const sitePerformanceRows = useMemo(() => {
        const ids = activePerformanceSiteIds || [];
        if (!ids.length) return [];
        const idSet = new Set(ids);

        const totalsBySite = {};
        ids.forEach((id) => {
            totalsBySite[id] = { scope1: 0, scope2: 0 };
        });

        if (hasToken) {
            apiEmissions.forEach((e) => {
                const siteId = getApiSiteId(e);
                if (!siteId || !idSet.has(siteId)) return;
                const tonnes = kgToTonnes(e.co2e || 0);
                if (e.scope === 'SCOPE_1') totalsBySite[siteId].scope1 += tonnes;
                if (e.scope === 'SCOPE_2') totalsBySite[siteId].scope2 += tonnes;
            });
        } else {
            scope1Entries.forEach((e) => {
                if (!e?.siteId || !idSet.has(e.siteId)) return;
                totalsBySite[e.siteId].scope1 += e.emissions || 0;
            });
            scope2Entries.forEach((e) => {
                if (!e?.siteId || !idSet.has(e.siteId)) return;
                totalsBySite[e.siteId].scope2 += e.emissions || 0;
            });
        }

        const rows = ids.map((siteId) => {
            const siteMeta = siteMetaById?.[siteId];
            const scope1 = totalsBySite[siteId]?.scope1 ?? 0;
            const scope2 = totalsBySite[siteId]?.scope2 ?? 0;
            const total = scope1 + scope2;
            return {
                siteId,
                siteName: siteMeta?.name ?? siteId,
                color: siteMeta?.color ?? SITE_COLORS[0],
                scope1,
                scope2,
                total,
            };
        });

        return rows
            .filter((r) => r.total > 0 || (showSiteControls && viewMode !== 'compare')) // keep some rows visible
            .sort((a, b) => b.total - a.total);
    }, [
        activePerformanceSiteIds,
        hasToken,
        apiEmissions,
        scope1Entries,
        scope2Entries,
        siteMetaById,
        showSiteControls,
        viewMode,
    ]);

    const sitePerformanceMax = useMemo(() => {
        const max = Math.max(0, ...sitePerformanceRows.map((r) => r.total || 0));
        return max || 1;
    }, [sitePerformanceRows]);

    // If backend rows don't include `siteName`, we can still show the correct
    // name using the local (DataInput) entries stored in context for this session.
    const localSiteNameById = useMemo(() => {
        const map = {};
        const add = (entry) => {
            const sid = normalizeSiteIdKey(entry?.siteId);
            const name = entry?.siteName;
            if (!sid || !name) return;
            map[sid] = name;
        };

        (scope1Entries || []).forEach(add);
        (scope2Entries || []).forEach(add);
        (activities || []).forEach(add);
        return map;
    }, [scope1Entries, scope2Entries, activities]);

    const getSiteDisplayName = (entry) => {
        const apiName = getApiSiteName(entry);
        const apiSiteId = getApiSiteId(entry);
        const localName =
            apiSiteId
                ? siteMetaById?.[apiSiteId]?.name ?? localSiteNameById?.[apiSiteId]
                : null;
        const directName = entry?.siteName;

        const resolved =
            directName ||
            apiName ||
            localName ||
            null;

        // If backend doesn't provide a name at all, but user is in single-site mode,
        // show the selected site name (since rows should already be filtered).
        if (!resolved && viewMode === 'single' && selectedSiteId && selectedSiteId !== 'all') {
            return (
                siteMetaById?.[normalizeSiteIdKey(selectedSiteId)]?.name ||
                sites?.find((s) => normalizeSiteIdKey(s.id) === normalizeSiteIdKey(selectedSiteId))?.name ||
                apiSiteId ||
                '—'
            );
        }

        return (resolved || apiSiteId || '—');
    };

    const selectedSiteNameForSingle =
        viewMode === 'single' &&
        selectedSiteId &&
        selectedSiteId !== 'all'
            ? (siteMetaById?.[normalizeSiteIdKey(selectedSiteId)]?.name ??
                sites?.find((s) => normalizeSiteIdKey(s.id) === normalizeSiteIdKey(selectedSiteId))?.name ??
                null)
            : null;

    const scope1TableRows = hasToken
        ? scope1ListFiltered.slice(0, 5)
        : demoFilteredScope1Entries.slice(0, 5);
    const scope2TableRows = hasToken
        ? scope2ListFiltered.slice(0, 5)
        : demoFilteredScope2Entries.slice(0, 5);

    const recentActivitiesRows = hasToken
        ? apiEmissionsFilteredBySite.slice(0, 5).map((e) => {
            const siteName =
                getApiSiteName(e) ||
                getSiteDisplayName(e);
            return {
                id: e.id,
                source: e.activityType,
                date: e.billingPeriodStart || e.calculatedAt,
                type: e.scope === 'SCOPE_1' ? 'scope1' : e.scope === 'SCOPE_2' ? 'scope2' : 'scope3',
                amount: kgToTonnes(e.co2e),
                dataSource: e.dataSource || '—',
                status: 'verified',
                siteId: getApiSiteId(e) ?? null,
                siteName: siteName || null,
            };
        })
        : (demoSiteFilterIds == null
            ? activities.slice(0, 5)
            : activities
                .filter((a) => {
                    if (a?.siteId == null) return false;
                    const set = new Set((demoSiteFilterIds || []).map(normalizeSiteIdKey).filter(Boolean));
                    return set.has(normalizeSiteIdKey(a.siteId));
                })
                .slice(0, 5)
        );

    return (
        <div className="dashboard-content">
            {/* Page Header */}
            <div className="page-header page-header-with-filter">
                <div>
                    <h1>Emissions Dashboard</h1>
                    <p>Track and monitor your organization's carbon footprint</p>
                </div>
                {hasToken && (
                    <span className="dashboard-filter-label">{periodLabel} – {filterYear}</span>
                )}
            </div>

            {/* Demo-only: Single site vs multi-site compare */}
            {showSiteControls && (
                <div className="dashboard-site-compare-controls">
                    <div className="dashboard-view-mode-bar" role="tablist" aria-label="Site view mode">
                        <button
                            type="button"
                            className={`dashboard-view-mode-btn${viewMode === 'all' ? ' active' : ''}`}
                            onClick={() => {
                                setViewMode('all');
                                setSelectedSiteId('all');
                                setCompareSiteIds([]);
                            }}
                            role="tab"
                            aria-selected={viewMode === 'all'}
                        >
                            All Sites
                        </button>
                        <button
                            type="button"
                            className={`dashboard-view-mode-btn${viewMode === 'single' ? ' active' : ''}`}
                            onClick={() => setViewMode('single')}
                            role="tab"
                            aria-selected={viewMode === 'single'}
                        >
                            Single Site
                        </button>
                        <button
                            type="button"
                            className={`dashboard-view-mode-btn${viewMode === 'compare' ? ' active' : ''}`}
                            onClick={() => setViewMode('compare')}
                            role="tab"
                            aria-selected={viewMode === 'compare'}
                        >
                            Compare Sites
                        </button>
                    </div>

                    {viewMode === 'single' && (
                        <div className="dashboard-site-selector-row">
                            <span className="dashboard-site-selector-label">Site</span>
                            <select
                                className="dashboard-site-selector"
                                value={selectedSiteId}
                                onChange={(e) => setSelectedSiteId(e.target.value)}
                                aria-label="Select site"
                            >
                                <option value="all">All Sites</option>
                                {sites.map((s) => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {viewMode === 'compare' && (
                        <>
                            <div className="dashboard-compare-chips">
                                {sites.map((s) => {
                                    const selected = compareSiteIds.includes(s.id);
                                    const color = siteMetaById?.[s.id]?.color ?? SITE_COLORS[0];
                                    return (
                                        <button
                                            key={s.id}
                                            type="button"
                                            className={`dashboard-compare-chip${selected ? ' selected' : ''}`}
                                            style={{
                                                borderColor: selected ? 'transparent' : color,
                                                background: selected ? color : 'transparent',
                                                color: selected ? '#fff' : '#334155',
                                            }}
                                            onClick={() => {
                                                setCompareSiteIds((prev) => {
                                                    const isSelected = prev.includes(s.id);
                                                    if (isSelected) {
                                                        // keep at least 2 selected when possible
                                                        if (prev.length <= 2) return prev;
                                                        return prev.filter((id) => id !== s.id);
                                                    }
                                                    if (prev.length >= 3) return prev;
                                                    return [...prev, s.id];
                                                });
                                            }}
                                            aria-pressed={selected}
                                        >
                                            <span className="dashboard-compare-chip-dot" style={{ background: selected ? '#fff' : color }} />
                                            {s.name}
                                        </button>
                                    );
                                })}
                            </div>
                            {compareSiteIds.length < 2 && (
                                <div className="dashboard-compare-hint">
                                    Select <strong>at least 2</strong> sites to compare.
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}

            {/* Date Filter */}
            {hasToken && (
                <div className="dashboard-date-filter">
                    <div className="date-filter-row date-filter-main">
                        <div className="date-filter-year-wrap">
                            <select
                                className="date-filter-year"
                                value={filterYear}
                                onChange={(e) => setFilterYear(Number(e.target.value))}
                                aria-label="Select year"
                            >
                                {years.map((y) => (
                                    <option key={y} value={y}>{y}</option>
                                ))}
                            </select>
                            <i className="fas fa-chevron-down date-filter-year-arrow" aria-hidden></i>
                        </div>
                        <button type="button" className="btn btn-calendar-view" aria-pressed={calendarModalOpen} onClick={openCalendarModal}>
                            <i className="fas fa-calendar-alt"></i>
                            Calendar View
                        </button>
                    </div>
                    <div className="date-filter-row date-filter-months">
                        {MONTHS.map((month, idx) => {
                            const monthKey = `${filterYear}-${String(idx + 1).padStart(2, '0')}`;
                            const hasData = trendMonthsWithData.has(monthKey);
                            const isSelected = filterPeriod === idx || filterPeriod === String(idx) || (Array.isArray(filterPeriod) && filterPeriod.includes(idx));
                            return (
                                <button
                                    key={month}
                                    type="button"
                                    className={`date-filter-month ${isSelected ? 'active' : ''} ${hasData ? 'has-data' : ''}`}
                                    onClick={() => setFilterPeriod(idx)}
                                    title={month}
                                >
                                    {hasData && <span className="month-dot" aria-hidden></span>}
                                    {month}
                                </button>
                            );
                        })}
                    </div>
                    <div className="date-filter-row date-filter-period">
                        <button
                            type="button"
                            className={`date-filter-period-btn ${filterPeriod === 'all' ? 'active' : ''}`}
                            onClick={() => setFilterPeriod('all')}
                        >
                            All Time
                        </button>
                        {['Q1', 'Q2', 'Q3', 'Q4'].map((q) => (
                            <button
                                key={q}
                                type="button"
                                className={`date-filter-period-btn ${filterPeriod === q ? 'active' : ''}`}
                                onClick={() => setFilterPeriod(q)}
                            >
                                {q}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {calendarModalOpen && (
                <div className="calendar-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="calendar-modal-title">
                    <div className="calendar-modal">
                        <div className="calendar-modal-header">
                            <h2 id="calendar-modal-title">Select Month – {filterYear}</h2>
                            <button type="button" className="calendar-modal-close" onClick={() => setCalendarModalOpen(false)} aria-label="Close">
                                <i className="fas fa-times"></i>
                            </button>
                        </div>
                        <div className="calendar-modal-grid">
                            {MONTHS_FULL.map((name, idx) => {
                                const count = submissionsByMonth[idx] || 0;
                                const hasData = count > 0;
                                const isSelected = calendarSelectedMonths.includes(idx);
                                return (
                                    <button
                                        key={idx}
                                        type="button"
                                        className={`calendar-modal-month ${hasData ? 'has-data' : 'no-data'} ${isSelected ? 'selected' : ''}`}
                                        onClick={() => toggleCalendarMonth(idx)}
                                    >
                                        <span className="calendar-modal-month-name">{name}</span>
                                        <span className="calendar-modal-month-count">
                                            {count > 0 ? `${count} submission${count !== 1 ? 's' : ''}` : 'No data'}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                        <div className="calendar-modal-footer">
                            <p>Chart will display filtered data based on selected period.</p>
                            <button type="button" className="btn btn-primary calendar-modal-apply" onClick={applyCalendarSelection}>
                                Apply
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {apiLoading && hasToken && (
                <div className="dashboard-loading">Loading dashboard…</div>
            )}
            {apiError && hasToken && (
                <div className="dashboard-error">{apiError}</div>
            )}
            {deleteError && (
                <div className="dashboard-error dashboard-delete-error">
                    {deleteError}
                    <button type="button" className="dashboard-error-dismiss" onClick={() => setDeleteError(null)} aria-label="Dismiss">×</button>
                </div>
            )}

            {fromSubmit && (
                <div className="dashboard-submit-banner" role="alert">
                    <i className="fas fa-check-circle"></i>
                    <div>
                        <strong>Submission saved</strong>
                        <p>{submitMessage || 'Your emission(s) have been calculated and saved. Data below includes your latest submission.'}</p>
                    </div>
                </div>
            )}

            {/* Summary Cards */}
            <div className="summary-cards">
                <div className="card summary-card total">
                    <div className="card-content">
                        <h3>Total Emissions</h3>
                        <div className="value">
                            {formatNumber(totalEmissions)}
                            <span className="unit">tCO₂e</span>
                        </div>
                        {apiDashboard?.emissions?.trend?.length > 1 && (
                            <div className="trend down">
                                <i className="fas fa-chart-line"></i>
                                <span>Last 12 months</span>
                            </div>
                        )}
                    </div>
                    <div className="card-icon">
                        <i className="fas fa-cloud"></i>
                    </div>
                </div>

                <div className="card summary-card scope1">
                    <div className="card-content">
                        <h3>Scope 1 Emissions</h3>
                        <div className="value">
                            {formatNumber(scope1Total)}
                            <span className="unit">tCO₂e</span>
                        </div>
                    </div>
                    <div className="card-icon">
                        <i className="fas fa-fire"></i>
                    </div>
                </div>

                <div className="card summary-card scope2">
                    <div className="card-content">
                        <h3>Scope 2 Emissions</h3>
                        <div className="value">
                            {formatNumber(scope2Total)}
                            <span className="unit">tCO₂e</span>
                        </div>
                    </div>
                    <div className="card-icon">
                        <i className="fas fa-bolt"></i>
                    </div>
                </div>

            </div>

            {/* Charts Section */}
            <div className="charts-section">
                {/* Monthly Emission Trend */}
                <div className="card chart-card trend-chart">
                    <div className="card-header">
                        <h2>
                            <i className={`fas ${showSiteControls && viewMode === 'compare' ? 'fa-chart-bar' : 'fa-chart-line'}`}></i>
                            {showSiteControls && viewMode === 'compare' ? 'Monthly Emissions Trend (Compare Sites)' : 'Monthly Emission Trend'}
                        </h2>
                        {showSiteControls && viewMode === 'compare' ? (
                            <div className="chart-legend-inline">
                                {Array.from(new Set(compareSiteIds)).map((siteId) => (
                                    <div key={siteId} className="legend-item">
                                        <span
                                            className="legend-color"
                                            style={{ background: siteMetaById?.[siteId]?.color ?? SITE_COLORS[0] }}
                                        ></span>
                                        <span>{siteMetaById?.[siteId]?.name ?? siteId}</span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="chart-legend-inline">
                                <div className="legend-item">
                                    <span className="legend-color scope1-color"></span>
                                    <span>Scope 1</span>
                                </div>
                                <div className="legend-item">
                                    <span className="legend-color scope2-color"></span>
                                    <span>Scope 2</span>
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="chart-container">
                        {showSiteControls && viewMode === 'compare' ? (
                            compareBarChartData ? (
                                <Bar data={compareBarChartData} options={barChartOptions} />
                            ) : (
                                <div className="dashboard-chart-empty">
                                    Select 2–3 sites to compare.
                                </div>
                            )
                        ) : (
                            <Line data={lineChartData} options={lineChartOptions} />
                        )}
                    </div>
                </div>

                {/* Scope 1 Breakdown */}
                <div className="card chart-card">
                    <div className="card-header">
                        <h2>
                            <i className="fas fa-fire"></i>
                            Scope 1 Breakdown
                        </h2>
                    </div>
                    <div className="doughnut-container">
                        <div className="doughnut-wrapper">
                            <Doughnut data={scope1DoughnutData} options={doughnutOptions} />
                        </div>
                        <div className="chart-legend">
                            <div className="legend-item">
                                <span className="legend-color" style={{ background: '#14B8A6' }}></span>
                                <span>Mobile Combustion</span>
                            </div>
                            <div className="legend-item">
                                <span className="legend-color" style={{ background: '#0D9488' }}></span>
                                <span>Stationary Combustion</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Scope 2 Breakdown */}
                <div className="card chart-card">
                    <div className="card-header">
                        <h2>
                            <i className="fas fa-bolt"></i>
                            Scope 2 Breakdown
                        </h2>
                    </div>
                    <div className="doughnut-container">
                        <div className="doughnut-wrapper">
                            <Doughnut data={scope2DoughnutData} options={doughnutOptions} />
                        </div>
                        <div className="chart-legend">
                            <div className="legend-item">
                                <span className="legend-color" style={{ background: '#3B82F6' }}></span>
                                <span>Purchased Electricity</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Site Performance */}
            <div className="card site-performance-card">
                <div className="card-header">
                    <h2>
                        <i className="fas fa-chart-bar"></i>
                        Site Performance
                    </h2>
                    <span className="site-performance-sub">Total tCO2e</span>
                </div>
                <div className="site-performance-body">
                    {sitePerformanceRows.length ? (
                        sitePerformanceRows.map((r, idx) => {
                            const pct = (r.total / sitePerformanceMax) * 100;
                            return (
                                <div key={r.siteId} className="site-perf-row">
                                    <div className={`site-perf-rank${idx === 0 ? ' first' : ''}`}>{idx + 1}</div>
                                    <div className="site-perf-site">{r.siteName}</div>
                                    <div className="site-perf-bar-wrap">
                                        <div
                                            className="site-perf-bar"
                                            style={{ width: `${pct}%`, background: r.color }}
                                        />
                                    </div>
                                    <div className="site-perf-val">{formatNumber(r.total)} t</div>
                                </div>
                            );
                        })
                    ) : (
                        <div className="site-performance-empty">No site performance data available.</div>
                    )}
                </div>
            </div>

            {/* Detailed Sections */}
            <div className="detailed-sections">
                {/* Scope 1 Details */}
                <div className="card detail-card">
                    <div className="card-header">
                        <h2>
                            <i className="fas fa-fire"></i>
                            Scope 1 Details
                        </h2>
                        <span className="info-badge">
                            <i className="fas fa-info-circle"></i>
                            Direct emissions
                        </span>
                    </div>
                    <div className="detail-table">
                        <table>
                            <thead>
                                <tr>
                                    {hasToken && <th style={{ width: '2.5rem' }}>
                                        <input
                                            type="checkbox"
                                            aria-label="Select all Scope 1 rows"
                                            checked={
                                                scope1TableRows.length > 0 &&
                                                scope1TableRows.every((entry) => entry.id && selectedEmissionIds.includes(entry.id))
                                            }
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    const ids = scope1TableRows.map((entry) => entry.id).filter(Boolean);
                                                    setSelectedEmissionIds((prev) => Array.from(new Set([...prev, ...ids])));
                                                } else {
                                                    setSelectedEmissionIds((prev) =>
                                                        prev.filter((id) => !scope1TableRows.some((entry) => entry.id === id))
                                                    );
                                                }
                                            }}
                                        />
                                    </th>}
                                    <th>Source</th>
                                    <th>Amount</th>
                                    <th>Emissions</th>
                                    <th>Data source</th>
                                    {showSiteColumn && <th>Site</th>}
                                    <th>Status</th>
                                    {hasToken && <th className="th-actions">Actions</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {scope1TableRows.map((entry, index) => {
                                    const isApi = entry.activityType != null;
                                    const source = isApi ? entry.activityType : entry.fuelType;
                                    const amount = isApi ? entry.activityAmount : entry.amount;
                                    const unit = isApi ? entry.activityUnit : entry.unit;
                                    const emissions = isApi ? kgToTonnes(entry.co2e) : (entry.emissions || 0);
                                    const pct = scope1Total > 0 ? (emissions / scope1Total) * 100 : 0;
                                    const dataSource = isApi && entry.dataSource ? entry.dataSource : '—';
                                    return (
                                        <tr key={entry.id || index}>
                                            {hasToken && (
                                                <td>
                                                    {entry.id && (
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedEmissionIds.includes(entry.id)}
                                                            onChange={() => toggleEmissionSelected(entry.id)}
                                                            aria-label="Select this emission"
                                                        />
                                                    )}
                                                </td>
                                            )}
                                            <td>
                                                <i className="fas fa-fire"></i>
                                                {source}
                                            </td>
                                            <td>{formatNumber(amount)} {unit}</td>
                                            <td>
                                                <span className="mini-bar">
                                                    <span className="mini-progress" style={{ width: `${pct}%` }}></span>
                                                </span>
                                                {formatNumber(emissions)} tCO₂e
                                            </td>
                                            <td><span className="source-badge">{dataSource}</span></td>
                                            {showSiteColumn && (
                                                <td>
                                                    <span className="site-pill">
                                                        <span
                                                            className="site-pill-dot"
                                                            style={{
                                                                background:
                                                                    siteMetaById?.[getApiSiteId(entry)]?.color ??
                                                                    SITE_COLORS[0],
                                                            }}
                                                        />
                                                    <span className="site-pill-text">
                                                        {selectedSiteNameForSingle ?? getSiteDisplayName(entry)}
                                                    </span>
                                                    </span>
                                                </td>
                                            )}
                                            <td>
                                                <span className="status-badge verified">verified</span>
                                            </td>
                                            {hasToken && (
                                                <td className="td-actions">
                                                    {entry.id ? (
                                                        <button
                                                            type="button"
                                                            className="btn-icon btn-delete"
                                                            onClick={() => handleDeleteEmission(entry.id)}
                                                            disabled={deletingId === entry.id}
                                                            title="Delete this record"
                                                            aria-label="Delete"
                                                        >
                                                            {deletingId === entry.id ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-trash-alt"></i>}
                                                        </button>
                                                    ) : null}
                                                </td>
                                            )}
                                        </tr>
                                    );
                                })}
                            </tbody>
                            <tfoot>
                                <tr>
                                    <td colSpan={hasToken ? 2 : 4}><strong>Total Scope 1</strong></td>
                                    <td colSpan={hasToken ? 4 : 2}><strong>{formatNumber(scope1Total)} tCO₂e</strong></td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>

                {/* Scope 2 Details */}
                <div className="card detail-card">
                    <div className="card-header">
                        <h2>
                            <i className="fas fa-bolt"></i>
                            Scope 2 Details
                        </h2>
                        <span className="info-badge">
                            <i className="fas fa-info-circle"></i>
                            Indirect emissions
                        </span>
                    </div>
                    <div className="detail-table">
                        <table>
                            <thead>
                                <tr>
                                    {hasToken && <th style={{ width: '2.5rem' }}>
                                        <input
                                            type="checkbox"
                                            aria-label="Select all Scope 2 rows"
                                            checked={
                                                scope2TableRows.length > 0 &&
                                                scope2TableRows.every((entry) => entry.id && selectedEmissionIds.includes(entry.id))
                                            }
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    const ids = scope2TableRows.map((entry) => entry.id).filter(Boolean);
                                                    setSelectedEmissionIds((prev) => Array.from(new Set([...prev, ...ids])));
                                                } else {
                                                    setSelectedEmissionIds((prev) =>
                                                        prev.filter((id) => !scope2TableRows.some((entry) => entry.id === id))
                                                    );
                                                }
                                            }}
                                        />
                                    </th>}
                                    <th>Source</th>
                                    <th>Amount</th>
                                    <th>Emissions</th>
                                    <th>Data source</th>
                                    {showSiteColumn && <th>Site</th>}
                                    <th>Status</th>
                                    {hasToken && <th className="th-actions">Actions</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {scope2TableRows.map((entry, index) => {
                                    const isApi = entry.activityType != null;
                                    const source = isApi ? entry.activityType : (entry.supplier || 'Electricity');
                                    const amount = isApi ? entry.activityAmount : entry.electricity;
                                    const unit = isApi ? entry.activityUnit : entry.unit;
                                    const emissions = isApi ? kgToTonnes(entry.co2e) : (entry.emissions || 0);
                                    const pct = scope2Total > 0 ? (emissions / scope2Total) * 100 : 0;
                                    const dataSource = isApi && entry.dataSource ? entry.dataSource : '—';
                                    return (
                                        <tr key={entry.id || index}>
                                            {hasToken && (
                                                <td>
                                                    {entry.id && (
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedEmissionIds.includes(entry.id)}
                                                            onChange={() => toggleEmissionSelected(entry.id)}
                                                            aria-label="Select this emission"
                                                        />
                                                    )}
                                                </td>
                                            )}
                                            <td>
                                                <i className="fas fa-plug"></i>
                                                {source}
                                            </td>
                                            <td>{formatNumber(amount)} {unit}</td>
                                            <td>
                                                <span className="mini-bar">
                                                    <span className="mini-progress scope2-bg" style={{ width: `${pct}%` }}></span>
                                                </span>
                                                {formatNumber(emissions)} tCO₂e
                                            </td>
                                            <td><span className="source-badge">{dataSource}</span></td>
                                            {showSiteColumn && (
                                                <td>
                                                    <span className="site-pill">
                                                        <span
                                                            className="site-pill-dot"
                                                            style={{
                                                                background:
                                                                    siteMetaById?.[getApiSiteId(entry)]?.color ??
                                                                    SITE_COLORS[0],
                                                            }}
                                                        />
                                                    <span className="site-pill-text">
                                                        {selectedSiteNameForSingle ?? getSiteDisplayName(entry)}
                                                    </span>
                                                    </span>
                                                </td>
                                            )}
                                            <td>
                                                <span className="status-badge verified">verified</span>
                                            </td>
                                            {hasToken && (
                                                <td className="td-actions">
                                                    {entry.id ? (
                                                        <button
                                                            type="button"
                                                            className="btn-icon btn-delete"
                                                            onClick={() => handleDeleteEmission(entry.id)}
                                                            disabled={deletingId === entry.id}
                                                            title="Delete this record"
                                                            aria-label="Delete"
                                                        >
                                                            {deletingId === entry.id ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-trash-alt"></i>}
                                                        </button>
                                                    ) : null}
                                                </td>
                                            )}
                                        </tr>
                                    );
                                })}
                            </tbody>
                            <tfoot>
                                <tr>
                                    <td colSpan={hasToken ? 2 : 4}><strong>Total Scope 2</strong></td>
                                    <td colSpan={hasToken ? 4 : 2}><strong>{formatNumber(scope2Total)} tCO₂e</strong></td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            </div>

            {/* Recent Activities */}
                <div className="card facility-card">
                <div className="card-header">
                    <h2>
                        <i className="fas fa-history"></i>
                        Recent Activities
                    </h2>
                </div>
                <div className="facility-table-wrapper">
                    <table className="facility-table">
                        <thead>
                            <tr>
                                {hasToken && <th style={{ width: '2.5rem' }}>
                                    <input
                                        type="checkbox"
                                        aria-label="Select all recent activity rows"
                                        checked={
                                            recentActivitiesRows.length > 0 &&
                                            recentActivitiesRows.every((activity) => activity.id && selectedEmissionIds.includes(activity.id))
                                        }
                                        onChange={(e) => {
                                            if (e.target.checked) {
                                                const ids = recentActivitiesRows.map((a) => a.id).filter(Boolean);
                                                setSelectedEmissionIds((prev) => Array.from(new Set([...prev, ...ids])));
                                            } else {
                                                setSelectedEmissionIds((prev) =>
                                                    prev.filter((id) => !recentActivitiesRows.some((a) => a.id === id))
                                                );
                                            }
                                        }}
                                    />
                                </th>}
                                <th>Source</th>
                                <th>Date</th>
                                <th>Type</th>
                                <th>Emissions</th>
                                <th>Data source</th>
                                {showSiteColumn && <th>Site</th>}
                                <th>Status</th>
                                {hasToken && <th className="th-actions">Actions</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {recentActivitiesRows.map((activity, index) => (
                                <tr key={activity.id || index}>
                                    {hasToken && (
                                        <td>
                                            {activity.id && (
                                                <input
                                                    type="checkbox"
                                                    checked={selectedEmissionIds.includes(activity.id)}
                                                    onChange={() => toggleEmissionSelected(activity.id)}
                                                    aria-label="Select this emission"
                                                />
                                            )}
                                        </td>
                                    )}
                                    <td>{activity.source}</td>
                                    <td>{activity.date ? formatDate(activity.date) : '—'}</td>
                                    <td>
                                        <span className={`type-badge ${activity.type}`}>
                                            {activity.type === 'scope1' ? 'Scope 1' : activity.type === 'scope2' ? 'Scope 2' : 'Scope 3'}
                                        </span>
                                    </td>
                                    <td>{formatNumber(activity.amount)} tCO₂e</td>
                                    <td><span className="source-badge">{activity.dataSource || '—'}</span></td>
                                    {showSiteColumn && (
                                        <td>
                                            <span className="site-pill">
                                                <span
                                                    className="site-pill-dot"
                                                    style={{ background: siteMetaById?.[activity.siteId]?.color ?? SITE_COLORS[0] }}
                                                />
                                            <span className="site-pill-text">
                                                {selectedSiteNameForSingle ?? activity.siteName ?? activity.siteId ?? '—'}
                                            </span>
                                            </span>
                                        </td>
                                    )}
                                    <td>
                                        <span className="status-badge verified">verified</span>
                                    </td>
                                    {hasToken && (
                                        <td className="td-actions">
                                            {activity.id ? (
                                                <button
                                                    type="button"
                                                    className="btn-icon btn-delete"
                                                    onClick={() => handleDeleteEmission(activity.id)}
                                                    disabled={deletingId === activity.id}
                                                    title="Delete this record"
                                                    aria-label="Delete"
                                                >
                                                    {deletingId === activity.id ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-trash-alt"></i>}
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
                        disabled={!selectedEmissionIds.length || deletingId === 'bulk'}
                        onClick={handleBulkDelete}
                        title={selectedEmissionIds.length ? `Delete ${selectedEmissionIds.length} selected record(s)` : 'Select records to enable'}
                    >
                        {deletingId === 'bulk' ? (
                            <>
                                <i className="fas fa-spinner fa-spin"></i> Deleting…
                            </>
                        ) : (
                            <>
                                <i className="fas fa-trash-alt"></i> Delete selected
                            </>
                        )}
                    </button>
                    {selectedEmissionIds.length > 0 && (
                        <span className="dashboard-bulk-count">
                            {selectedEmissionIds.length} selected
                        </span>
                    )}
                </div>
            )}

            {/* Footer */}
            <div className="dashboard-footer">
                <p>Data last updated: {new Date().toLocaleString()}</p>
                <p>URIMPACT Carbon Emission Dashboard v1.0</p>
            </div>
        </div>
    );
}

export default Dashboard;

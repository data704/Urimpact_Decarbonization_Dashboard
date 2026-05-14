import { useEffect, useRef, useState, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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
import { useDataStore } from '../../context/DataStoreContext';
import { getAuthToken, getDashboard, getEmissions, deleteEmission, deleteEmissionsBulk, getRecentActivity } from '../../api/client';
import './Dashboard.css';

const kgToTonnes = (kg) => (kg == null ? 0 : kg / 1000);

/** Stored Climatiq / local fallback snapshot — show factor name or activity id on dashboard. */
function emissionCalculationCaption(entry) {
    const snap = entry?.calculationSnapshot;
    if (!snap || typeof snap !== 'object') return null;
    if (snap.provider === 'climatiq') {
        const ef = snap.response?.emission_factor;
        if (ef && typeof ef === 'object') {
            if (typeof ef.name === 'string' && ef.name.trim()) return ef.name.trim();
            if (typeof ef.activity_id === 'string' && ef.activity_id.trim()) return ef.activity_id.trim();
        }
    }
    if (snap.provider === 'local_fallback' && typeof snap.matchedSource === 'string') {
        return snap.matchedSource;
    }
    return null;
}

function humanDataEntryChannel(ch, t) {
    if (!ch) return '';
    if (ch === 'FORM') return t('dashboard.channelForm');
    if (ch === 'BULK_UPLOAD') return t('dashboard.channelBulk');
    if (ch === 'AI_EXTRACT') return t('dashboard.channelAi');
    return String(ch);
}

function renderEmissionSourceCell(entry, dataSource, t) {
    const cap = emissionCalculationCaption(entry);
    const metaParts = [];
    if (entry.dataEntryChannel) metaParts.push(humanDataEntryChannel(entry.dataEntryChannel, t));
    if (entry.ghgCategorySlug) metaParts.push(String(entry.ghgCategorySlug).replace(/-/g, ' '));
    return (
        <td>
            <span className="source-badge">{dataSource}</span>
            {cap ? <div className="dashboard-calc-detail">{cap}</div> : null}
            {metaParts.length > 0 ? <div className="dashboard-emission-meta">{metaParts.join(' · ')}</div> : null}
        </td>
    );
}

function monthLabelsShort(locale) {
    return Array.from({ length: 12 }, (_, i) =>
        new Date(2000, i, 1).toLocaleDateString(locale, { month: 'short' })
    );
}
function monthLabelsLong(locale) {
    return Array.from({ length: 12 }, (_, i) =>
        new Date(2000, i, 1).toLocaleDateString(locale, { month: 'long' })
    );
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
    const { t, i18n } = useTranslation();
    const location = useLocation();
    const { 
        scope1Entries, 
        scope2Entries, 
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
    const dateLocale = i18n.language === 'ar' ? 'ar-SA' : 'en-US';
    const monthsShort = useMemo(() => monthLabelsShort(dateLocale), [dateLocale]);
    const monthsLong = useMemo(() => monthLabelsLong(dateLocale), [dateLocale]);
    const [filterYear, setFilterYear] = useState(currentYear);
    const [filterPeriod, setFilterPeriod] = useState('all'); // 'all' | 'Q1' | 'Q2' | 'Q3' | 'Q4' | 0-11 | number[] for calendar multi-select

    const [calendarModalOpen, setCalendarModalOpen] = useState(false);
    const [calendarYearEmissions, setCalendarYearEmissions] = useState([]);
    const [calendarSelectedMonths, setCalendarSelectedMonths] = useState([]);

    // Recent activity feed (who did what)
    const [activityLogs, setActivityLogs] = useState([]);
    const [activityError, setActivityError] = useState(null);

    const hasToken = Boolean(getAuthToken());

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
                    setApiError(err?.message || t('dashboard.failedToLoad'));
                    setApiDashboard(null);
                    setApiEmissions([]);
                }
            })
            .finally(() => {
                if (!cancelled) setApiLoading(false);
            });
        return () => { cancelled = true; };
    }, [hasToken, location.pathname, location.key, dateRange, t]);

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
    }, [hasToken, fromSubmit, location.key]);

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
                setApiError(err?.message || t('dashboard.failedToLoad'));
            })
            .finally(() => setApiLoading(false));
    };

    const periodLabel = filterPeriod === 'all'
        ? t('dashboard.allTime')
        : Array.isArray(filterPeriod) && filterPeriod.length > 0
            ? (filterPeriod.length === 12 ? t('dashboard.allTime') : `${monthsShort[filterPeriod[0]]} ${t('dashboard.dash')} ${monthsShort[filterPeriod[filterPeriod.length - 1]]}`)
            : (filterPeriod === 'Q1' || filterPeriod === 'Q2' || filterPeriod === 'Q3' || filterPeriod === 'Q4')
                ? t(`dashboard.quarter${filterPeriod}`)
                : monthsShort[typeof filterPeriod === 'number' ? filterPeriod : parseInt(String(filterPeriod), 10) || 0];
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
            setDeleteError(err?.message || t('dashboard.failedToDelete'));
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
            setDeleteError(err?.message || t('dashboard.failedToDeleteBulk'));
        } finally {
            setDeletingId(null);
        }
    };

    const scope1List = useMemo(() => apiEmissions.filter((e) => e.scope === 'SCOPE_1'), [apiEmissions]);
    const scope2List = useMemo(() => apiEmissions.filter((e) => e.scope === 'SCOPE_2'), [apiEmissions]);

    const totalEmissions = apiDashboard?.emissions?.total?.totalCo2eTonnes ?? getTotalEmissions();
    const scope1Total = apiDashboard?.emissions?.byScope?.SCOPE_1?.totalTonnes ?? getTotalScope1();
    const scope2Total = apiDashboard?.emissions?.byScope?.SCOPE_2?.totalTonnes ?? getTotalScope2();
    const scope3Total =
        apiDashboard?.emissions?.byScope?.SCOPE_3?.totalTonnes ??
        (hasToken && apiEmissions.length
            ? apiEmissions.filter((e) => e.scope === 'SCOPE_3').reduce((s, e) => s + kgToTonnes(e.co2e), 0)
            : 0);

    const monthlyData = useMemo(() => {
        if (apiDashboard?.emissions?.trend?.length) {
            const trend = apiDashboard.emissions.trend;
            const labels = trend.map((t) => monthsShort[parseInt(t.month.slice(5, 7), 10) - 1]);
            const scope1Data = trend.map((t) => kgToTonnes(t.scope1 || 0));
            const scope2Data = trend.map((t) => kgToTonnes(t.scope2 || 0));
            return { labels, scope1: scope1Data, scope2: scope2Data };
        }
        const fromStore = getMonthlyData();
        return {
            labels: monthsShort,
            scope1: fromStore.scope1,
            scope2: fromStore.scope2,
        };
    }, [apiDashboard, getMonthlyData, monthsShort]);

    const scope1Breakdown = useMemo(() => {
        if (scope1List.length) {
            const byCat = {};
            scope1List.forEach((e) => {
                const label = e.category?.replace(/_/g, ' ') ?? t('dashboard.other');
                byCat[label] = (byCat[label] || 0) + kgToTonnes(e.co2e);
            });
            return Object.keys(byCat).length ? byCat : { [t('dashboard.noData')]: 0 };
        }
        const fromCtx = getScope1Breakdown();
        const mapped = {};
        Object.entries(fromCtx).forEach(([k, v]) => {
            let nk = k;
            if (k === 'Mobile Combustion') nk = t('dashboard.mobileCombustion');
            else if (k === 'Stationary Combustion') nk = t('dashboard.stationaryCombustion');
            mapped[nk] = v;
        });
        return mapped;
    }, [scope1List, getScope1Breakdown, t, i18n.language]);

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
                label: t('dashboard.chartDatasetScope1'),
                data: monthlyData.scope1,
                borderColor: '#14B8A6',
                backgroundColor: 'rgba(20, 184, 166, 0.1)',
                fill: true,
                tension: 0.4
            },
            {
                label: t('dashboard.chartDatasetScope2'),
                data: monthlyData.scope2,
                borderColor: '#3B82F6',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                fill: true,
                tension: 0.4
            }
        ]
    };

    const scope1Labels = Object.keys(scope1Breakdown);
    const scope1Values = Object.values(scope1Breakdown);
    const scope1Colors = ['#14B8A6', '#0D9488', '#0F766E', '#115E59', '#134E4A'].slice(0, Math.max(scope1Labels.length, 1));
    const scope1DoughnutData = {
        labels: scope1Labels.length ? scope1Labels : [t('dashboard.noData')],
        datasets: [{
            data: scope1Values.length ? scope1Values : [0],
            backgroundColor: scope1Colors,
            borderWidth: 0
        }]
    };

    const scope2DoughnutData = {
        labels: [t('dashboard.purchasedElectricity')],
        datasets: [{
            data: [scope2Total],
            backgroundColor: ['#3B82F6'],
            borderWidth: 0
        }]
    };

    const formatNumber = (num) => {
        if (num == null || Number.isNaN(num)) return '0';
        return Number(num).toLocaleString(dateLocale, { maximumFractionDigits: 2 });
    };

    const formatDate = (dateStr) => {
        return new Date(dateStr).toLocaleDateString(dateLocale, {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    };

    const formatRelativeTime = (iso) => {
        if (!iso) return '';
        const d = new Date(iso);
        const sec = Math.floor((Date.now() - d.getTime()) / 1000);
        if (sec < 60) return t('dashboard.relativeJustNow');
        if (sec < 3600) return t('dashboard.relativeMinutes', { n: Math.floor(sec / 60) });
        if (sec < 86400) return t('dashboard.relativeHours', { n: Math.floor(sec / 3600) });
        if (sec < 172800) return t('dashboard.relativeYesterday');
        return t('dashboard.relativeDays', { n: Math.floor(sec / 86400) });
    };

    const scopeTrends = useMemo(() => {
        const trend = apiDashboard?.emissions?.trend;
        const compute = (getVal) => {
            if (!trend?.length || trend.length < 2) return null;
            const vals = trend.map((x) => getVal(x));
            const half = Math.floor(vals.length / 2) || 1;
            const a = vals.slice(0, half).reduce((s, v) => s + v, 0) / half;
            const b = vals.slice(half).reduce((s, v) => s + v, 0) / Math.max(1, vals.length - half);
            if (a <= 0) return null;
            const pct = ((b - a) / a) * 100;
            return {
                up: pct >= 0,
                text: t('dashboard.kpiTrendCompare', {
                    arrow: pct >= 0 ? '↑' : '↓',
                    pct: Math.abs(pct).toFixed(1),
                }),
            };
        };
        return {
            total: compute((x) => kgToTonnes((x.scope1 || 0) + (x.scope2 || 0) + (x.scope3 || 0))),
            s1: compute((x) => kgToTonnes(x.scope1 || 0)),
            s2: compute((x) => kgToTonnes(x.scope2 || 0)),
            s3: compute((x) => kgToTonnes(x.scope3 || 0)),
        };
    }, [apiDashboard, t]);

    const ghgDonutData = useMemo(() => {
        const s1 = Math.max(0, scope1Total);
        const s2 = Math.max(0, scope2Total);
        const s3 = Math.max(0, scope3Total);
        const sum = s1 + s2 + s3;
        if (sum <= 0) {
            return {
                labels: [t('dashboard.noData')],
                datasets: [{ data: [1], backgroundColor: ['#E2E8F0'], borderWidth: 0 }],
            };
        }
        return {
            labels: [t('dashboard.scope1'), t('dashboard.scope2'), t('dashboard.scope3')],
            datasets: [
                {
                    data: [s1, s2, s3],
                    backgroundColor: ['#14B8A6', '#2dd4bf', '#0f766e'],
                    borderWidth: 0,
                },
            ],
        };
    }, [scope1Total, scope2Total, scope3Total, t]);

    const ghgDonutOptions = useMemo(
        () => ({
            responsive: true,
            maintainAspectRatio: false,
            cutout: '68%',
            plugins: {
                legend: {
                    display: true,
                    position: 'bottom',
                    labels: { boxWidth: 12, padding: 14, color: '#475569', font: { size: 12 } },
                },
                tooltip: {
                    callbacks: {
                        label(ctx) {
                            const total = (ctx.dataset.data || []).reduce((a, b) => a + b, 0) || 1;
                            const v = Number(ctx.raw) || 0;
                            const pct = ((v / total) * 100).toFixed(1);
                            return `${ctx.label}: ${Number(v).toLocaleString(dateLocale, { maximumFractionDigits: 2 })} tCO₂e (${pct}%)`;
                        },
                    },
                },
            },
        }),
        [dateLocale]
    );

    const esgPillars = useMemo(
        () => [
            { key: 'env', label: t('dashboard.esgEnvironment'), value: 80, color: '#0d9488' },
            { key: 'soc', label: t('dashboard.esgSocial'), value: 75, color: '#14b8a6' },
            { key: 'gov', label: t('dashboard.esgGovernance'), value: 78, color: '#0f766e' },
            { key: 'all', label: t('dashboard.esgOverall'), value: 78, color: '#115e59' },
        ],
        [t]
    );

    const auditActivityItems = useMemo(() => {
        if (!activityLogs?.length) return [];
        return activityLogs.slice(0, 8).map((log) => {
            const who = log.user
                ? `${log.user.firstName || ''} ${log.user.lastName || ''}`.trim() || log.user.email
                : t('header.system');
            const action = String(log.action || 'activity').replace(/_/g, ' ');
            const res = log.resource ? ` · ${log.resource}` : '';
            return {
                id: log.id,
                icon: 'fas fa-circle-notch',
                title: `${action}${res}`,
                meta: who,
                time: formatRelativeTime(log.timestamp),
            };
        });
    }, [activityLogs, t]);

    const upcomingTasks = useMemo(
        () => [
            { id: 't1', title: t('dashboard.taskScope3Goods'), days: 2, urgent: true },
            { id: 't2', title: t('dashboard.taskGapAnalysis'), days: 5, urgent: false },
            { id: 't3', title: t('dashboard.taskReviewData'), days: 7, urgent: false },
        ],
        [t]
    );

    const scope1TableRows = hasToken && apiEmissions.length ? scope1List.slice(0, 5) : scope1Entries.slice(0, 5);
    const scope2TableRows = hasToken && apiEmissions.length ? scope2List.slice(0, 5) : scope2Entries.slice(0, 5);

    return (
        <div className="dashboard-content dashboard-content--v2">
            <div className="page-header page-header-with-filter">
                <div>
                    <h1>{t('dashboard.heroTitle')}</h1>
                    <p>{t('dashboard.heroSubtitle')}</p>
                </div>
                {hasToken && (
                    <span className="dashboard-filter-label">{periodLabel} {t('dashboard.dash')} {filterYear}</span>
                )}
            </div>

            {hasToken && (
                <details className="dashboard-filters-details">
                    <summary>{t('dashboard.filtersSummary')}</summary>
                <div className="dashboard-date-filter">
                    <div className="date-filter-row date-filter-main">
                        <div className="date-filter-year-wrap">
                            <select
                                className="date-filter-year"
                                value={filterYear}
                                onChange={(e) => setFilterYear(Number(e.target.value))}
                                aria-label={t('dashboard.selectYear')}
                            >
                                {years.map((y) => (
                                    <option key={y} value={y}>{y}</option>
                                ))}
                            </select>
                            <i className="fas fa-chevron-down date-filter-year-arrow" aria-hidden></i>
                        </div>
                        <button type="button" className="btn btn-calendar-view" aria-pressed={calendarModalOpen} onClick={openCalendarModal}>
                            <i className="fas fa-calendar-alt"></i>
                            {t('dashboard.calendarView')}
                        </button>
                    </div>
                    <div className="date-filter-row date-filter-months">
                        {monthsShort.map((month, idx) => {
                            const monthKey = `${filterYear}-${String(idx + 1).padStart(2, '0')}`;
                            const hasData = trendMonthsWithData.has(monthKey);
                            const isSelected = filterPeriod === idx || filterPeriod === String(idx) || (Array.isArray(filterPeriod) && filterPeriod.includes(idx));
                            return (
                                <button
                                    key={idx}
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
                            {t('dashboard.allTime')}
                        </button>
                        {['Q1', 'Q2', 'Q3', 'Q4'].map((q) => (
                            <button
                                key={q}
                                type="button"
                                className={`date-filter-period-btn ${filterPeriod === q ? 'active' : ''}`}
                                onClick={() => setFilterPeriod(q)}
                            >
                                {t(`dashboard.quarter${q}`)}
                            </button>
                        ))}
                    </div>
                </div>
                </details>
            )}

            {calendarModalOpen && (
                <div className="calendar-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="calendar-modal-title">
                    <div className="calendar-modal">
                        <div className="calendar-modal-header">
                            <h2 id="calendar-modal-title">{t('dashboard.calendarSelectMonth', { year: filterYear })}</h2>
                            <button type="button" className="calendar-modal-close" onClick={() => setCalendarModalOpen(false)} aria-label={t('dashboard.closeModal')}>
                                <i className="fas fa-times"></i>
                            </button>
                        </div>
                        <div className="calendar-modal-grid">
                            {monthsLong.map((name, idx) => {
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
                                            {count > 0
                                                ? (count === 1
                                                    ? t('dashboard.calendarSubmissionSingle', { count })
                                                    : t('dashboard.calendarSubmissionPlural', { count }))
                                                : t('dashboard.calendarNoData')}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                        <div className="calendar-modal-footer">
                            <p>{t('dashboard.calendarHint')}</p>
                            <button type="button" className="btn btn-primary calendar-modal-apply" onClick={applyCalendarSelection}>
                                {t('dashboard.calendarApply')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {apiLoading && hasToken && (
                <div className="dashboard-loading">{t('dashboard.loading')}</div>
            )}
            {apiError && hasToken && (
                <div className="dashboard-error">{apiError}</div>
            )}
            {deleteError && (
                <div className="dashboard-error dashboard-delete-error">
                    {deleteError}
                    <button type="button" className="dashboard-error-dismiss" onClick={() => setDeleteError(null)} aria-label={t('dashboard.dismissError')}>×</button>
                </div>
            )}

            {fromSubmit && (
                <div className="dashboard-submit-banner" role="alert">
                    <i className="fas fa-check-circle"></i>
                    <div>
                        <strong>{t('dashboard.submissionSaved')}</strong>
                        <p>{submitMessage || t('dashboard.submissionSavedBody')}</p>
                    </div>
                </div>
            )}

            {/* KPI strip — mockup-aligned */}
            <div className="dashboard-kpi-row">
                <div className="dashboard-kpi-card dashboard-kpi-card--total">
                    <div className="dashboard-kpi-icon" aria-hidden>
                        <i className="fas fa-leaf" />
                    </div>
                    <div className="dashboard-kpi-body">
                        <span className="dashboard-kpi-label">{t('dashboard.kpiTotalGhg')}</span>
                        <div className="dashboard-kpi-value">
                            {formatNumber(totalEmissions)}
                            <span className="dashboard-kpi-unit">tCO₂e</span>
                        </div>
                        {scopeTrends.total && (
                            <span className={`dashboard-kpi-trend ${scopeTrends.total.up ? 'up' : 'down'}`}>
                                {scopeTrends.total.text}
                            </span>
                        )}
                    </div>
                </div>
                <div className="dashboard-kpi-card">
                    <div className="dashboard-kpi-icon dashboard-kpi-icon--s1" aria-hidden>
                        <i className="fas fa-industry" />
                    </div>
                    <div className="dashboard-kpi-body">
                        <span className="dashboard-kpi-label">{t('dashboard.kpiScope1')}</span>
                        <div className="dashboard-kpi-value">
                            {formatNumber(scope1Total)}
                            <span className="dashboard-kpi-unit">tCO₂e</span>
                        </div>
                        {scopeTrends.s1 && (
                            <span className={`dashboard-kpi-trend ${scopeTrends.s1.up ? 'up' : 'down'}`}>{scopeTrends.s1.text}</span>
                        )}
                    </div>
                </div>
                <div className="dashboard-kpi-card">
                    <div className="dashboard-kpi-icon dashboard-kpi-icon--s2" aria-hidden>
                        <i className="fas fa-bolt" />
                    </div>
                    <div className="dashboard-kpi-body">
                        <span className="dashboard-kpi-label">{t('dashboard.kpiScope2')}</span>
                        <div className="dashboard-kpi-value">
                            {formatNumber(scope2Total)}
                            <span className="dashboard-kpi-unit">tCO₂e</span>
                        </div>
                        {scopeTrends.s2 && (
                            <span className={`dashboard-kpi-trend ${scopeTrends.s2.up ? 'up' : 'down'}`}>{scopeTrends.s2.text}</span>
                        )}
                    </div>
                </div>
                <div className="dashboard-kpi-card">
                    <div className="dashboard-kpi-icon dashboard-kpi-icon--s3" aria-hidden>
                        <i className="fas fa-truck" />
                    </div>
                    <div className="dashboard-kpi-body">
                        <span className="dashboard-kpi-label">{t('dashboard.kpiScope3')}</span>
                        <div className="dashboard-kpi-value">
                            {formatNumber(scope3Total)}
                            <span className="dashboard-kpi-unit">tCO₂e</span>
                        </div>
                        {scopeTrends.s3 && (
                            <span className={`dashboard-kpi-trend ${scopeTrends.s3.up ? 'up' : 'down'}`}>{scopeTrends.s3.text}</span>
                        )}
                    </div>
                </div>
                <div className="dashboard-kpi-card">
                    <div className="dashboard-kpi-icon dashboard-kpi-icon--esg" aria-hidden>
                        <i className="fas fa-award" />
                    </div>
                    <div className="dashboard-kpi-body">
                        <span className="dashboard-kpi-label">{t('dashboard.kpiEsgScore')}</span>
                        <div className="dashboard-kpi-value">
                            78<span className="dashboard-kpi-unit muted">/100</span>
                        </div>
                        <span className="dashboard-kpi-trend up">{t('dashboard.esgTrendDemo')}</span>
                    </div>
                </div>
            </div>

            <div className="dashboard-mid-row">
                <div className="card dashboard-panel dashboard-panel--ghg">
                    <div className="dashboard-panel-head">
                        <h2>{t('dashboard.ghgSummaryTitle')}</h2>
                    </div>
                    <div className="dashboard-ghg-donut-wrap">
                        <div className="dashboard-ghg-donut-center">
                            <strong>{formatNumber(totalEmissions)}</strong>
                            <span>tCO₂e</span>
                        </div>
                        <div className="dashboard-ghg-donut-chart">
                            <Doughnut data={ghgDonutData} options={ghgDonutOptions} />
                        </div>
                    </div>
                </div>
                <div className="card dashboard-panel dashboard-panel--esg">
                    <div className="dashboard-panel-head">
                        <h2>{t('dashboard.esgSummaryTitle')}</h2>
                    </div>
                    <div className="dashboard-esg-gauges">
                        {esgPillars.map((p) => (
                            <div key={p.key} className="dashboard-gauge">
                                <div
                                    className="dashboard-gauge-ring"
                                    style={{
                                        background: `conic-gradient(${p.color} 0deg ${(p.value / 100) * 360}deg, #e2e8f0 ${(p.value / 100) * 360}deg 360deg)`,
                                    }}
                                >
                                    <div className="dashboard-gauge-inner">
                                        <span className="dashboard-gauge-value">{p.value}</span>
                                    </div>
                                </div>
                                <span className="dashboard-gauge-label">{p.label}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="dashboard-bottom-row">
                <div className="card dashboard-panel dashboard-panel--list">
                    <div className="dashboard-panel-head dashboard-panel-head--row">
                        <h2>{t('dashboard.recentActivities')}</h2>
                        <Link to="/notifications" className="dashboard-panel-link">
                            {t('dashboard.viewAllActivities')} <i className="fas fa-arrow-right" aria-hidden />
                        </Link>
                    </div>
                    {activityError && <p className="dashboard-list-muted">{activityError}</p>}
                    {!auditActivityItems.length && !activityError && (
                        <p className="dashboard-list-muted">{t('dashboard.activityEmpty')}</p>
                    )}
                    <ul className="dashboard-activity-list">
                        {auditActivityItems.map((item) => (
                            <li key={item.id} className="dashboard-activity-item">
                                <div className="dashboard-activity-icon" aria-hidden>
                                    <i className="fas fa-file-circle-plus" />
                                </div>
                                <div className="dashboard-activity-main">
                                    <p className="dashboard-activity-title">{item.title}</p>
                                    {item.meta && <p className="dashboard-activity-meta">{item.meta}</p>}
                                </div>
                                <span className="dashboard-activity-time">{item.time}</span>
                            </li>
                        ))}
                    </ul>
                </div>
                <div className="card dashboard-panel dashboard-panel--list">
                    <div className="dashboard-panel-head dashboard-panel-head--row">
                        <h2>{t('dashboard.upcomingTasks')}</h2>
                        <Link to="/data-input" className="dashboard-panel-link">
                            {t('dashboard.viewAllTasks')} <i className="fas fa-arrow-right" aria-hidden />
                        </Link>
                    </div>
                    <ul className="dashboard-task-list">
                        {upcomingTasks.map((task) => (
                            <li key={task.id} className="dashboard-task-item">
                                <input type="checkbox" className="dashboard-task-check" disabled aria-hidden />
                                <div className="dashboard-task-main">
                                    <p className="dashboard-task-title">{task.title}</p>
                                    <p className={task.urgent ? 'dashboard-task-due urgent' : 'dashboard-task-due'}>
                                        {t('dashboard.taskDueIn', { days: task.days })}
                                    </p>
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>

            <details className="dashboard-analytics-details">
                <summary>{t('dashboard.analyticsDetailsSummary')}</summary>
                <div className="dashboard-analytics-inner">

            {/* Charts Section */}
            <div className="charts-section">
                {/* Monthly Emission Trend */}
                <div className="card chart-card trend-chart">
                    <div className="card-header">
                        <h2>
                            <i className="fas fa-chart-line"></i>
                            {t('dashboard.monthlyTrend')}
                        </h2>
                        <div className="chart-legend-inline">
                            <div className="legend-item">
                                <span className="legend-color scope1-color"></span>
                                <span>{t('dashboard.chartDatasetScope1')}</span>
                            </div>
                            <div className="legend-item">
                                <span className="legend-color scope2-color"></span>
                                <span>{t('dashboard.chartDatasetScope2')}</span>
                            </div>
                        </div>
                    </div>
                    <div className="chart-container">
                        <Line data={lineChartData} options={lineChartOptions} />
                    </div>
                </div>

                {/* Scope 1 Breakdown */}
                <div className="card chart-card">
                    <div className="card-header">
                        <h2>
                            <i className="fas fa-fire"></i>
                            {t('dashboard.scope1Breakdown')}
                        </h2>
                    </div>
                    <div className="doughnut-container">
                        <div className="doughnut-wrapper">
                            <Doughnut data={scope1DoughnutData} options={doughnutOptions} />
                        </div>
                        <div className="chart-legend">
                            <div className="legend-item">
                                <span className="legend-color" style={{ background: '#14B8A6' }}></span>
                                <span>{t('dashboard.mobileCombustion')}</span>
                            </div>
                            <div className="legend-item">
                                <span className="legend-color" style={{ background: '#0D9488' }}></span>
                                <span>{t('dashboard.stationaryCombustion')}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Scope 2 Breakdown */}
                <div className="card chart-card">
                    <div className="card-header">
                        <h2>
                            <i className="fas fa-bolt"></i>
                            {t('dashboard.scope2Breakdown')}
                        </h2>
                    </div>
                    <div className="doughnut-container">
                        <div className="doughnut-wrapper">
                            <Doughnut data={scope2DoughnutData} options={doughnutOptions} />
                        </div>
                        <div className="chart-legend">
                            <div className="legend-item">
                                <span className="legend-color" style={{ background: '#3B82F6' }}></span>
                                <span>{t('dashboard.purchasedElectricity')}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Detailed Sections */}
            <div className="detailed-sections">
                {/* Scope 1 Details */}
                <div className="card detail-card">
                    <div className="card-header">
                        <h2>
                            <i className="fas fa-fire"></i>
                            {t('dashboard.scope1Details')}
                        </h2>
                        <span className="info-badge">
                            <i className="fas fa-info-circle"></i>
                            {t('dashboard.directEmissions')}
                        </span>
                    </div>
                    <div className="detail-table">
                        <table>
                            <thead>
                                <tr>
                                    {hasToken && <th style={{ width: '2.5rem' }}>
                                        <input
                                            type="checkbox"
                                            aria-label={t('dashboard.selectAllScope1')}
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
                                    <th>{t('dashboard.source')}</th>
                                    <th>{t('dashboard.amount')}</th>
                                    <th>{t('dashboard.emissions')}</th>
                                    <th>{t('dashboard.dataSource')}</th>
                                    <th>{t('dashboard.status')}</th>
                                    {hasToken && <th className="th-actions">{t('dashboard.actions')}</th>}
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
                                                            aria-label={t('dashboard.selectThisEmission')}
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
                                            {renderEmissionSourceCell(entry, dataSource, t)}
                                            <td>
                                                <span className="status-badge verified">{t('dashboard.verified')}</span>
                                            </td>
                                            {hasToken && (
                                                <td className="td-actions">
                                                    {entry.id ? (
                                                        <button
                                                            type="button"
                                                            className="btn-icon btn-delete"
                                                            onClick={() => handleDeleteEmission(entry.id)}
                                                            disabled={deletingId === entry.id}
                                                            title={t('dashboard.deleteThisRecord')}
                                                            aria-label={t('dashboard.delete')}
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
                                    <td colSpan={hasToken ? 2 : 1}><strong>{t('dashboard.totalScope1')}</strong></td>
                                    <td colSpan={hasToken ? 4 : 3}><strong>{formatNumber(scope1Total)} tCO₂e</strong></td>
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
                            {t('dashboard.scope2Details')}
                        </h2>
                        <span className="info-badge">
                            <i className="fas fa-info-circle"></i>
                            {t('dashboard.indirectEmissions')}
                        </span>
                    </div>
                    <div className="detail-table">
                        <table>
                            <thead>
                                <tr>
                                    {hasToken && <th style={{ width: '2.5rem' }}>
                                        <input
                                            type="checkbox"
                                            aria-label={t('dashboard.selectAllScope2')}
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
                                    <th>{t('dashboard.source')}</th>
                                    <th>{t('dashboard.amount')}</th>
                                    <th>{t('dashboard.emissions')}</th>
                                    <th>{t('dashboard.dataSource')}</th>
                                    <th>{t('dashboard.status')}</th>
                                    {hasToken && <th className="th-actions">{t('dashboard.actions')}</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {scope2TableRows.map((entry, index) => {
                                    const isApi = entry.activityType != null;
                                    const source = isApi ? entry.activityType : (entry.supplier || t('dashboard.electricityFallback'));
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
                                                            aria-label={t('dashboard.selectThisEmission')}
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
                                            {renderEmissionSourceCell(entry, dataSource, t)}
                                            <td>
                                                <span className="status-badge verified">{t('dashboard.verified')}</span>
                                            </td>
                                            {hasToken && (
                                                <td className="td-actions">
                                                    {entry.id ? (
                                                        <button
                                                            type="button"
                                                            className="btn-icon btn-delete"
                                                            onClick={() => handleDeleteEmission(entry.id)}
                                                            disabled={deletingId === entry.id}
                                                            title={t('dashboard.deleteThisRecord')}
                                                            aria-label={t('dashboard.delete')}
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
                                    <td colSpan={hasToken ? 2 : 1}><strong>{t('dashboard.totalScope2')}</strong></td>
                                    <td colSpan={hasToken ? 4 : 3}><strong>{formatNumber(scope2Total)} tCO₂e</strong></td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            </div>

            {hasToken && (
                <div className="dashboard-bulk-actions">
                    <button
                        type="button"
                        className="btn btn-danger"
                        disabled={!selectedEmissionIds.length || deletingId === 'bulk'}
                        onClick={handleBulkDelete}
                        title={selectedEmissionIds.length ? t('dashboard.deleteSelectedTooltip', { count: selectedEmissionIds.length }) : t('dashboard.selectRecordsToEnable')}
                    >
                        {deletingId === 'bulk' ? (
                            <>
                                <i className="fas fa-spinner fa-spin"></i> {t('dashboard.deleting')}
                            </>
                        ) : (
                            <>
                                <i className="fas fa-trash-alt"></i> {t('dashboard.deleteSelected')}
                            </>
                        )}
                    </button>
                    {selectedEmissionIds.length > 0 && (
                        <span className="dashboard-bulk-count">
                            {t('dashboard.selected', { count: selectedEmissionIds.length })}
                        </span>
                    )}
                </div>
            )}

                </div>
            </details>

            {/* Footer */}
            <div className="dashboard-footer">
                <p>{t('dashboard.dataLastUpdated')} {new Date().toLocaleString(dateLocale)}</p>
                <p>{t('dashboard.versionFooter')}</p>
            </div>
        </div>
    );
}

export default Dashboard;

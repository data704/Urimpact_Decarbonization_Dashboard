import { useEffect, useRef, useState, useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    LineElement,
    PointElement,
    Title,
    Tooltip,
    Legend,
    Filler
} from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';
import { FootprintRing, MonthlyEnergyChart, WasteDonutChart, ProgressBarRow } from './dashboardV2Widgets.jsx';
import { useDataStore } from '../../context/DataStoreContext';
import { useAuth } from '../../context/AuthContext';
import { getAuthToken, getDashboard, getEmissions } from '../../api/client';
import './Dashboard.css';

const kgToTonnes = (kg) => (kg == null ? 0 : kg / 1000);


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
    Title,
    Tooltip,
    Legend,
    Filler
);

function Dashboard() {
    const { t, i18n } = useTranslation();
    const { user } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const {
        getTotalScope1,
        getTotalScope2,
        getTotalEmissions,
        getMonthlyData
    } = useDataStore();

    const [apiDashboard, setApiDashboard] = useState(null);
    const [apiEmissions, setApiEmissions] = useState([]);
    const [apiLoading, setApiLoading] = useState(true);
    const [apiError, setApiError] = useState(null);
    const [completedTasks, setCompletedTasks] = useState(new Set(['t1']));
    const fromSubmit = location.state?.fromSubmit === true;
    const submitMessage = location.state?.submitMessage;

    const currentYear = new Date().getFullYear();
    const dateLocale = i18n.language === 'ar' ? 'ar-SA' : 'en-US';
    const monthsShort = useMemo(() => monthLabelsShort(dateLocale), [dateLocale]);
    const monthsLong = useMemo(() => monthLabelsLong(dateLocale), [dateLocale]);
    const [filterYear, setFilterYear] = useState(currentYear);
    const [filterPeriod, setFilterPeriod] = useState('all'); // 'all' | 'Q1' | 'Q2' | 'Q3' | 'Q4' | 0-11 | number[] for calendar multi-select
    /** Scope-wise trend chart: stacked bars by year vs by month (matches platform v2 mockup). */
    const [scopeTrendGranularity, setScopeTrendGranularity] = useState('annual');

    const [calendarModalOpen, setCalendarModalOpen] = useState(false);
    const [calendarYearEmissions, setCalendarYearEmissions] = useState([]);
    const [calendarSelectedMonths, setCalendarSelectedMonths] = useState([]);
    const filtersRef = useRef(null);
    const guestFiltersRef = useRef(null);

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

    const reportingPeriodHero = useMemo(() => {
        if (filterPeriod === 'all') {
            return `${monthsShort[0]}–${monthsShort[11]} ${filterYear}`;
        }
        if (Array.isArray(filterPeriod) && filterPeriod.length > 0) {
            if (filterPeriod.length === 12) return `${monthsShort[0]}–${monthsShort[11]} ${filterYear}`;
            return `${monthsShort[filterPeriod[0]]} ${t('dashboard.dash')} ${monthsShort[filterPeriod[filterPeriod.length - 1]]} ${filterYear}`;
        }
        if (filterPeriod === 'Q1' || filterPeriod === 'Q2' || filterPeriod === 'Q3' || filterPeriod === 'Q4') {
            return `${t(`dashboard.quarter${filterPeriod}`)} ${filterYear}`;
        }
        const m = typeof filterPeriod === 'number' ? filterPeriod : parseInt(String(filterPeriod), 10);
        if (!Number.isNaN(m) && m >= 0 && m <= 11) return `${monthsLong[m]} ${filterYear}`;
        return `${monthsShort[0]}–${monthsShort[11]} ${filterYear}`;
    }, [filterPeriod, filterYear, monthsShort, monthsLong, t]);

    const periodChipText =
        filterPeriod === 'all'
            ? `${filterYear} ${t('dashboard.annualWord')}`
            : `${filterYear} ${t('dashboard.dash')} ${periodLabel}`;

    const years = Array.from({ length: 11 }, (_, i) => currentYear - 5 + i);
    const trendMonthsWithData = useMemo(() => new Set((apiDashboard?.emissions?.trend || []).filter(t => (t.scope1 || 0) + (t.scope2 || 0) > 0).map(t => t.month)), [apiDashboard]);


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
            const scope3Data = trend.map((t) => kgToTonnes(t.scope3 || 0));
            return { labels, scope1: scope1Data, scope2: scope2Data, scope3: scope3Data };
        }
        const fromStore = getMonthlyData();
        const z = Array(12).fill(0);
        return {
            labels: monthsShort,
            scope1: fromStore.scope1,
            scope2: fromStore.scope2,
            scope3: z,
        };
    }, [apiDashboard, getMonthlyData, monthsShort]);

    /** Four-year stacked totals for "Annual" tab (from emissions dates when available, else shape from current totals). */
    const annualScopeBars = useMemo(() => {
        const years = [filterYear - 3, filterYear - 2, filterYear - 1, filterYear];
        const empty = () => years.map(() => 0);
        let s1 = empty();
        let s2 = empty();
        let s3 = empty();
        if (hasToken && apiEmissions.length) {
            years.forEach((y, yi) => {
                apiEmissions.forEach((e) => {
                    const d = e.billingPeriodStart || e.calculatedAt;
                    if (!d) return;
                    const dt = new Date(d);
                    if (dt.getFullYear() !== y) return;
                    const t = kgToTonnes(e.co2e);
                    if (e.scope === 'SCOPE_1') s1[yi] += t;
                    else if (e.scope === 'SCOPE_2') s2[yi] += t;
                    else if (e.scope === 'SCOPE_3') s3[yi] += t;
                });
            });
            const sum = (arr) => arr.reduce((a, b) => a + b, 0);
            if (sum(s1) + sum(s2) + sum(s3) < 1e-6) {
                /* fall through to demo shape */
            } else {
                return { labels: years.map(String), scope1: s1, scope2: s2, scope3: s3 };
            }
        }
        const T1 = Math.max(0, scope1Total);
        const T2 = Math.max(0, scope2Total);
        const T3 = Math.max(0, scope3Total);
        const seq = [0.22, 0.24, 0.26, 0.28];
        return {
            labels: years.map(String),
            scope1: seq.map((f) => T1 * f * 0.85),
            scope2: seq.map((f) => T2 * f * 0.92),
            scope3: seq.map((f) => T3 * f * 0.78),
        };
    }, [apiEmissions, filterYear, hasToken, scope1Total, scope2Total, scope3Total]);

    const compliancePct = useMemo(() => {
        const raw = apiDashboard?.compliance?.overallPercent ?? apiDashboard?.compliance?.score;
        if (raw != null && Number.isFinite(Number(raw))) return Math.round(Number(raw));
        return 94;
    }, [apiDashboard]);

    /** Demo floor from platform mockup — blended with real API totals until live data fills in. */
    const kpiDisplayTonnes = useMemo(() => {
        const D = { total: 12456, s1: 2345, s2: 3210, s3: 6901 };
        const b = 0.04;
        const apiTotal = Number(totalEmissions) || 0;
        const blend = (api, demo) => (api < 0.01 ? demo : Math.round(api + demo * b));
        return {
            total: blend(apiTotal, D.total),
            s1: blend(Number(scope1Total) || 0, D.s1),
            s2: blend(Number(scope2Total) || 0, D.s2),
            s3: blend(Number(scope3Total) || 0, D.s3),
        };
    }, [totalEmissions, scope1Total, scope2Total, scope3Total]);

    const stackedBarChartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
            mode: 'index',
            intersect: false,
        },
        plugins: {
            legend: { display: false },
            tooltip: {
                backgroundColor: '#1A2E2B',
                titleColor: '#fff',
                bodyColor: '#eaf7f6',
                padding: 12,
                cornerRadius: 8,
                callbacks: {
                    label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y?.toFixed(2)} tCO\u2082e`,
                    footer: (items) => {
                        const total = items.reduce((s, i) => s + (i.parsed.y || 0), 0);
                        return `Total: ${total.toFixed(2)} tCO\u2082e`;
                    },
                },
            },
        },
        scales: {
            x: {
                stacked: true,
                grid: { display: false },
                ticks: { color: '#9BB5B0', font: { size: 11 } },
            },
            y: {
                stacked: true,
                grid: { color: '#E4EDEB', borderDash: [4, 3] },
                ticks: { color: '#9BB5B0', font: { size: 10 } },
            },
        },
        onHover: (event, elements, chart) => {
            chart.canvas.style.cursor = elements.length ? 'pointer' : 'default';
        },
    };

    const scopeWiseStackedBarData = useMemo(() => {
        if (scopeTrendGranularity === 'monthly') {
            return {
                labels: monthlyData.labels,
                datasets: [
                    { label: t('dashboard.legendScope1'), data: monthlyData.scope1, backgroundColor: '#1A9A8F' },
                    { label: t('dashboard.legendScope2'), data: monthlyData.scope2, backgroundColor: '#3DC8BE' },
                    { label: t('dashboard.legendScope3'), data: monthlyData.scope3, backgroundColor: '#A8DDD9' },
                ],
            };
        }
        return {
            labels: annualScopeBars.labels,
            datasets: [
                { label: t('dashboard.legendScope1'), data: annualScopeBars.scope1, backgroundColor: '#1A9A8F' },
                { label: t('dashboard.legendScope2'), data: annualScopeBars.scope2, backgroundColor: '#3DC8BE' },
                { label: t('dashboard.legendScope3'), data: annualScopeBars.scope3, backgroundColor: '#A8DDD9' },
            ],
        };
    }, [scopeTrendGranularity, monthlyData, annualScopeBars, t]);

    const esgTrendChartData = useMemo(
        () => ({
            labels: [String(filterYear - 3), String(filterYear - 2), String(filterYear - 1), String(filterYear)],
            datasets: [
                {
                    label: t('dashboard.legendEnv'),
                    data: [72, 74, 77, 80],
                    borderColor: '#1A9A8F',
                    backgroundColor: 'rgba(26,154,143,0.06)',
                    fill: false,
                    tension: 0.35,
                    borderWidth: 2.5,
                    pointRadius: 4,
                    pointHoverRadius: 7,
                    pointBackgroundColor: '#1A9A8F',
                    pointHoverBackgroundColor: '#fff',
                    pointHoverBorderColor: '#1A9A8F',
                    pointHoverBorderWidth: 3,
                },
                {
                    label: t('dashboard.legendSoc'),
                    data: [68, 70, 72, 75],
                    borderColor: '#3DC8BE',
                    backgroundColor: 'transparent',
                    fill: false,
                    tension: 0.35,
                    borderWidth: 2,
                    pointRadius: 3,
                    pointHoverRadius: 6,
                    pointBackgroundColor: '#3DC8BE',
                    pointHoverBackgroundColor: '#fff',
                    pointHoverBorderColor: '#3DC8BE',
                    pointHoverBorderWidth: 3,
                },
                {
                    label: t('dashboard.legendGov'),
                    data: [70, 71, 73, 78],
                    borderColor: '#85D8D4',
                    backgroundColor: 'transparent',
                    fill: false,
                    tension: 0.35,
                    borderWidth: 2,
                    pointRadius: 3,
                    pointHoverRadius: 6,
                    pointBackgroundColor: '#85D8D4',
                    pointHoverBackgroundColor: '#fff',
                    pointHoverBorderColor: '#85D8D4',
                    pointHoverBorderWidth: 3,
                },
            ],
        }),
        [filterYear, t]
    );

    const esgTrendChartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
            mode: 'index',
            intersect: false,
        },
        plugins: {
            legend: { display: false },
            tooltip: {
                backgroundColor: '#1A2E2B',
                titleColor: '#fff',
                bodyColor: '#eaf7f6',
                padding: 12,
                cornerRadius: 8,
                callbacks: {
                    label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y}/100`,
                },
            },
        },
        scales: {
            x: {
                grid: { display: false },
                ticks: { color: '#9BB5B0', font: { size: 11 } },
            },
            y: {
                min: 0,
                max: 100,
                grid: { color: '#E4EDEB', borderDash: [4, 3] },
                ticks: { color: '#9BB5B0', font: { size: 10 }, stepSize: 25 },
            },
        },
        onHover: (event, elements, chart) => {
            chart.canvas.style.cursor = elements.length ? 'crosshair' : 'default';
        },
    };

    const formatNumber = (num) => {
        if (num == null || Number.isNaN(num)) return '0';
        return Number(num).toLocaleString(dateLocale, { maximumFractionDigits: 2 });
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
            const arrow = pct >= 0 ? '↑' : '↓';
            return {
                up: pct >= 0,
                arrow,
                pctStr: Math.abs(pct).toFixed(1),
                text: t('dashboard.kpiTrendCompare', {
                    arrow,
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

    const upcomingTasks = useMemo(
        () => [
            { id: 't1', title: t('dashboard.taskScope3Goods'), days: 2, urgent: true },
            { id: 't2', title: t('dashboard.taskGapAnalysis'), days: 5, urgent: false },
            { id: 't3', title: t('dashboard.taskReviewData'), days: 7, urgent: false },
        ],
        [t]
    );


    const welcomeName = (user?.firstName || '').trim() || t('dashboard.heroGuestName');

    const openDateFilters = () => {
        const el = hasToken ? filtersRef.current : guestFiltersRef.current;
        if (el) {
            el.open = true;
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

    const toggleTask = (taskId) => {
        setCompletedTasks((prev) => {
            const next = new Set(prev);
            if (next.has(taskId)) next.delete(taskId);
            else next.add(taskId);
            return next;
        });
    };

    const handleExportReport = () => {
        const rows = [
            ['Metric', 'Value', 'Unit'],
            ['Total GHG Emissions', formatNumber(kpiDisplayTonnes.total), 'tCO2e'],
            ['Scope 1', formatNumber(kpiDisplayTonnes.s1), 'tCO2e'],
            ['Scope 2', formatNumber(kpiDisplayTonnes.s2), 'tCO2e'],
            ['Scope 3', formatNumber(kpiDisplayTonnes.s3), 'tCO2e'],
            ['Compliance', compliancePct + '%', ''],
            ['ESG Score', '78', '/100'],
            ['Renewable Energy', '34%', ''],
            ['Waste Recycled', '67%', ''],
            ['Water Consumption', '8420', 'KL'],
            [''],
            ['Month', 'Scope 1 (tCO2e)', 'Scope 2 (tCO2e)', 'Scope 3 (tCO2e)'],
        ];
        monthlyData.labels.forEach((lbl, i) => {
            rows.push([lbl, monthlyData.scope1[i]?.toFixed(2) || '0', monthlyData.scope2[i]?.toFixed(2) || '0', monthlyData.scope3[i]?.toFixed(2) || '0']);
        });
        if (apiEmissions.length) {
            rows.push(['']);
            rows.push(['Emission Records']);
            rows.push(['Scope', 'Activity', 'Amount', 'Unit', 'CO2e (tCO2e)', 'Date']);
            apiEmissions.forEach((e) => {
                rows.push([
                    e.scope || '',
                    e.activityType || '',
                    e.activityAmount || '',
                    e.activityUnit || '',
                    kgToTonnes(e.co2e)?.toFixed(4) || '0',
                    e.billingPeriodStart || e.calculatedAt || '',
                ]);
            });
        }
        const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `urimpact-dashboard-${filterYear}-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="dashboard-content dashboard-content--v2">
            <div className="page-header page-header-with-filter up-ph">
                <div>
                    <h1 className="up-pt">{t('dashboard.heroTitle')}</h1>
                    <p className="up-ps">
                        {t('dashboard.heroWelcomePeriod', {
                            name: welcomeName,
                            period: reportingPeriodHero,
                        })}
                    </p>
                </div>
                <div className="dash-hero-actions">
                    <button type="button" className="dash-period-chip" onClick={openDateFilters}>
                        <i className="fas fa-calendar-alt" aria-hidden />
                        <span>{periodChipText}</span>
                    </button>
                    <button
                        type="button"
                        className="up-btn up-btn-primary dash-export-btn"
                        onClick={handleExportReport}
                        title={t('dashboard.exportReport')}
                    >
                        <i className="fas fa-download" aria-hidden />
                        {t('dashboard.exportReport')}
                    </button>
                </div>
            </div>

            {hasToken && (
                <details ref={filtersRef} id="dash-filters" className="dashboard-filters-details">
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

            {!hasToken && (
                <details ref={guestFiltersRef} id="dash-filters-guest" className="dashboard-filters-details">
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
                                <i className="fas fa-chevron-down date-filter-year-arrow" aria-hidden />
                            </div>
                            <button
                                type="button"
                                className={`date-filter-period-btn ${filterPeriod === 'all' ? 'active' : ''}`}
                                onClick={() => setFilterPeriod('all')}
                            >
                                {t('dashboard.allTime')}
                            </button>
                        </div>
                        <p className="dashboard-guest-filter-hint">{t('dashboard.guestFilterHint')}</p>
                    </div>
                </details>
            )}

            {hasToken && calendarModalOpen && (
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

            {fromSubmit && (
                <div className="dashboard-submit-banner" role="alert">
                    <i className="fas fa-check-circle"></i>
                    <div>
                        <strong>{t('dashboard.submissionSaved')}</strong>
                        <p>{submitMessage || t('dashboard.submissionSavedBody')}</p>
                    </div>
                </div>
            )}

            <div className="dash-section-label">{t('dashboard.sectionGhgEmissions')}</div>
            <div className="dashboard-kpi-row">
                <div className="dashboard-kpi-card dashboard-kpi-card--total dashboard-kpi-card--clickable" onClick={() => navigate('/data-input')} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && navigate('/data-input')}>
                    <div className="dashboard-kpi-label-block">
                        <span className="dashboard-kpi-label">{t('dashboard.kpiTotalGhg')}</span>
                        <span className="dashboard-kpi-sublabel">{t('dashboard.kpiTotalGhgSub')}</span>
                    </div>
                    <div className="dashboard-kpi-mid">
                        <div className="dashboard-kpi-value-wrap">
                            <span className="dashboard-kpi-value">{formatNumber(kpiDisplayTonnes.total)}</span>
                        </div>
                        <div className="dashboard-kpi-icon" aria-hidden>
                            <i className="fas fa-leaf" />
                        </div>
                    </div>
                    <div className="dashboard-kpi-trend-row">
                        {scopeTrends.total ? (
                            <span className={`dashboard-kpi-trend ${scopeTrends.total.up ? 'up' : 'down'}`}>
                                {scopeTrends.total.arrow} {scopeTrends.total.pctStr}%
                                <span className="dashboard-kpi-trend-suffix"> {t('dashboard.kpiTrendVsLastYear')}</span>
                            </span>
                        ) : (
                            <span className="dashboard-kpi-trend down">
                                {t('dashboard.demoTrendTotal')}
                                <span className="dashboard-kpi-trend-suffix"> {t('dashboard.kpiTrendVsLastYear')}</span>
                            </span>
                        )}
                    </div>
                </div>
                <div className="dashboard-kpi-card dashboard-kpi-card--clickable" onClick={() => navigate('/data-input')} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && navigate('/data-input')}>
                    <div className="dashboard-kpi-label-block">
                        <span className="dashboard-kpi-label">{t('dashboard.kpiScope1')}</span>
                        <span className="dashboard-kpi-sublabel">{t('dashboard.kpiScope1Sub')}</span>
                    </div>
                    <div className="dashboard-kpi-mid">
                        <div className="dashboard-kpi-value-wrap">
                            <span className="dashboard-kpi-value">{formatNumber(kpiDisplayTonnes.s1)}</span>
                        </div>
                        <div className="dashboard-kpi-icon dashboard-kpi-icon--s1" aria-hidden>
                            <i className="fas fa-industry" />
                        </div>
                    </div>
                    <div className="dashboard-kpi-trend-row">
                        {scopeTrends.s1 ? (
                            <span className={`dashboard-kpi-trend ${scopeTrends.s1.up ? 'up' : 'down'}`}>
                                {scopeTrends.s1.arrow} {scopeTrends.s1.pctStr}%
                                <span className="dashboard-kpi-trend-suffix"> {t('dashboard.kpiTrendVsLastYear')}</span>
                            </span>
                        ) : (
                            <span className="dashboard-kpi-trend down">
                                {t('dashboard.demoTrendS1')}
                                <span className="dashboard-kpi-trend-suffix"> {t('dashboard.kpiTrendVsLastYear')}</span>
                            </span>
                        )}
                    </div>
                </div>
                <div className="dashboard-kpi-card dashboard-kpi-card--clickable" onClick={() => navigate('/data-input')} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && navigate('/data-input')}>
                    <div className="dashboard-kpi-label-block">
                        <span className="dashboard-kpi-label">{t('dashboard.kpiScope2')}</span>
                        <span className="dashboard-kpi-sublabel">{t('dashboard.kpiScope2Sub')}</span>
                    </div>
                    <div className="dashboard-kpi-mid">
                        <div className="dashboard-kpi-value-wrap">
                            <span className="dashboard-kpi-value">{formatNumber(kpiDisplayTonnes.s2)}</span>
                        </div>
                        <div className="dashboard-kpi-icon dashboard-kpi-icon--s2" aria-hidden>
                            <i className="fas fa-bolt" />
                        </div>
                    </div>
                    <div className="dashboard-kpi-trend-row">
                        {scopeTrends.s2 ? (
                            <span className={`dashboard-kpi-trend ${scopeTrends.s2.up ? 'up' : 'down'}`}>
                                {scopeTrends.s2.arrow} {scopeTrends.s2.pctStr}%
                                <span className="dashboard-kpi-trend-suffix"> {t('dashboard.kpiTrendVsLastYear')}</span>
                            </span>
                        ) : (
                            <span className="dashboard-kpi-trend down">
                                {t('dashboard.demoTrendS2')}
                                <span className="dashboard-kpi-trend-suffix"> {t('dashboard.kpiTrendVsLastYear')}</span>
                            </span>
                        )}
                    </div>
                </div>
                <div className="dashboard-kpi-card dashboard-kpi-card--clickable" onClick={() => navigate('/data-input')} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && navigate('/data-input')}>
                    <div className="dashboard-kpi-label-block">
                        <span className="dashboard-kpi-label">{t('dashboard.kpiScope3')}</span>
                        <span className="dashboard-kpi-sublabel">{t('dashboard.kpiScope3Sub')}</span>
                    </div>
                    <div className="dashboard-kpi-mid">
                        <div className="dashboard-kpi-value-wrap">
                            <span className="dashboard-kpi-value">{formatNumber(kpiDisplayTonnes.s3)}</span>
                        </div>
                        <div className="dashboard-kpi-icon dashboard-kpi-icon--s3" aria-hidden>
                            <i className="fas fa-truck" />
                        </div>
                    </div>
                    <div className="dashboard-kpi-trend-row">
                        {scopeTrends.s3 ? (
                            <span className={`dashboard-kpi-trend ${scopeTrends.s3.up ? 'up' : 'down'}`}>
                                {scopeTrends.s3.arrow} {scopeTrends.s3.pctStr}%
                                <span className="dashboard-kpi-trend-suffix"> {t('dashboard.kpiTrendVsLastYear')}</span>
                            </span>
                        ) : (
                            <span className="dashboard-kpi-trend down">
                                {t('dashboard.demoTrendS3')}
                                <span className="dashboard-kpi-trend-suffix"> {t('dashboard.kpiTrendVsLastYear')}</span>
                            </span>
                        )}
                    </div>
                </div>
                <div className="dashboard-kpi-card dashboard-kpi-card--clickable" onClick={() => navigate('/reports')} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && navigate('/reports')}>
                    <div className="dashboard-kpi-label-block">
                        <span className="dashboard-kpi-label">{t('dashboard.kpiCompliance')}</span>
                        <span className="dashboard-kpi-sublabel">{t('dashboard.kpiComplianceSub')}</span>
                    </div>
                    <div className="dashboard-kpi-mid">
                        <div className="dashboard-kpi-value-wrap">
                            <span className="dashboard-kpi-value">{compliancePct}</span>
                            <span className="dashboard-kpi-unit">%</span>
                        </div>
                        <div className="dashboard-kpi-icon dashboard-kpi-icon--compliance" aria-hidden>
                            <i className="fas fa-circle-check" />
                        </div>
                    </div>
                    <div className="dashboard-kpi-trend-row">
                        <span className="dashboard-kpi-trend up">
                            {t('dashboard.kpiComplianceTrendDemo')}
                            <span className="dashboard-kpi-trend-suffix"> {t('dashboard.kpiTrendVsLastYear')}</span>
                        </span>
                    </div>
                </div>
            </div>

            <div className="dash-section-label">{t('dashboard.sectionEsgSustainability')}</div>
            <div className="dashboard-kpi-row dash-kpi-row-esg">
                <div className="dashboard-kpi-card dashboard-kpi-card--clickable" onClick={() => navigate('/esg')} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && navigate('/esg')}>
                    <div className="dashboard-kpi-label-block">
                        <span className="dashboard-kpi-label">{t('dashboard.kpiEsgTotal')}</span>
                        <span className="dashboard-kpi-sublabel">{t('dashboard.kpiEsgTotalSub')}</span>
                    </div>
                    <div className="dashboard-kpi-mid">
                        <div className="dashboard-kpi-value-wrap">
                            <span className="dashboard-kpi-value">78</span>
                            <span className="dashboard-kpi-unit muted">/100</span>
                        </div>
                        <div className="dashboard-kpi-icon dashboard-kpi-icon--esg" aria-hidden>
                            <i className="fas fa-star" />
                        </div>
                    </div>
                    <div className="dashboard-kpi-trend-row">
                        <span className="dashboard-kpi-trend up">
                            {t('dashboard.esgTrendDemo')}
                            <span className="dashboard-kpi-trend-suffix"> {t('dashboard.kpiTrendVsLastYear')}</span>
                        </span>
                    </div>
                </div>
                <div className="dashboard-kpi-card">
                    <div className="dashboard-kpi-label-block">
                        <span className="dashboard-kpi-label">{t('dashboard.kpiRenewable')}</span>
                        <span className="dashboard-kpi-sublabel">{t('dashboard.kpiRenewableSub')}</span>
                    </div>
                    <div className="dashboard-kpi-mid">
                        <div className="dashboard-kpi-value-wrap">
                            <span className="dashboard-kpi-value">34</span>
                            <span className="dashboard-kpi-unit">%</span>
                        </div>
                        <div className="dashboard-kpi-icon dashboard-kpi-icon--renew" aria-hidden>
                            <i className="fas fa-sun" />
                        </div>
                    </div>
                    <div className="dashboard-kpi-trend-row">
                        <span className="dashboard-kpi-trend up">
                            {t('dashboard.kpiRenewableTrend')}
                            <span className="dashboard-kpi-trend-suffix"> {t('dashboard.kpiTrendVsLastYear')}</span>
                        </span>
                    </div>
                </div>
                <div className="dashboard-kpi-card">
                    <div className="dashboard-kpi-label-block">
                        <span className="dashboard-kpi-label">{t('dashboard.kpiWasteRecycled')}</span>
                        <span className="dashboard-kpi-sublabel">{t('dashboard.kpiWasteRecycledSub')}</span>
                    </div>
                    <div className="dashboard-kpi-mid">
                        <div className="dashboard-kpi-value-wrap">
                            <span className="dashboard-kpi-value">67</span>
                            <span className="dashboard-kpi-unit">%</span>
                        </div>
                        <div className="dashboard-kpi-icon dashboard-kpi-icon--waste" aria-hidden>
                            <i className="fas fa-recycle" />
                        </div>
                    </div>
                    <div className="dashboard-kpi-trend-row">
                        <span className="dashboard-kpi-trend up">
                            {t('dashboard.kpiWasteTrend')}
                            <span className="dashboard-kpi-trend-suffix"> {t('dashboard.kpiTrendVsLastYear')}</span>
                        </span>
                    </div>
                </div>
                <div className="dashboard-kpi-card">
                    <div className="dashboard-kpi-label-block">
                        <span className="dashboard-kpi-label">{t('dashboard.kpiWater')}</span>
                        <span className="dashboard-kpi-sublabel">{t('dashboard.kpiWaterSub', { year: filterYear })}</span>
                    </div>
                    <div className="dashboard-kpi-mid">
                        <div className="dashboard-kpi-value-wrap">
                            <span className="dashboard-kpi-value">{formatNumber(8420)}</span>
                            <span className="dashboard-kpi-unit">{t('dashboard.kpiWaterUnit')}</span>
                        </div>
                        <div className="dashboard-kpi-icon dashboard-kpi-icon--water" aria-hidden>
                            <i className="fas fa-droplet" />
                        </div>
                    </div>
                    <div className="dashboard-kpi-trend-row">
                        <span className="dashboard-kpi-trend down">
                            {t('dashboard.kpiWaterTrend')}
                            <span className="dashboard-kpi-trend-suffix"> {t('dashboard.kpiTrendVsLastYear')}</span>
                        </span>
                    </div>
                </div>
                <div className="dashboard-kpi-card">
                    <div className="dashboard-kpi-label-block">
                        <span className="dashboard-kpi-label">{t('dashboard.kpiOpenTasks')}</span>
                        <span className="dashboard-kpi-sublabel">{t('dashboard.kpiOpenTasksSub')}</span>
                    </div>
                    <div className="dashboard-kpi-mid">
                        <div className="dashboard-kpi-value-wrap">
                            <span className="dashboard-kpi-value">14</span>
                        </div>
                        <div className="dashboard-kpi-icon dashboard-kpi-icon--tasks" aria-hidden>
                            <i className="fas fa-list-check" />
                        </div>
                    </div>
                    <div className="dashboard-kpi-trend-row">
                        <span className="dashboard-kpi-trend down bad">
                            {t('dashboard.kpiOpenTasksTrend')}
                            <span className="dashboard-kpi-trend-suffix"> {t('dashboard.kpiTrendVsLastYear')}</span>
                        </span>
                    </div>
                </div>
            </div>

            <div className="dash-sfp">
                <div className="dash-sfp-title">
                    <i className="fas fa-location-dot dash-sfp-pin" aria-hidden />
                    <span>{t('dashboard.sfpTitle')}</span>
                    <span className="dash-sfp-pill">
                        {t('dashboard.sfpBadgeFy', {
                            year: filterYear,
                            org: (user?.company || '').trim() || t('header.defaultOrganization'),
                        })}
                    </span>
                    <Link to="/decarbonization" className="up-btn up-btn-outline dash-sfp-roadmap btn-sm">
                        {t('dashboard.sfpRoadmap')} <i className="fas fa-arrow-right" aria-hidden />
                    </Link>
                </div>
                <p className="dash-sfp-sub">{t('dashboard.sfpSub')}</p>
                <div className="dash-sfp-grid">
                    {[
                        {
                            name: t('dashboard.sfpCarbon'),
                            val: formatNumber(kpiDisplayTonnes.total),
                            unit: 'tCO₂e',
                            pct: Math.min(100, kpiDisplayTonnes.total > 0 ? 62 : 35),
                            chg: scopeTrends.total?.text || '—',
                            dn: !scopeTrends.total?.up,
                            c: '#1A9A8F',
                            badge: t('dashboard.badgeReducing'),
                            bs: '#E8F8EE',
                            bc: '#27AE60',
                        },
                        {
                            name: t('dashboard.sfpWater'),
                            val: '8,420',
                            unit: 'KL',
                            pct: 75,
                            chg: t('dashboard.kpiWaterTrend'),
                            dn: true,
                            c: '#2980B9',
                            badge: t('dashboard.badgeOnTrack'),
                            bs: '#E8F8EE',
                            bc: '#27AE60',
                        },
                        {
                            name: t('dashboard.sfpWaste'),
                            val: '1,240',
                            unit: t('dashboard.wasteTonnes'),
                            pct: 55,
                            chg: t('dashboard.kpiWasteTrend'),
                            dn: false,
                            c: '#E67E22',
                            badge: t('dashboard.badgeMonitor'),
                            bs: '#FEF6E4',
                            bc: '#B7770A',
                        },
                        {
                            name: t('dashboard.sfpEnergy'),
                            val: '24.8K',
                            unit: 'MWh',
                            pct: 68,
                            chg: t('dashboard.kpiRenewableTrend'),
                            dn: true,
                            c: '#27AE60',
                            badge: t('dashboard.badgeStrong'),
                            bs: '#E8F8EE',
                            bc: '#27AE60',
                        },
                        {
                            name: t('dashboard.sfpLand'),
                            val: '340',
                            unit: t('dashboard.sfpHectares'),
                            pct: 40,
                            chg: t('dashboard.sfpLandTrend'),
                            dn: false,
                            c: '#8E44AD',
                            badge: t('dashboard.badgeRisk'),
                            bs: '#FDEAEA',
                            bc: '#C0392B',
                        },
                    ].map((f) => (
                        <div key={f.name} className="dash-sfp-item">
                            <div className="dash-sfp-ring-wrap">
                                <FootprintRing pct={f.pct} color={f.c} label={f.name} />
                                <div className="dash-sfp-ring-label">
                                    <div className="dash-sfp-ring-pct">{f.pct}%</div>
                                    <div className="dash-sfp-ring-target">{t('dashboard.sfpTarget')}</div>
                                </div>
                            </div>
                            <div className="dash-sfp-name">{f.name}</div>
                            <div className="dash-sfp-val">
                                {f.val} <span className="dash-sfp-unit">{f.unit}</span>
                            </div>
                            <div className={`dash-sfp-chg ${f.dn ? 'dn' : 'up'}`}>{f.chg}</div>
                            <span className="dash-sfp-badge" style={{ background: f.bs, color: f.bc }}>
                                {f.badge}
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="dash-g2">
                <div className="dash-card">
                    <div className="dash-ct">
                        <span>{t('dashboard.scopeTrendTitle')}</span>
                        <div className="dash-ct-tabs" role="tablist" aria-label={t('dashboard.scopeTrendTitle')}>
                            <button
                                type="button"
                                role="tab"
                                aria-selected={scopeTrendGranularity === 'annual'}
                                className={`dash-ct-tab ${scopeTrendGranularity === 'annual' ? 'on' : ''}`}
                                onClick={() => setScopeTrendGranularity('annual')}
                            >
                                {t('dashboard.scopeTrendAnnual')}
                            </button>
                            <button
                                type="button"
                                role="tab"
                                aria-selected={scopeTrendGranularity === 'monthly'}
                                className={`dash-ct-tab ${scopeTrendGranularity === 'monthly' ? 'on' : ''}`}
                                onClick={() => setScopeTrendGranularity('monthly')}
                            >
                                {t('dashboard.scopeTrendMonthly')}
                            </button>
                        </div>
                    </div>
                    <div className="dash-chart-tall">
                        <Bar data={scopeWiseStackedBarData} options={stackedBarChartOptions} />
                    </div>
                    <div className="dash-lgd">
                        <div className="dash-lgd-i">
                            <span className="dash-lgd-d" style={{ background: '#1A9A8F' }} />
                            {t('dashboard.legendScope1')}
                        </div>
                        <div className="dash-lgd-i">
                            <span className="dash-lgd-d" style={{ background: '#3DC8BE' }} />
                            {t('dashboard.legendScope2')}
                        </div>
                        <div className="dash-lgd-i">
                            <span className="dash-lgd-d" style={{ background: '#A8DDD9' }} />
                            {t('dashboard.legendScope3')}
                        </div>
                    </div>
                </div>
                <div className="dash-card">
                    <div className="dash-ct">
                        <span>{t('dashboard.esgTrendChartTitle')}</span>
                    </div>
                    <div className="dash-chart-tall">
                        <Line data={esgTrendChartData} options={esgTrendChartOptions} />
                    </div>
                    <div className="dash-lgd">
                        <div className="dash-lgd-i">
                            <span className="dash-lgd-d" style={{ background: '#1A9A8F' }} />
                            {t('dashboard.legendEnv')}
                        </div>
                        <div className="dash-lgd-i">
                            <span className="dash-lgd-d" style={{ background: '#3DC8BE' }} />
                            {t('dashboard.legendSoc')}
                        </div>
                        <div className="dash-lgd-i">
                            <span className="dash-lgd-d" style={{ background: '#85D8D4' }} />
                            {t('dashboard.legendGov')}
                        </div>
                    </div>
                </div>
            </div>

            <div className="dash-g3">
                <div className="dash-card">
                    <div className="dash-ct">
                        <span>{t('dashboard.upcomingTasks')}</span>
                        <span className="dash-badge dash-badge-red">{t('dashboard.tasksOpenBadge', { count: 14 })}</span>
                    </div>
                    <ul className="dash-task-rows">
                        {upcomingTasks.map((task) => {
                            const done = completedTasks.has(task.id);
                            return (
                                <li key={task.id} className={`dash-task-row ${done ? 'dash-task-completed' : ''}`}>
                                    <button
                                        type="button"
                                        className={`dash-task-box ${done ? 'done' : ''}`}
                                        onClick={() => toggleTask(task.id)}
                                        aria-label={done ? t('dashboard.markIncomplete') || 'Mark incomplete' : t('dashboard.markComplete') || 'Mark complete'}
                                        title={done ? 'Mark incomplete' : 'Mark complete'}
                                    >
                                        {done ? <i className="fas fa-check" /> : null}
                                    </button>
                                    <span className={`dash-task-title ${done ? 'dash-task-title--done' : ''}`}>{task.title}</span>
                                    <span className={task.urgent && !done ? 'dash-task-due urgent' : 'dash-task-due'}>
                                        {done ? (t('dashboard.taskDone') || 'Done') : t('dashboard.taskDueIn', { days: task.days })}
                                    </span>
                                </li>
                            );
                        })}
                    </ul>
                </div>
                <div className="dash-card">
                    <div className="dash-ct">
                        <span className="dash-ai-badge">✦ {t('dashboard.aiRecsBadge')}</span>
                        <span>{t('dashboard.aiRecsTitle')}</span>
                    </div>
                    <div className="dash-air-list">
                        <div className="dash-air">
                            <div className="dash-air-ico">
                                <i className="fas fa-lightbulb" />
                            </div>
                            <div className="dash-air-content">
                                <div className="dash-air-title">{t('dashboard.aiRec1Title')}</div>
                                <div className="dash-air-desc">{t('dashboard.aiRec1Desc')}</div>
                                <button type="button" className="dash-air-action" onClick={() => navigate('/decarbonization')}>
                                    {t('dashboard.aiRecAction') || 'View details'} <i className="fas fa-arrow-right" />
                                </button>
                            </div>
                        </div>
                        <div className="dash-air">
                            <div className="dash-air-ico">
                                <i className="fas fa-bolt" />
                            </div>
                            <div className="dash-air-content">
                                <div className="dash-air-title">{t('dashboard.aiRec2Title')}</div>
                                <div className="dash-air-desc">{t('dashboard.aiRec2Desc')}</div>
                                <button type="button" className="dash-air-action" onClick={() => navigate('/data-input')}>
                                    {t('dashboard.aiRecAction') || 'View details'} <i className="fas fa-arrow-right" />
                                </button>
                            </div>
                        </div>
                        <div className="dash-air">
                            <div className="dash-air-ico">
                                <i className="fas fa-triangle-exclamation" />
                            </div>
                            <div className="dash-air-content">
                                <div className="dash-air-title">{t('dashboard.aiRec3Title')}</div>
                                <div className="dash-air-desc">{t('dashboard.aiRec3Desc')}</div>
                                <button type="button" className="dash-air-action" onClick={() => navigate('/reports')}>
                                    {t('dashboard.aiRecAction') || 'View details'} <i className="fas fa-arrow-right" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="dash-card">
                    <div className="dash-ct">
                        <span>{t('dashboard.reportingDeadlines')}</span>
                    </div>
                    <ul className="dash-deadline-rows">
                        <li className="dash-deadline-row dash-deadline-row--clickable" onClick={() => navigate('/reports')} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && navigate('/reports')}>
                            <span>{t('dashboard.deadline1')}</span>
                            <span className="dash-badge dash-badge-red">{t('dashboard.deadline1d')}</span>
                        </li>
                        <li className="dash-deadline-row dash-deadline-row--clickable" onClick={() => navigate('/reports')} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && navigate('/reports')}>
                            <span>{t('dashboard.deadline2')}</span>
                            <span className="dash-badge dash-badge-amber">{t('dashboard.deadline2d')}</span>
                        </li>
                        <li className="dash-deadline-row dash-deadline-row--clickable" onClick={() => navigate('/esg')} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && navigate('/esg')}>
                            <span>{t('dashboard.deadline3')}</span>
                            <span className="dash-badge dash-badge-amber">{t('dashboard.deadline3d')}</span>
                        </li>
                        <li className="dash-deadline-row dash-deadline-row--clickable" onClick={() => navigate('/data-input')} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && navigate('/data-input')}>
                            <span>{t('dashboard.deadline4')}</span>
                            <span className="dash-badge dash-badge-blue">{t('dashboard.deadline4d')}</span>
                        </li>
                        <li className="dash-deadline-row dash-deadline-row--clickable" onClick={() => navigate('/supply-chain')} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && navigate('/supply-chain')}>
                            <span>{t('dashboard.deadline5')}</span>
                            <span className="dash-badge dash-badge-grey">{t('dashboard.deadline5d')}</span>
                        </li>
                    </ul>
                    <div className="dash-ct dash-ct-sub">{t('dashboard.auditAlerts')}</div>
                    <div className="dash-act">
                        <div className="dash-act-ico rd">
                            <i className="fas fa-triangle-exclamation" />
                        </div>
                        <div>
                            <div className="dash-act-title">
                                <strong>{t('dashboard.auditMissing')}:</strong> {t('dashboard.auditMissingBody', { year: filterYear })}
                            </div>
                            <div className="dash-act-meta">{t('dashboard.auditPlant', { plant: t('dashboard.auditPlantName') })}</div>
                        </div>
                    </div>
                    <div className="dash-act">
                        <div className="dash-act-ico am">
                            <i className="fas fa-circle-info" />
                        </div>
                        <div>
                            <div className="dash-act-title">
                                <strong>{t('dashboard.auditReview')}:</strong> {t('dashboard.auditReviewBody')}
                            </div>
                            <div className="dash-act-meta">{t('dashboard.auditAwaiting')}</div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="dash-g3 dash-g3-b">
                <div className="dash-card">
                    <div className="dash-ct">
                        <span>{t('dashboard.monthlyEnergyTitle')}</span>
                        <span className="dash-ct-muted">{t('dashboard.monthlyEnergyUnit')}</span>
                    </div>
                    <MonthlyEnergyChart months={monthsShort} t={t} />
                </div>
                <div className="dash-card">
                    <div className="dash-ct">
                        <span>{t('dashboard.wasteBreakdownTitle')}</span>
                    </div>
                    <div className="dash-waste-row">
                        <WasteDonutChart
                            labels={[t('dashboard.wasteRecycled'), t('dashboard.wasteComposted'), t('dashboard.wasteLandfill')]}
                        />
                        <div className="dash-waste-legend">
                            <div className="dash-waste-leg-row">
                                <span className="dash-lgd-d" style={{ background: '#1A9A8F' }} />
                                <span>{t('dashboard.wasteRecycled')}</span>
                                <span className="dash-waste-pct">42%</span>
                            </div>
                            <div className="dash-waste-leg-row">
                                <span className="dash-lgd-d" style={{ background: '#3DC8BE' }} />
                                <span>{t('dashboard.wasteComposted')}</span>
                                <span className="dash-waste-pct">26%</span>
                            </div>
                            <div className="dash-waste-leg-row">
                                <span className="dash-lgd-d" style={{ background: '#C8EDEA' }} />
                                <span>{t('dashboard.wasteLandfill')}</span>
                                <span className="dash-waste-pct">32%</span>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="dash-card">
                    <div className="dash-ct">
                        <span>{t('dashboard.supplierTitle')}</span>
                    </div>
                    <ProgressBarRow label={t('dashboard.supplierTier1Ok')} pct={74} color="var(--up-green, #27ae60)" />
                    <ProgressBarRow label={t('dashboard.supplierTier1Prog')} pct={18} color="var(--up-amber, #f39c12)" />
                    <ProgressBarRow label={t('dashboard.supplierNonCompliant')} pct={8} color="var(--up-red, #e74c3c)" />
                    <ProgressBarRow label={t('dashboard.supplierTier2')} pct={46} color="var(--up-blue, #2980b9)" />
                </div>
            </div>


            {/* Footer */}
            <div className="dashboard-footer">
                <p>{t('dashboard.dataLastUpdated')} {new Date().toLocaleString(dateLocale)}</p>
                <p>{t('dashboard.versionFooter')}</p>
            </div>
        </div>
    );
}

export default Dashboard;

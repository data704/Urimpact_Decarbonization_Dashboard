import { useEffect, useRef, useState, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
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

    const scope1TableRows = hasToken && apiEmissions.length ? scope1List.slice(0, 5) : scope1Entries.slice(0, 5);
    const scope2TableRows = hasToken && apiEmissions.length ? scope2List.slice(0, 5) : scope2Entries.slice(0, 5);
    const recentActivitiesRows = hasToken && apiEmissions.length
        ? apiEmissions.slice(0, 5).map((e) => ({
            id: e.id,
            source: e.activityType,
            date: e.billingPeriodStart || e.calculatedAt,
            type: e.scope === 'SCOPE_1' ? 'scope1' : e.scope === 'SCOPE_2' ? 'scope2' : 'scope3',
            amount: kgToTonnes(e.co2e),
            dataSource: e.dataSource || '—',
            status: 'verified',
        }))
        : activities.slice(0, 5);

    return (
        <div className="dashboard-content">
            {/* Page Header */}
            <div className="page-header page-header-with-filter">
                <div>
                    <h1>{t('dashboard.title')}</h1>
                    <p>{t('dashboard.subtitle')}</p>
                </div>
                {hasToken && (
                    <span className="dashboard-filter-label">{periodLabel} {t('dashboard.dash')} {filterYear}</span>
                )}
            </div>

            {/* Date Filter */}
            {hasToken && (
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

            {/* Summary Cards */}
            <div className="summary-cards">
                <div className="card summary-card total">
                    <div className="card-content">
                        <h3>{t('dashboard.totalEmissions')}</h3>
                        <div className="value">
                            {formatNumber(totalEmissions)}
                            <span className="unit">tCO₂e</span>
                        </div>
                        {apiDashboard?.emissions?.trend?.length > 1 && (
                            <div className="trend down">
                                <i className="fas fa-chart-line"></i>
                                <span>{t('dashboard.last12Months')}</span>
                            </div>
                        )}
                    </div>
                    <div className="card-icon">
                        <i className="fas fa-cloud"></i>
                    </div>
                </div>

                <div className="card summary-card scope1">
                    <div className="card-content">
                        <h3>{t('dashboard.scope1Emissions')}</h3>
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
                        <h3>{t('dashboard.scope2Emissions')}</h3>
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
                                            <td><span className="source-badge">{dataSource}</span></td>
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
                                            <td><span className="source-badge">{dataSource}</span></td>
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

            {/* Recent Activities */}
                <div className="card facility-card">
                <div className="card-header">
                    <h2>
                        <i className="fas fa-history"></i>
                        {t('dashboard.recentActivities')}
                    </h2>
                </div>
                <div className="facility-table-wrapper">
                    <table className="facility-table">
                        <thead>
                            <tr>
                                {hasToken && <th style={{ width: '2.5rem' }}>
                                    <input
                                        type="checkbox"
                                        aria-label={t('dashboard.selectAllRecent')}
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
                            {recentActivitiesRows.map((activity, index) => (
                                <tr key={activity.id || index}>
                                    {hasToken && (
                                        <td>
                                            {activity.id && (
                                                <input
                                                    type="checkbox"
                                                    checked={selectedEmissionIds.includes(activity.id)}
                                                    onChange={() => toggleEmissionSelected(activity.id)}
                                                    aria-label={t('dashboard.selectThisEmission')}
                                                />
                                            )}
                                        </td>
                                    )}
                                    <td>{activity.source}</td>
                                    <td>{activity.date ? formatDate(activity.date) : '—'}</td>
                                    <td>
                                        <span className={`type-badge ${activity.type}`}>
                                            {activity.type === 'scope1' ? t('dashboard.scope1') : activity.type === 'scope2' ? t('dashboard.scope2') : t('dashboard.scope3')}
                                        </span>
                                    </td>
                                    <td>{formatNumber(activity.amount)} tCO₂e</td>
                                    <td><span className="source-badge">{activity.dataSource || '—'}</span></td>
                                    <td>
                                        <span className="status-badge verified">{t('dashboard.verified')}</span>
                                    </td>
                                    {hasToken && (
                                        <td className="td-actions">
                                            {activity.id ? (
                                                <button
                                                    type="button"
                                                    className="btn-icon btn-delete"
                                                    onClick={() => handleDeleteEmission(activity.id)}
                                                    disabled={deletingId === activity.id}
                                                    title={t('dashboard.deleteThisRecord')}
                                                    aria-label={t('dashboard.delete')}
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

            {/* Footer */}
            <div className="dashboard-footer">
                <p>{t('dashboard.dataLastUpdated')} {new Date().toLocaleString(dateLocale)}</p>
                <p>{t('dashboard.versionFooter')}</p>
            </div>
        </div>
    );
}

export default Dashboard;

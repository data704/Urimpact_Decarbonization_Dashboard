import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler,
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';
import { BarElement } from 'chart.js';
import { useDataStore } from '../../context/DataStoreContext';
import { getAuthToken, getDashboard } from '../../api/client';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import './Reports.css';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    Title,
    Tooltip,
    Legend,
    Filler
);

const EMPLOYEES = 164;
const YOY_REDUCTION = -12;
const DECARB_CONFIG_KEY = 'urimpact_decarbonization_config';

function Reports() {
    const decarbConfig = useMemo(() => {
        try {
            const s = localStorage.getItem(DECARB_CONFIG_KEY);
            if (!s) return null;
            const c = JSON.parse(s);
            if (!c.target_year || !c.ambition_level) return null;
            return c;
        } catch (_) {
            return null;
        }
    }, []);

    const {
        getTotalEmissions,
        getTotalScope1,
        getTotalScope2,
        getScope1Breakdown,
        getReportActivityData,
        getReportingPeriodLabel,
        getMonthlyData,
    } = useDataStore();

    const [reportRange, setReportRange] = useState('annual');
    const [customDateRange, setCustomDateRange] = useState(null);
    const [customModalOpen, setCustomModalOpen] = useState(false);
    const [customStart, setCustomStart] = useState('');
    const [customEnd, setCustomEnd] = useState('');
    const [notification, setNotification] = useState(null);
    const [toast, setToast] = useState('');

    const hasToken = Boolean(getAuthToken());
    const [apiReport, setApiReport] = useState(null);
    const [apiLoading, setApiLoading] = useState(false);
    const [pdfGenerating, setPdfGenerating] = useState(false);

    const dateRange = useMemo(() => {
        if (customDateRange?.start && customDateRange?.end) {
            return { start: customDateRange.start, end: customDateRange.end };
        }
        const now = new Date();
        if (reportRange === 'monthly') {
            const start = new Date(now.getFullYear(), now.getMonth(), 1);
            const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            return {
                start: start.toISOString().slice(0, 10),
                end: end.toISOString().slice(0, 10),
            };
        }
        const start = new Date(now.getFullYear(), 0, 1);
        const end = new Date(now.getFullYear(), 11, 31);
        return {
            start: start.toISOString().slice(0, 10),
            end: end.toISOString().slice(0, 10),
        };
    }, [reportRange, customDateRange]);

    useEffect(() => {
        if (!hasToken) {
            setApiReport(null);
            return;
        }
        let cancelled = false;
        setApiLoading(true);
        getDashboard({ startDate: dateRange.start, endDate: dateRange.end })
            .then((d) => {
                if (!cancelled) setApiReport(d);
            })
            .catch(() => {
                if (!cancelled) setApiReport(null);
            })
            .finally(() => {
                if (!cancelled) setApiLoading(false);
            });
        return () => { cancelled = true; };
    }, [hasToken, dateRange.start, dateRange.end]);

    const totalTonnes = apiReport?.emissions?.total?.totalCo2eTonnes ?? getTotalEmissions();
    const scope1Tonnes = apiReport?.emissions?.byScope?.SCOPE_1?.totalTonnes ?? getTotalScope1();
    const scope2Tonnes = apiReport?.emissions?.byScope?.SCOPE_2?.totalTonnes ?? getTotalScope2();

    const breakdown = useMemo(() => {
        if (apiReport?.emissions?.byCategory?.length) {
            const byCat = apiReport.emissions.byCategory;
            let mobile = 0, stationary = 0, electricity = 0;
            byCat.forEach((c) => {
                const t = c.totalTonnes ?? (c.total / 1000) ?? 0;
                if (c.category === 'ELECTRICITY') electricity = t;
                else if (c.category === 'FUEL_COMBUSTION' || c.category?.includes('MOBILE')) mobile += t;
                else stationary += t;
            });
            if (electricity === 0 && mobile === 0 && stationary === 0) {
                mobile = scope1Tonnes * 0.6;
                stationary = scope1Tonnes * 0.4;
                electricity = scope2Tonnes;
            }
            return { mobile, stationary, electricity };
        }
        const local = getScope1Breakdown();
        return {
            mobile: local['Mobile Combustion'] ?? scope1Tonnes * 0.6,
            stationary: local['Stationary Combustion'] ?? scope1Tonnes * 0.4,
            electricity: scope2Tonnes,
        };
    }, [apiReport, scope1Tonnes, scope2Tonnes, getScope1Breakdown]);

    const activityData = useMemo(() => {
        if (hasToken && apiReport) {
            return { mobile: { label: '—' }, stationary: { label: '—' }, scope2: { label: '—' } };
        }
        return getReportActivityData();
    }, [hasToken, apiReport, getReportActivityData]);

    const reportPeriodLabel = useMemo(() => {
        if (customDateRange?.start && customDateRange?.end) {
            return `Reporting Period: ${formatDateLabel(customDateRange.start)} – ${formatDateLabel(customDateRange.end)}`;
        }
        if (!hasToken && getReportingPeriodLabel()) {
            return 'Reporting Period: ' + getReportingPeriodLabel();
        }
        const s = new Date(dateRange.start);
        const e = new Date(dateRange.end);
        return `Reporting Period: ${formatDateLabel(dateRange.start)} – ${formatDateLabel(dateRange.end)}`;
    }, [customDateRange, dateRange, hasToken, getReportingPeriodLabel]);

    const totalForPercent = totalTonnes > 0 ? totalTonnes : 1;
    const intensity = totalTonnes / EMPLOYEES;

    const formatNumber = (val) => {
        const num = typeof val === 'number' ? val : parseFloat(val);
        return Number.isFinite(num) ? num.toLocaleString('en-US', { maximumFractionDigits: 1 }) : '0';
    };

    const calcPercent = (value, total) => (((value / total) * 100) | 0) + '%';

    function formatDateLabel(dateStr) {
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }

    const showNotification = (message, type = 'success') => {
        setNotification({ message, type });
        setTimeout(() => setNotification(null), 3000);
    };

    const showReportToast = (message) => {
        setToast(message);
        const t = setTimeout(() => setToast(''), 3000);
        return () => clearTimeout(t);
    };

    const handleCardClick = (range) => {
        if (range === 'custom') {
            setCustomModalOpen(true);
            setReportRange('custom');
            if (!customStart || !customEnd) {
                const today = new Date();
                setCustomEnd(today.toISOString().slice(0, 10));
                setCustomStart(new Date(today.getTime() - 29 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));
            }
            return;
        }
        setReportRange(range);
        setCustomDateRange(null);
        showReportToast(range === 'annual' ? 'Annual Report selected.' : 'Monthly Summary selected. Use Download PDF to export.');
    };

    const handleCustomApply = (e) => {
        e.preventDefault();
        if (!customStart || !customEnd) {
            showReportToast('Please select both start and end dates.');
            return;
        }
        if (new Date(customStart) > new Date(customEnd)) {
            showReportToast('End date must come after start date.');
            return;
        }
        setCustomDateRange({ start: customStart, end: customEnd });
        setCustomModalOpen(false);
        showReportToast('Custom range saved. Download PDF to export.');
    };

    const getChartDataUrl = (containerId) => {
        const el = document.getElementById(containerId);
        const canvas = el?.querySelector('canvas');
        if (!canvas) return null;
        try {
            return canvas.toDataURL('image/png');
        } catch (err) {
            console.warn('Chart to image failed', err);
            return null;
        }
    };

    const handleDownloadPDF = async () => {
        const reportEl = document.querySelector('.report-page');
        if (!reportEl) return;
        setPdfGenerating(true);

        // Snapshot chart canvases before cloning
        const pathwayImg = getChartDataUrl('pathwayChartContainer');
        const monthlyTrendImg = getChartDataUrl('monthlyTrendChartContainer');

        const clone = reportEl.cloneNode(true);

        // Replace canvases with static images in clone
        const replaceCanvasWithImage = (containerId, dataUrl) => {
            if (!dataUrl) return;
            const container = clone.querySelector(`#${containerId}`);
            const canvas = container?.querySelector('canvas');
            if (!container || !canvas) return;
            const img = document.createElement('img');
            img.src = dataUrl;
            img.alt = '';
            img.style.width = '100%';
            img.style.height = 'auto';
            img.style.display = 'block';
            container.replaceChild(img, canvas);
        };
        replaceCanvasWithImage('pathwayChartContainer', pathwayImg);
        replaceCanvasWithImage('monthlyTrendChartContainer', monthlyTrendImg);

        // Remove no-print elements from clone
        clone.querySelectorAll('.no-print').forEach((el) => el.remove());

        const pages = clone.querySelectorAll('.report-print-page');
        if (pages.length === 0) {
            showReportToast('No report pages to export.');
            setPdfGenerating(false);
            return;
        }

        const captureWidth = Math.max(reportEl.offsetWidth || 794, 794);

        // Off-screen wrapper for rendering
        const wrapper = document.createElement('div');
        wrapper.style.cssText = `position:fixed;left:-9999px;top:0;width:${captureWidth}px;background:#fff;z-index:-1;`;
        wrapper.appendChild(clone);
        document.body.appendChild(wrapper);

        try {
            const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
            const pageW = 210;
            const pageH = 297;
            const margin = 6; // mm margin top/bottom
            const usableH = pageH - margin * 2;
            let cursorY = margin; // current Y position on the active PDF page
            let isFirstPage = true;

            for (let i = 0; i < pages.length; i++) {
                const pageEl = pages[i];
                const isCover = pageEl.classList.contains('report-cover-page');

                // For the cover page: render it as a full A4 page
                if (isCover) {
                    const coverHeight = Math.round(captureWidth * (pageH / pageW));
                    pageEl.style.minHeight = `${coverHeight}px`;
                    pageEl.style.boxSizing = 'border-box';

                    if (!isFirstPage) pdf.addPage();

                    const canvas = await html2canvas(pageEl, {
                        scale: 2,
                        useCORS: true,
                        logging: false,
                        backgroundColor: null,
                    });
                    const imgData = canvas.toDataURL('image/png');
                    pdf.addImage(imgData, 'PNG', 0, 0, pageW, pageH, undefined, 'FAST');
                    isFirstPage = false;
                    cursorY = pageH; // force a new page for the next section
                    continue;
                }

                // For content pages: capture at natural height
                const canvas = await html2canvas(pageEl, {
                    scale: 2,
                    useCORS: true,
                    logging: false,
                    backgroundColor: '#ffffff',
                });

                const imgData = canvas.toDataURL('image/png');
                // Calculate the proportional height this section occupies at pageW width
                const imgRatio = canvas.height / canvas.width;
                const imgH = pageW * imgRatio; // height in mm when scaled to page width

                // Check if we need a new page
                if (!isFirstPage && cursorY + imgH > pageH - margin) {
                    pdf.addPage();
                    cursorY = margin;
                } else if (isFirstPage) {
                    // First content page (after cover already added a page)
                    if (cursorY >= pageH) {
                        pdf.addPage();
                        cursorY = margin;
                    }
                    isFirstPage = false;
                }

                pdf.addImage(imgData, 'PNG', 0, cursorY, pageW, imgH, undefined, 'FAST');
                cursorY += imgH + 2; // 2mm gap between sections
            }

            pdf.save('URIMPACT_Decarbonization_Report.pdf');
            showReportToast('PDF downloaded successfully.');
        } catch (err) {
            console.error('PDF export failed', err);
            showReportToast('PDF export failed. Try again or use Print to PDF.');
        } finally {
            if (wrapper.parentNode) document.body.removeChild(wrapper);
            setPdfGenerating(false);
        }
    };

    const baseYear = new Date(dateRange.start).getFullYear();
    const pathwayChartData = useMemo(() => {
        const base = totalTonnes || 2;
        const startY = baseYear;
        const endY = decarbConfig?.target_year || baseYear + 5;
        const years = [];
        for (let y = startY; y <= endY; y++) years.push(String(y));
        const bau = years.map((_, i) => Math.max(0, base - (i * 25)));
        const intervention = years.map((_, i) => Math.max(0, base - (i * 180)));
        return {
            labels: years,
            datasets: [
                {
                    label: 'Business as Usual',
                    data: bau,
                    borderColor: '#1E293B',
                    backgroundColor: 'rgba(30,41,59,0.1)',
                    tension: 0.35,
                    fill: true,
                },
                {
                    label: 'Recommended Interventions',
                    data: intervention,
                    borderColor: '#14B8A6',
                    backgroundColor: 'rgba(20,184,166,0.15)',
                    tension: 0.35,
                    fill: true,
                },
            ],
        };
    }, [totalTonnes, baseYear, decarbConfig?.target_year]);

    const monthlyTrendData = useMemo(() => {
        const trend = apiReport?.emissions?.trend;
        if (trend && Array.isArray(trend) && trend.length > 0) {
            const fmtMonth = (m) => {
                if (!m) return '';
                const [y, mo] = String(m).split('-');
                const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
                return months[parseInt(mo, 10) - 1] + ' ' + (y || '');
            };
            return {
                labels: trend.map((t) => t.label || fmtMonth(t.month)),
                datasets: [{
                    label: 'Emissions (tCO₂e)',
                    data: trend.map((t) => t.totalTonnes ?? (kgToTonnes((t.scope1 || 0) + (t.scope2 || 0)))),
                    backgroundColor: 'rgba(20,184,166,0.5)',
                    borderColor: '#14B8A6',
                }],
            };
        }
        const monthly = getMonthlyData();
        return {
            labels: monthly.labels,
            datasets: [{
                label: 'Emissions (tCO₂e)',
                data: monthly.labels.map((_, i) => (monthly.scope1[i] || 0) + (monthly.scope2[i] || 0)),
                backgroundColor: 'rgba(20,184,166,0.5)',
                borderColor: '#14B8A6',
            }],
        };
    }, [apiReport, getMonthlyData]);

    function kgToTonnes(kg) {
        return kg == null ? 0 : kg / 1000;
    }

    const organizationName = decarbConfig?.organization_name || 'Your Organization';
    const targetYear = decarbConfig?.target_year ?? new Date().getFullYear() + 5;
    const ambitionLevel = decarbConfig?.ambition_level || 'NEAR_ZERO';
    const ambitionLabel = { COMPLIANCE_MINIMUM: 'Compliance / Minimum Reduction', PARTIAL_REDUCTION: 'Partial Reduction (30-50%)', NEAR_ZERO: 'Near-Zero (90-95% reduction)', NET_ZERO: 'Net-Zero (100% reduction or offset)' }[ambitionLevel] || ambitionLevel;

    const carbonPrice = 85;
    const bauTax = Math.round(totalTonnes * carbonPrice * 5);
    const intTax = Math.round(bauTax * 0.14);
    const varTax = bauTax - intTax;
    const netBenefit = 900000;

    const yoyPercent = Math.abs(YOY_REDUCTION);
    const priorYearEmissions = totalTonnes / (1 + YOY_REDUCTION / 100);
    const reductionPercent = ambitionLevel === 'NET_ZERO' ? 100 : ambitionLevel === 'NEAR_ZERO' ? 85.1 : ambitionLevel === 'PARTIAL_REDUCTION' ? 45 : 25;
    const residualTotal = Math.max(0, totalTonnes * (1 - reductionPercent / 100));
    const nearZeroThreshold = totalTonnes * 0.10;
    const requiredRemovals = Math.max(0, residualTotal - nearZeroThreshold);
    const sequestrationRatePerTree = 0.025;
    const treesRequiredAnnual = Math.round(requiredRemovals / sequestrationRatePerTree);
    const treesCumulative5yr = treesRequiredAnnual * 5;
    const finalAlignedEmissions = nearZeroThreshold;
    const bauTargetYearTonnes = totalTonnes * 1.077;
    const totalBauCost = Math.round(bauTax + 2400000);
    const totalInterventionCost = Math.round(totalBauCost - netBenefit);
    const peerComparisonPercent = Math.min(60, Math.round(50 * (1 + totalTonnes / 2000)));
    const avoidedTonnesByTargetYear = Math.round(bauTargetYearTonnes - residualTotal);
    const cumulativeAvoided = Math.round(totalTonnes * 3.14);
    const vehiclesEquivalent = Math.round(cumulativeAvoided / 4.6);
    const annualCarbonLiabilityK = Math.round((totalTonnes * 50) / 1000) || 104;

    const customCardSubtitle = customDateRange?.start && customDateRange?.end
        ? `${formatDateLabel(customDateRange.start)} → ${formatDateLabel(customDateRange.end)}`
        : 'Tap to pick a date range';

    if (!decarbConfig) {
        return (
            <div className="reports-content">
                <div className="page-header">
                    <h1>Reports</h1>
                    <p>Generate comprehensive emission reports for compliance and analysis</p>
                </div>
                <div className="report-gate card">
                    <div className="report-gate-icon">
                        <i className="fas fa-lock"></i>
                    </div>
                    <h2>Reports require Inputs &amp; Constraints</h2>
                    <p>To access Reports, please complete the <strong>Inputs &amp; Constraints</strong> form in the Decarbonization section. Your target year and ambition level will be used to generate the Decarbonization Report.</p>
                    <Link to="/decarbonization" className="btn btn-primary">
                        <i className="fas fa-leaf"></i> Go to Decarbonization
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="reports-content">
            {notification && (
                <div className={`notification ${notification.type}`}>
                    <i className={`fas fa-${notification.type === 'success' ? 'check-circle' : 'info-circle'}`}></i>
                    <span>{notification.message}</span>
                </div>
            )}

            <div className="page-header">
                <h1>Reports</h1>
                <p>Generate comprehensive emission reports for compliance and analysis</p>
            </div>

            <div className="dashboard-content report-page">
                <section className="report-actions no-print">
                    <div className="report-option-cards">
                        <div
                            className={`report-card ${reportRange === 'annual' && !customDateRange ? 'active' : ''}`}
                            onClick={() => { setReportRange('annual'); setCustomDateRange(null); showReportToast('Annual Report selected. Use Download PDF to export.'); }}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => e.key === 'Enter' && (setReportRange('annual'), setCustomDateRange(null))}
                        >
                            <div className="report-card-icon calendar"><i className="fas fa-calendar"></i></div>
                            <div>
                                <span>Annual Report</span>
                                <p>FY {new Date().getFullYear()} inventory</p>
                            </div>
                        </div>
                        <div
                            className={`report-card ${reportRange === 'monthly' ? 'active' : ''}`}
                            onClick={() => handleCardClick('monthly')}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => e.key === 'Enter' && handleCardClick('monthly')}
                        >
                            <div className="report-card-icon month"><i className="fas fa-chart-line"></i></div>
                            <div>
                                <span>Monthly Summary</span>
                                <p>Latest month snapshot</p>
                            </div>
                        </div>
                        <div
                            className={`report-card custom-card ${reportRange === 'custom' && customDateRange ? 'active' : ''}`}
                            onClick={() => handleCardClick('custom')}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => e.key === 'Enter' && handleCardClick('custom')}
                        >
                            <div className="report-card-icon sliders"><i className="fas fa-sliders-h"></i></div>
                            <div>
                                <span>Assign custom dates</span>
                                <p>{customCardSubtitle}</p>
                            </div>
                        </div>
                    </div>
                    <div className="report-actions-cta">
                        <button type="button" className="btn btn-primary pdf-btn" onClick={handleDownloadPDF} disabled={pdfGenerating}>
                            <i className="fas fa-file-pdf"></i> {pdfGenerating ? 'Generating PDF…' : 'Download PDF'}
                        </button>
                        <small>Exports directly as PDF via URIMPACT (urimpact.sa)</small>
                    </div>
                </section>

                {apiLoading ? (
                    <div className="report-loading">Loading report data…</div>
                ) : (
                    <>
                        <div className="report-print-page report-cover-page">
                            <div className="report-cover-bg" aria-hidden="true" />
                            <header className="report-cover-logo">
                                <img src="/logo.svg" alt="" className="report-cover-logo-icon" aria-hidden="true" />
                                <span className="report-cover-logo-text">URIMPACT</span>
                            </header>
                            <div className="report-cover-center">
                                <svg className="report-cover-chart-icon" viewBox="0 0 48 28" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                                    <path d="M2 20 L18 12 L34 6 L46 14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                                <h1 className="report-cover-title">Decarbonization Report</h1>
                                <p className="report-cover-org">{organizationName}</p>
                                <p className="report-cover-subtitle">{new Date(dateRange.start).getFullYear()} Analysis &amp; Pathway to {targetYear}</p>
                                <p className="report-cover-period">{reportPeriodLabel}</p>
                            </div>
                            <div className="report-page-footer report-cover-footer">1 of 17 | Generated by URIMPACT Platform</div>
                        </div>

                        <div className="report-print-page">
                            <section className="card report-section">
                                <div className="section-title">{(new Date(dateRange.start).getFullYear())} Performance at a Glance</div>
                                <p className="body-text insight-lead">Strong baseline performance with {yoyPercent}% year-over-year emissions reduction</p>
                                <div className="metrics-grid metrics-inline">
                                    <div className="card metric-card">
                                        <span className="metric-label">Total {(new Date(dateRange.start).getFullYear())} Emissions</span>
                                        <span className="metric-value">{formatNumber(totalTonnes)} tCO₂e</span>
                                        <span className="metric-subtitle">Scope 1 + Scope 2</span>
                                    </div>
                                    <div className="card metric-card metric-positive">
                                        <span className="metric-label">YoY Reduction</span>
                                        <span className="metric-value">↓ {yoyPercent}%</span>
                                        <span className="metric-subtitle">Reduction from {formatNumber(Math.round(priorYearEmissions))} tCO₂e in {baseYear - 1}</span>
                                    </div>
                                    <div className="card metric-card">
                                        <span className="metric-label">Intensity per Employee</span>
                                        <span className="metric-value">{formatNumber(intensity.toFixed(2))} tCO₂e</span>
                                        <span className="metric-subtitle">{peerComparisonPercent}% below regional peer average</span>
                                    </div>
                                    <div className="card metric-card">
                                        <span className="metric-label">Data Quality</span>
                                        <span className="metric-value">High (100%)</span>
                                        <span className="metric-subtitle">100% data completeness and consistency</span>
                                    </div>
                                </div>
                                <p className="body-text insight-text">
                                    <strong>Insight:</strong> {organizationName} demonstrates exceptional emissions performance, outperforming regional peers by nearly half while maintaining operational growth. This strong baseline positions the company favourably for ambitious decarbonization targets.
                                </p>
                            </section>
                            <div className="report-page-footer">2 of 17 | Generated by URIMPACT Platform</div>
                        </div>

                        <div className="report-print-page">
                            <section className="card report-section">
                                <div className="section-title">Methodology &amp; Scope</div>
                                <p className="body-text lead">GHG Protocol-aligned accounting ensures credible, comparable emissions data</p>
                                <div className="methodology-list">
                                    <p className="body-text"><strong>Accounting Standard</strong><br />GHG Protocol Corporate Standard — the global gold standard for corporate emissions accounting</p>
                                    <p className="body-text"><strong>Scopes Covered</strong><br />Scope 1 (mobile and stationary combustion), Scope 2 (purchased electricity)</p>
                                    <p className="body-text"><strong>Scope 2 Method</strong><br />Location-based method using regional grid emission factors. Market-based Scope 2 emissions not calculated unless contractual instruments (PPAs, RECs) are provided.</p>
                                    <p className="body-text"><strong>Data Sources</strong><br />Direct meter readings, fuel purchase invoices, utility bills — all primary data with 100% completeness</p>
                                </div>
                                <p className="body-text"><strong>Rationale:</strong> Location-based method provides a conservative baseline. Future market-based accounting will enable recognition of renewable energy procurement benefits.</p>
                                <ul className="body-text bullet-list">
                                    <li>Scope 1: Mobile combustion (diesel fleet vehicles) and stationary combustion (natural gas for facilities)</li>
                                    <li>Scope 2: Purchased electricity for warehouses and offices</li>
                                </ul>
                            </section>
                            <div className="report-page-footer">3 of 17 | Generated by URIMPACT Platform</div>
                        </div>

                        <div className="report-print-page">
                            <section className="card report-section">
                                <div className="section-title">Monthly Emissions Trend Analysis</div>
                                <p className="body-text lead">Seasonal variation in emissions driven by electricity consumption patterns</p>
                                <div id="monthlyTrendChartContainer" className="chart-container report-chart">
                                    <Bar
                                        data={monthlyTrendData}
                                        options={{
                                            responsive: true,
                                            maintainAspectRatio: false,
                                            plugins: { legend: { position: 'bottom' } },
                                            scales: {
                                                y: { beginAtZero: true, grid: { color: '#F1F5F9' } },
                                                x: { grid: { display: false } },
                                            },
                                        }}
                                    />
                                </div>
                                <p className="body-text"><strong>Key Insight:</strong> Emissions trend is driven by your uploaded receipts and manual entries. Use Data Input to maintain full coverage for the reporting period.</p>
                            </section>
                            <div className="report-page-footer">4 of 17 | Generated by URIMPACT Platform</div>
                        </div>

                        <div className="report-print-page">
                            <section className="card report-section">
                                <div className="section-title">Emissions Source Breakdown</div>
                                <p className="body-text lead">Purchased electricity dominates emissions profile at {calcPercent(breakdown.electricity, totalForPercent)} of total footprint</p>
                                <div className="breakdown-cards">
                                    <div className="breakdown-card">
                                        <span className="breakdown-label">Purchased Electricity</span>
                                        <span className="breakdown-pct">{calcPercent(breakdown.electricity, totalForPercent)} of total</span>
                                        <span className="breakdown-value">{formatNumber(breakdown.electricity)} tCO₂e</span>
                                    </div>
                                    <div className="breakdown-card">
                                        <span className="breakdown-label">Diesel (Mobile)</span>
                                        <span className="breakdown-pct">{calcPercent(breakdown.mobile, totalForPercent)} of total</span>
                                        <span className="breakdown-value">{formatNumber(breakdown.mobile)} tCO₂e</span>
                                    </div>
                                    <div className="breakdown-card">
                                        <span className="breakdown-label">Natural Gas (Stationary)</span>
                                        <span className="breakdown-pct">{calcPercent(breakdown.stationary, totalForPercent)} of total</span>
                                        <span className="breakdown-value">{formatNumber(breakdown.stationary)} tCO₂e</span>
                                    </div>
                                </div>
                                <p className="body-text"><strong>Strategic Implication:</strong> Electricity&apos;s dominance makes it the primary decarbonization lever. Switching to renewable electricity can eliminate nearly 70% of the carbon footprint. Fleet electrification addresses the second-largest source.</p>
                                <div className="table-wrap">
                                    <table className="report-table">
                                        <thead>
                                            <tr>
                                                <th>Source Category</th>
                                                <th>Scope</th>
                                                <th>Activity Data</th>
                                                <th>Emissions (tCO₂e)</th>
                                                <th>% of Total</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr>
                                                <td>Mobile Combustion</td>
                                                <td>1</td>
                                                <td>{activityData.mobile.label}</td>
                                                <td>{formatNumber(breakdown.mobile)}</td>
                                                <td>{calcPercent(breakdown.mobile, totalForPercent)}</td>
                                            </tr>
                                            <tr>
                                                <td>Stationary Combustion</td>
                                                <td>1</td>
                                                <td>{activityData.stationary.label}</td>
                                                <td>{formatNumber(breakdown.stationary)}</td>
                                                <td>{calcPercent(breakdown.stationary, totalForPercent)}</td>
                                            </tr>
                                            <tr>
                                                <td>Purchased Electricity</td>
                                                <td>2</td>
                                                <td>{activityData.scope2.label}</td>
                                                <td>{formatNumber(breakdown.electricity)}</td>
                                                <td>{calcPercent(breakdown.electricity, totalForPercent)}</td>
                                            </tr>
                                            <tr className="total-row">
                                                <td>Total</td>
                                                <td>-</td>
                                                <td>-</td>
                                                <td>{formatNumber(totalTonnes)}</td>
                                                <td>100%</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </section>
                            <div className="report-page-footer">5 of 17 | Generated by URIMPACT Platform</div>
                        </div>

                        <div className="report-print-page">
                            <section className="card report-section">
                                <div className="section-title">Decarbonization Pathway Overview</div>
                                <p className="body-text lead">{ambitionLevel.replace(/_/g, ' ')} ambition achieves {reductionPercent}% reduction by {targetYear} through three core interventions</p>
                                <div className="pathway-overview-box">
                                    <p className="body-text"><strong>{ambitionLevel.replace(/_/g, ' ')} Ambition Level</strong></p>
                                    <p className="body-text">Residual emissions ≤10% of baseline Scope 1 &amp; 2 by target year ({targetYear}).</p>
                                    <p className="body-text">Target: {formatNumber(totalTonnes)} tCO₂e ({baseYear}) → {formatNumber(residualTotal)} tCO₂e ({targetYear})</p>
                                </div>
                                <div className="section-title sub">Three Pillars</div>
                                <div className="pillars-grid">
                                    <div className="pillar-card">
                                        <span className="pillar-icon">⚡</span>
                                        <strong>PILLAR 1 — Renewable Electricity Switch</strong>
                                        <p>Full transition to renewable energy contracts (PPAs or Green Tariffs) by {baseYear + 1}. Eliminates {formatNumber(Math.round(breakdown.electricity))} tCO₂e annually.</p>
                                    </div>
                                    <div className="pillar-card">
                                        <span className="pillar-icon">🔧</span>
                                        <strong>PILLAR 2 — Fleet Electrification</strong>
                                        <p>Progressive replacement of diesel vehicles with electrical alternatives — 10% annually, reaching 40% by {targetYear}. Reduces {formatNumber(Math.round(breakdown.mobile * 0.4))} tCO₂e by {targetYear}.</p>
                                    </div>
                                    <div className="pillar-card">
                                        <span className="pillar-icon">🌿</span>
                                        <strong>PILLAR 3 — Energy Efficiency &amp; Removals</strong>
                                        <p>LED lighting, HVAC optimization, building envelope improvements — 3% annual reduction. Ongoing savings across operations.</p>
                                    </div>
                                </div>
                                <p className="body-text"><strong>Pathway Logic:</strong> Front-load high-impact, low-complexity interventions (renewable electricity) to achieve rapid emissions reduction, followed by gradual fleet transition as EV infrastructure and economics improve.</p>
                            </section>
                            <div className="report-page-footer">6 of 17 | Generated by URIMPACT Platform</div>
                        </div>

                        <div className="report-print-page">
                            <section className="card report-section">
                                <div className="section-title">BAU vs. Intervention Pathway</div>
                                <p className="body-text lead">Intervention pathway diverges sharply from BAU in {baseYear + 1}, avoiding {formatNumber(avoidedTonnesByTargetYear)} tCO₂e by {targetYear}</p>
                                <div id="pathwayChartContainer" className="chart-container report-chart">
                                    <Line
                                        data={pathwayChartData}
                                        options={{
                                            responsive: true,
                                            maintainAspectRatio: false,
                                            plugins: { legend: { position: 'bottom' } },
                                            scales: {
                                                y: { beginAtZero: true, grid: { color: '#F1F5F9' } },
                                                x: { grid: { display: false } },
                                            },
                                        }}
                                    />
                                </div>
                                <p className="body-text"><strong>Cumulative Impact:</strong> Over 5 years, the intervention pathway avoids {formatNumber(cumulativeAvoided)} tCO₂e compared to BAU — equivalent to removing {formatNumber(vehiclesEquivalent)} passenger vehicles from the road for one year. The {reductionPercent}% reduction by {targetYear} achieves {ambitionLevel.replace(/_/g, ' ')} ambition.</p>
                            </section>
                            <div className="report-page-footer">7 of 17 | Generated by URIMPACT Platform</div>
                        </div>

                        <div className="report-print-page">
                            <section className="card report-section">
                                <div className="section-title">Residual Emissions &amp; Alignment Strategy</div>
                                <p className="body-text">{targetYear} residual emissions of {formatNumber(residualTotal)} tCO₂e require {formatNumber(requiredRemovals)} tCO₂e removal alignment for {ambitionLevel.replace(/_/g, ' ')} target</p>
                                <div className="pathway-overview-box">
                                    <p className="body-text"><strong>Residual Breakdown</strong></p>
                                    <ul className="body-text bullet-list removal-breakdown-list">
                                        <li>Diesel Fleet (60% non-electrified): {formatNumber(breakdown.mobile * 0.6)} tCO₂e</li>
                                        <li>Natural Gas (backup/heating): {formatNumber(breakdown.stationary)} tCO₂e</li>
                                        <li>Renewable Electricity: 0.00 tCO₂e</li>
                                        <li><strong>Total Residual (Scope 1 &amp; 2):</strong> {formatNumber(residualTotal)} tCO₂e</li>
                                    </ul>
                                    <p className="body-text"><strong>Alignment Mechanism</strong></p>
                                    <p className="body-text">Required Removals: {formatNumber(requiredRemovals)} tCO₂e annually to meet ≤10% threshold ({ambitionLevel.replace(/_/g, ' ')} definition). Approach: Annual, ex-post, time-aligned carbon removals from verified nature-based solutions (reforestation, soil carbon sequestration). These are for alignment purposes and do not constitute carbon offsets or regulatory compliance claims. Focus remains on reduction-first strategy.</p>
                                </div>
                            </section>
                            <div className="report-page-footer">8 of 17 | Generated by URIMPACT Platform</div>
                        </div>

                        <div className="report-print-page">
                            <section className="card report-section">
                                <div className="section-title">Tree Equivalency &amp; Removal Alignment</div>
                                <p className="body-text lead">Achieving {ambitionLevel.replace(/_/g, ' ')} ambition through nature-based removal capacity</p>
                                <div className="removal-calculation-box">
                                    <div className="section-title sub">Removal Calculation</div>
                                    <table className="report-table calculation-table">
                                        <tbody>
                                            <tr><td>Baseline Emissions ({baseYear})</td><td>{formatNumber(totalTonnes)} tCO₂e</td></tr>
                                            <tr><td>{ambitionLevel.replace(/_/g, ' ')} Threshold (10%)</td><td>{formatNumber(nearZeroThreshold)} tCO₂e</td></tr>
                                            <tr><td>Residual Emissions ({targetYear})</td><td>{formatNumber(residualTotal)} tCO₂e</td></tr>
                                            <tr><td>Required Removals</td><td>{formatNumber(requiredRemovals)} tCO₂e</td></tr>
                                            <tr><td>Sequestration Rate</td><td>{sequestrationRatePerTree} tCO₂e/tree/yr</td></tr>
                                            <tr><td>Trees Required (Annual)</td><td>{formatNumber(treesRequiredAnnual)} trees</td></tr>
                                            <tr><td>Cumulative ({baseYear + 1}–{targetYear})</td><td>{formatNumber(treesCumulative5yr)} trees</td></tr>
                                            <tr><td>Final Aligned Emissions</td><td>{formatNumber(finalAlignedEmissions)} tCO₂e</td></tr>
                                        </tbody>
                                    </table>
                                </div>
                                <div className="tree-highlight-box">
                                    <span className="tree-highlight-number">{formatNumber(treesRequiredAnnual)}</span>
                                    <span className="tree-highlight-label">Trees Required Annually</span>
                                    <span className="tree-highlight-desc">Represents annual removal capacity aligned to residual emissions (25 kg CO₂e per tree per year)</span>
                                </div>
                                <p className="body-text body-text-small"><strong>Important:</strong> Tree sequestration rates vary by species, geography, age profile, and permanence safeguards. Actual removal capacity depends on third-party verification and long-term monitoring. Required removals represent annual, time-aligned carbon removals and do not constitute a carbon offset or compliance claim.</p>
                            </section>
                            <div className="report-page-footer">9 of 17 | Generated by URIMPACT Platform</div>
                        </div>

                        <div className="report-print-page">
                            <section className="card report-section">
                                <div className="section-title">Scenario Comparison: BAU vs Reduction vs Removal</div>
                                <p className="body-text lead">Target Year {targetYear} Emissions Across Three Pathways</p>
                                <p className="body-text"><strong>Summary Metrics</strong></p>
                                <div className="summary-metrics-box">
                                    <table className="report-table calculation-table">
                                        <tbody>
                                            <tr><td>Baseline ({baseYear})</td><td>{formatNumber(totalTonnes)} tCO₂e</td></tr>
                                            <tr><td>Target BAU ({targetYear})</td><td>{formatNumber(bauTargetYearTonnes)} tCO₂e</td></tr>
                                            <tr><td>Reduction Pathway</td><td>{formatNumber(residualTotal)} tCO₂e</td></tr>
                                            <tr><td>Required Removals</td><td>{formatNumber(requiredRemovals)} tCO₂e</td></tr>
                                            <tr><td>Trees (Annual)</td><td>{formatNumber(treesRequiredAnnual)} trees</td></tr>
                                        </tbody>
                                    </table>
                                </div>
                                <p className="body-text"><strong>Key Insights:</strong> Structural reductions (renewable electricity, fleet electrification, energy efficiency) achieve {reductionPercent}% reduction from BAU, reducing emissions from {formatNumber(bauTargetYearTonnes)} tCO₂e to {formatNumber(residualTotal)} tCO₂e. Residual emissions ({formatNumber(residualTotal)} tCO₂e) consist of technically constrained diesel fleet operations and natural gas use. Removal alignment ({formatNumber(treesRequiredAnnual)} trees annually providing {formatNumber(requiredRemovals)} tCO₂e removal capacity) brings final emissions to {formatNumber(finalAlignedEmissions)} tCO₂e, achieving the {ambitionLevel.replace(/_/g, ' ')} threshold (≤10% of baseline). Removals do not replace reductions—they align residual emissions only.</p>
                            </section>
                            <div className="report-page-footer">10 of 17 | Generated by URIMPACT Platform</div>
                        </div>

                        <div className="report-print-page">
                            <section className="card report-section">
                                <div className="section-title">Financial ROI &amp; Business Case</div>
                                <p className="body-text lead">Decarbonization delivers ${formatNumber(netBenefit)} net savings over {baseYear + 1}–{targetYear} while mitigating carbon price risk</p>
                                <div className="roi-cards">
                                    <div className="roi-card">
                                        <span className="roi-card-label">Total BAU Cost ({baseYear + 1}–{targetYear})</span>
                                        <span className="roi-card-value">${formatNumber(totalBauCost)}</span>
                                        <span className="roi-card-desc">Energy + carbon liability</span>
                                    </div>
                                    <div className="roi-card">
                                        <span className="roi-card-label">Total Intervention Cost</span>
                                        <span className="roi-card-value">${formatNumber(totalInterventionCost)}</span>
                                        <span className="roi-card-desc">Renewable + EV + efficiency</span>
                                    </div>
                                    <div className="roi-card roi-card-highlight">
                                        <span className="roi-card-label">Net Savings (Positive ROI)</span>
                                        <span className="roi-card-value">${formatNumber(netBenefit)}</span>
                                        <span className="roi-card-desc">Payback by mid-{baseYear + 2} (18 months)</span>
                                    </div>
                                </div>
                            </section>
                            <div className="report-page-footer">11 of 17 | Generated by URIMPACT Platform</div>
                        </div>

                        <div className="report-print-page">
                            <section className="card report-section">
                                <div className="section-title">Climate Risks &amp; Opportunities (TCFD Framework)</div>
                                <p className="body-text lead">Proactive decarbonization mitigates ${annualCarbonLiabilityK}K annual carbon liability while unlocking green market access</p>
                                <div className="tcfd-cards">
                                    <div className="tcfd-card tcfd-risk">
                                        <span className="tcfd-card-badge">TRANSITION RISK</span>
                                        <strong className="tcfd-card-title">Policy Risk</strong>
                                        <p className="body-text">Emerging carbon pricing in MENA; exposure $104,840/year by {targetYear} at $50/tCO₂e. <strong>Mitigation:</strong> Pathway reduces exposure by ~85%.</p>
                                    </div>
                                    <div className="tcfd-card tcfd-risk">
                                        <span className="tcfd-card-badge">TRANSITION RISK</span>
                                        <strong className="tcfd-card-title">Market Risk</strong>
                                        <p className="body-text">Shifts to low-carbon providers risk contract loss to better-positioned competitors. <strong>Mitigation:</strong> Positioning enables green procurement participation and revenue upside.</p>
                                    </div>
                                    <div className="tcfd-card tcfd-risk">
                                        <span className="tcfd-card-badge">PHYSICAL RISK</span>
                                        <strong className="tcfd-card-title">Acute Risk</strong>
                                        <p className="body-text">More frequent extreme heat events (50+ days &gt;45°C) disrupting operations and fleet reliability. <strong>Mitigation:</strong> Efficiency and EVs reduce heat-related failures and grid reliance.</p>
                                    </div>
                                    <div className="tcfd-card tcfd-opportunity">
                                        <span className="tcfd-card-badge">OPPORTUNITY</span>
                                        <strong className="tcfd-card-title">Resource Efficiency</strong>
                                        <p className="body-text">Energy efficiency and renewables lower costs and hedge fuel-price risk. <strong>Action:</strong> ${Math.round(netBenefit/1000)}K net savings ({baseYear + 1}–{targetYear}) from energy measures.</p>
                                    </div>
                                    <div className="tcfd-card tcfd-opportunity">
                                        <span className="tcfd-card-badge">OPPORTUNITY</span>
                                        <strong className="tcfd-card-title">Reputation &amp; Market</strong>
                                        <p className="body-text">Stronger ESG positioning attracts customers and can yield financing premiums. <strong>Action:</strong> Report progress annually and engage customers.</p>
                                    </div>
                                </div>
                                <p className="body-text"><strong>Strategic Insight:</strong> Climate action is risk management — early decarbonization delivers financial and competitive benefits and positions {organizationName} ahead of upcoming reporting requirements.</p>
                            </section>
                            <div className="report-page-footer">12 of 17 | Generated by URIMPACT Platform</div>
                        </div>

                        <div className="report-print-page">
                            <section className="card report-section">
                                <div className="section-title">Implementation Roadmap &amp; Key Milestones</div>
                                <p className="body-text lead">Phased implementation over {baseYear + 1}–{targetYear} balances operational continuity with ambitious targets</p>
                                <p className="body-text"><strong>Critical Success Factors:</strong> Executive sponsorship, cross-functional coordination (Operations, Finance, Procurement), supplier engagement for EV availability and renewable contracts, employee training, and continuous monitoring with adaptive management.</p>
                                <div className="roadmap-phases">
                                    <p className="body-text"><strong>{baseYear + 1} — Foundation Year</strong></p>
                                    <ul className="body-text bullet-list">
                                        <li>Secure renewable electricity contracts (Q1)</li>
                                        <li>Energy efficiency baseline audit (Q2)</li>
                                        <li>EV infrastructure planning (Q3)</li>
                                        <li>Pilot EV deployment — 5% fleet (Q4)</li>
                                    </ul>
                                    <p className="body-text"><strong>{baseYear + 2} — Scale-Up</strong></p>
                                    <ul className="body-text bullet-list">
                                        <li>Expand EV fleet to 15% of total vehicles</li>
                                        <li>Complete energy efficiency Phase 1</li>
                                        <li>Establish carbon accounting system</li>
                                    </ul>
                                    <p className="body-text"><strong>{baseYear + 3}–{targetYear - 1} — Acceleration</strong></p>
                                    <ul className="body-text bullet-list">
                                        <li>Progressive fleet electrification to 30% by {targetYear - 1}</li>
                                        <li>Energy efficiency Phase 2 (advanced BMS)</li>
                                        <li>Evaluate green hydrogen pilots</li>
                                    </ul>
                                    <p className="body-text"><strong>{targetYear} — Target Achievement</strong></p>
                                    <ul className="body-text bullet-list">
                                        <li>Reach 40% EV fleet penetration</li>
                                        <li>Achieve {formatNumber(residualTotal)} tCO₂e residual ({ambitionLevel.replace(/_/g, ' ')})</li>
                                        <li>Secure verified carbon removal contracts</li>
                                        <li>Third-party verification &amp; public disclosure</li>
                                    </ul>
                                </div>
                                <div className="roadmap-timeline">
                                    <span>{baseYear + 1}</span><span>{baseYear + 2}</span><span>{baseYear + 3}</span><span>{targetYear - 1}</span><span>{targetYear}</span>
                                </div>
                            </section>
                            <div className="report-page-footer">13 of 17 | Generated by URIMPACT Platform</div>
                        </div>

                        <div className="report-print-page">
                            <section className="card report-section">
                                <div className="section-title">Assumptions &amp; Limitations</div>
                                <p className="body-text lead">Transparent disclosure of modelling assumptions ensures informed decision-making</p>
                                <ol className="body-text assumptions-list">
                                    <li><strong>Modelled Scenarios:</strong> Pathways are modelled scenarios based on assumptions and are not guarantees of future performance.</li>
                                    <li><strong>Illustrative Factors:</strong> Emission and financial factors shown are illustrative; regional grid factors may change over time.</li>
                                    <li><strong>No Verification:</strong> Outputs are not third-party verified; independent audit is required for regulatory use.</li>
                                    <li><strong>Regulatory Review:</strong> Jurisdiction-specific review is needed for statutory or regulatory filings.</li>
                                    <li><strong>Renewable Energy:</strong> Assumes market-based zero Scope 2 emissions once credible renewable contracts are secured.</li>
                                    <li><strong>Fleet Electrification:</strong> Assumes partial fleet electrification by {targetYear}; heavy long-haul vehicles remain diesel.</li>
                                    <li><strong>Carbon Price:</strong> Projection assumes an illustrative $50/tCO₂e by {targetYear - 1}; actual prices may vary.</li>
                                </ol>
                                <p className="body-text"><strong>Recommendation:</strong> Update annually with actual performance data and revised assumptions.</p>
                            </section>
                            <div className="report-page-footer">14 of 17 | Generated by URIMPACT Platform</div>
                        </div>

                        <div className="report-print-page">
                            <section className="card report-section">
                                <div className="section-title">Next Steps &amp; Recommendations</div>
                                <p className="body-text lead">Three immediate actions to initiate the decarbonization pathway</p>
                                <div className="next-steps-list">
                                    <div className="next-step-item">
                                        <span className="next-step-num">1</span>
                                        <div>
                                            <strong>Secure Renewable Electricity Contracts</strong>
                                            <p className="body-text">Issue RFP for renewable energy PPAs covering 100% of electricity consumption. Evaluate Green Tariff options from local utilities. Target contract execution by March {baseYear + 1} to capture full-year benefits.</p>
                                            <p className="next-step-impact">Q1 {baseYear + 1} → {formatNumber(Math.round(breakdown.electricity))} tCO₂e annual reduction, $45K energy cost savings</p>
                                        </div>
                                    </div>
                                    <div className="next-step-item">
                                        <span className="next-step-num">2</span>
                                        <div>
                                            <strong>Conduct EV Fleet Feasibility Study</strong>
                                            <p className="body-text">Assess vehicle-by-vehicle suitability for electrification (route analysis, payload requirements, charging infrastructure needs). Develop 5-year fleet replacement schedule aligned with vehicle end-of-life cycles.</p>
                                            <p className="next-step-impact">Q2 {baseYear + 1} → Roadmap for 40% fleet electrification by {targetYear}, {formatNumber(Math.round(breakdown.mobile * 0.4))} tCO₂e reduction</p>
                                        </div>
                                    </div>
                                    <div className="next-step-item">
                                        <span className="next-step-num">3</span>
                                        <div>
                                            <strong>Establish Carbon Accounting &amp; Monitoring System</strong>
                                            <p className="body-text">Implement real-time emissions tracking dashboard integrated with operational systems. Train finance and operations teams on GHG accounting protocols. Set up quarterly performance reviews against pathway targets.</p>
                                            <p className="next-step-impact">Q3 {baseYear + 1} → Enhanced data quality, early deviation identification, continuous improvement</p>
                                        </div>
                                    </div>
                                </div>
                            </section>
                            <div className="report-page-footer">15 of 17 | Generated by URIMPACT Platform</div>
                        </div>

                        <div className="report-print-page">
                            <section className="card report-section">
                                <div className="section-title">Closing Summary</div>
                                <p className="body-text">{organizationName} is positioned to lead the logistics sector in climate action</p>
                                <ul className="body-text bullet-list closing-summary-list">
                                    <li>✓ <strong>Strong Baseline:</strong> {yoyPercent}% YoY reduction and {peerComparisonPercent}% below peer average demonstrate existing climate leadership</li>
                                    <li>✓ <strong>Ambitious Yet Achievable:</strong> {ambitionLevel.replace(/_/g, ' ')} pathway to {formatNumber(residualTotal)} tCO₂e by {targetYear} ({reductionPercent}% reduction) through proven interventions</li>
                                    <li>✓ <strong>Positive Business Case:</strong> ${formatNumber(netBenefit)} net savings over 5 years while mitigating ${annualCarbonLiabilityK}K annual carbon liability</li>
                                    <li>✓ <strong>Risk Mitigation:</strong> Proactive strategy addresses transition risks (carbon pricing, market shifts) and physical risks (extreme heat)</li>
                                    <li>✓ <strong>Competitive Advantage:</strong> Early action positions {organizationName} for green market access, enhanced reputation, and regulatory readiness</li>
                                </ul>
                                <p className="body-text"><strong>Call to Action:</strong> Initiate renewable electricity procurement and EV feasibility study in Q1 {baseYear + 1} to maintain momentum and capture early benefits.</p>
                                <p className="body-text"><strong>URIMPACT Decarbonization Advisory Team</strong><br />Contact: advisory@urimpact.com</p>
                            </section>
                            <div className="report-page-footer">16 of 17 | Generated by URIMPACT Platform</div>
                        </div>

                        <div className="report-print-page">
                            <section className="card report-section">
                                <div className="section-title">Appendix — Data Quality &amp; Sources</div>
                                <p className="body-text lead">High-quality primary data ensures credible emissions accounting</p>
                                <p className="body-text"><strong>Data Sources</strong></p>
                                <p className="body-text">Electricity: Monthly utility bills from utilities — 12 months, 100% coverage.<br />Diesel: Fuel purchase invoices from fleet management system — 12 months, 100% coverage.<br />Natural Gas: Monthly invoices from gas supplier — 12 months, 100% coverage.</p>
                                <p className="body-text"><strong>Emission Factors</strong></p>
                                <table className="report-table calculation-table appendix-factors">
                                    <tbody>
                                        <tr><td>Diesel</td><td>IPCC 2006 Guidelines (2019 Refinement)</td><td>2.68 kgCO₂e/L</td></tr>
                                        <tr><td>Electricity</td><td>Regional grid average, IEA</td><td>0.51 kgCO₂e/kWh</td></tr>
                                        <tr><td>Natural Gas</td><td>IPCC 2006 Guidelines</td><td>2.03 kgCO₂e/m³</td></tr>
                                    </tbody>
                                </table>
                                <p className="body-text appendix-quality">100/100 — High Quality</p>
                                <ul className="body-text bullet-list">
                                    <li><strong>Completeness:</strong> 100% (all months, all sources)</li>
                                    <li><strong>Accuracy:</strong> Primary meter readings and invoices (no estimates or proxies)</li>
                                    <li><strong>Consistency:</strong> Standardized data collection and validation protocols</li>
                                </ul>
                                <p className="body-text"><strong>Verification:</strong> Internal review by finance and operations teams. Third-party verification recommended for {baseYear + 1} reporting cycle.</p>
                            </section>
                            <div className="report-page-footer">17 of 17 | Generated by URIMPACT Platform</div>
                        </div>
                    </>
                )}

                <p className="report-footer-note no-print">Prepared for demonstration purposes • URIMPACT</p>
            </div>

            {toast && <div className="report-toast">{toast}</div>}

            {customModalOpen && (
                <div className="modal-overlay custom-dates" onClick={() => setCustomModalOpen(false)}>
                    <div className="custom-modal" onClick={(e) => e.stopPropagation()}>
                        <h3>Assign custom dates</h3>
                        <form onSubmit={handleCustomApply}>
                            <div className="form-group full-width">
                                <label>Start date</label>
                                <input
                                    type="date"
                                    value={customStart}
                                    onChange={(e) => setCustomStart(e.target.value)}
                                    required
                                />
                            </div>
                            <div className="form-group full-width">
                                <label>End date</label>
                                <input
                                    type="date"
                                    value={customEnd}
                                    onChange={(e) => setCustomEnd(e.target.value)}
                                    required
                                />
                            </div>
                            <div className="modal-actions">
                                <button type="button" className="btn btn-outline" onClick={() => setCustomModalOpen(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary">Apply range</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Reports;

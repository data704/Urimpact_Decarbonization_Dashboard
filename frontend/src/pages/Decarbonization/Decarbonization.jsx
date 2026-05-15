import { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { useDataStore } from '../../context/DataStoreContext';
import { getAuthToken, getDashboard } from '../../api/client';
import DecarbRoadmapChart from './DecarbRoadmapChart';
import './Decarbonization.css';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip);

const AMBITION_TIERS = {
    MODERATE_50: { R_total: 0.50, StructuralResidual: 0.15, label: 'Moderate (50%)' },
    HIGH_75:     { R_total: 0.75, StructuralResidual: 0.08, label: 'High (75%)' },
    NEARZERO_90: { R_total: 0.90, StructuralResidual: 0.05, label: 'Near-Zero (90%)' },
};

const PROJECTS = {
    kku: { name: 'King Khalid University — KKU greening project', verified: true },
    majmaah: { name: 'Majmaah Planting project', verified: true },
};

const SPECIES_MIX = ['Date palm', 'Ghaf', 'Sidr'];
const SEQUESTRATION_RATE = 0.025;
const DECARB_CONFIG_KEY = 'urimpact_decarbonization_config';
const generateTreeCount = () => Math.floor(Math.random() * (6000 - 3000 + 1)) + 3000;

const V2_KPIS = [
    { label: 'Net Zero Target', value: '2045', note: '15 years away', bg: '#EAF7F6', color: '#1A9A8F' },
    { label: 'Interim Target 2030', value: '-50%', note: 'vs 2020 baseline', bg: '#E8F8EE', color: '#27AE60' },
    { label: 'Current Reduction', value: '-28%', note: 'vs 2020 baseline', bg: '#E8F4FB', color: '#2980B9' },
    { label: 'Active Initiatives', value: '2', note: 'tree planting programmes', bg: '#FEF6E4', color: '#E67E22' },
];

/** Active initiatives — aligned with verified offset / planting projects */
const INITIATIVES = [
    {
        id: 'kku',
        name: PROJECTS.kku.name,
        saving: '240 tCO₂e/yr',
        prog: 68,
        status: 'In Progress',
    },
    {
        id: 'majmaah',
        name: PROJECTS.majmaah.name,
        saving: '180 tCO₂e/yr',
        prog: 52,
        status: 'In Progress',
    },
];

function badgeClass(status) {
    if (status === 'Complete') return 'dc-badge dc-badge--green';
    if (status === 'In Progress') return 'dc-badge dc-badge--teal';
    return 'dc-badge dc-badge--gray';
}

function Decarbonization() {
    const { t, i18n } = useTranslation();
    const dateLocale = i18n.language === 'ar' ? 'ar-SA' : 'en-US';
    const ambitionOptions = useMemo(() => [
        { value: '', label: t('decarb.ambitionPlaceholder') },
        { value: 'MODERATE_50', label: t('decarb.ambitionModerate') },
        { value: 'HIGH_75', label: t('decarb.ambitionHigh') },
        { value: 'NEARZERO_90', label: t('decarb.ambitionNearZero') },
    ], [t, i18n.language]);
    const { getTotalEmissions, scope1Entries, scope2Entries } = useDataStore();
    const [apiDashboard, setApiDashboard] = useState(null);
    const [apiLoading, setApiLoading] = useState(false);
    const hasToken = Boolean(getAuthToken());
    const currentYear = new Date().getFullYear();
    const [baselineYear, setBaselineYear] = useState(currentYear);
    const [activeTab, setActiveTab] = useState('roadmap');

    const baselineYearOptions = useMemo(
        () => Array.from({ length: 11 }, (_, i) => currentYear - 5 + i),
        [currentYear]
    );

    const localTotalForBaselineYear = useMemo(() => {
        const inYear = (dateValue) => {
            if (!dateValue) return false;
            const d = new Date(dateValue);
            if (Number.isNaN(d.getTime())) return false;
            return d.getFullYear() === baselineYear;
        };

        const scope1 = (scope1Entries || [])
            .filter((e) => inYear(e?.date))
            .reduce((sum, e) => sum + (Number(e?.emissions) || 0), 0);
        const scope2 = (scope2Entries || [])
            .filter((e) => inYear(e?.date))
            .reduce((sum, e) => sum + (Number(e?.emissions) || 0), 0);
        return scope1 + scope2;
    }, [scope1Entries, scope2Entries, baselineYear]);

    const totalEmissionsFromStore = hasToken ? localTotalForBaselineYear : getTotalEmissions();
    const totalEmissionsFromApi = apiDashboard?.emissions?.total?.totalCo2eTonnes;
    const currentTotalEmissions = totalEmissionsFromApi ?? totalEmissionsFromStore;

    const [selectedProject, setSelectedProject] = useState('');
    const [treesToPlant, setTreesToPlant] = useState(0);
    const [notification, setNotification] = useState(null);

    useEffect(() => {
        if (!hasToken) {
            setApiDashboard(null);
            setApiLoading(false);
            return;
        }
        let cancelled = false;
        setApiLoading(true);
        const start = new Date(baselineYear, 0, 1).toISOString().slice(0, 10);
        const end = new Date(baselineYear, 11, 31).toISOString().slice(0, 10);
        getDashboard({ startDate: start, endDate: end })
            .then((d) => { if (!cancelled) setApiDashboard(d); })
            .catch(() => { if (!cancelled) setApiDashboard(null); })
            .finally(() => { if (!cancelled) setApiLoading(false); });
        return () => { cancelled = true; };
    }, [hasToken, baselineYear]);

    const [configForm, setConfigForm] = useState(() => {
        try {
            const saved = localStorage.getItem(DECARB_CONFIG_KEY);
            if (saved) {
                const c = JSON.parse(saved);
                return {
                    organizationName: c.organization_name ?? '',
                    targetYear: c.target_year ? String(c.target_year) : '',
                    ambitionLevel: c.ambition_level ?? '',
                };
            }
        } catch (_) {}
        return { organizationName: '', targetYear: '', ambitionLevel: '' };
    });
    const [configPreview, setConfigPreview] = useState(() => {
        try {
            const saved = localStorage.getItem(DECARB_CONFIG_KEY);
            if (saved) return JSON.parse(saved);
        } catch (_) {}
        return null;
    });
    const [configModalOpen, setConfigModalOpen] = useState(false);

    const configReady = Boolean(configPreview?.ambition_level && configPreview?.target_year);

    const ambitionLevel = configPreview?.ambition_level || '';
    const tier = AMBITION_TIERS[ambitionLevel] ?? AMBITION_TIERS['NEARZERO_90'];
    const removalObligationTco2e = useMemo(() => {
        if (!configReady) return 0;
        const total = Number(currentTotalEmissions) || 0;
        if (!ambitionLevel || total <= 0) return 0;
        return Math.round(total * tier.StructuralResidual);
    }, [configReady, currentTotalEmissions, ambitionLevel, tier]);
    const treesRequiredAnnually = useMemo(() => {
        if (removalObligationTco2e <= 0) return 0;
        return Math.round(removalObligationTco2e / SEQUESTRATION_RATE);
    }, [removalObligationTco2e]);
    const residualEmissions = removalObligationTco2e;
    const totalEmissions = residualEmissions;

    const projectTreeCounts = useMemo(() => {
        return Object.keys(PROJECTS).reduce((acc, key) => {
            acc[key] = generateTreeCount();
            return acc;
        }, {});
    }, []);

    const currentProjectTrees = selectedProject ? projectTreeCounts[selectedProject] : 6000;
    const totalOffset = Math.round(treesToPlant * SEQUESTRATION_RATE * 100) / 100;
    const netEmissions = Math.max(0, Math.round((totalEmissions - totalOffset) * 100) / 100);

    const formatNumber = (num) => num.toLocaleString(dateLocale, { maximumFractionDigits: 2 });

    const barChartData = useMemo(() => {
        const obligation = Number(totalEmissions) || 0;
        const offset = Number(totalOffset) || 0;
        const projected = Number(netEmissions) || 0;
        return {
            labels: [
                t('decarb.removalObligation'),
                t('decarb.offsetPotential'),
                t('decarb.projectedNet'),
            ],
            datasets: [{
                label: t('decarb.chartTonnes'),
                data: [obligation, offset, projected],
                backgroundColor: ['#1C3A35', '#2BBFB3', '#1A9A8F'],
                borderRadius: 8,
                barThickness: 48,
                hoverBackgroundColor: ['#0f2420', '#3dc8be', '#158a80'],
            }],
        };
    }, [totalEmissions, totalOffset, netEmissions, t, i18n.language]);

    const barChartOptions = useMemo(
        () => ({
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { display: false },
                tooltip: {
                    enabled: true,
                    backgroundColor: '#1A2E2B',
                    titleFont: { size: 12, family: 'Poppins' },
                    bodyFont: { size: 12, family: 'Poppins' },
                    padding: 10,
                    callbacks: {
                        label: (ctx) => {
                            const v = ctx.parsed?.y ?? 0;
                            const formatted = v.toLocaleString(dateLocale, { maximumFractionDigits: 2 });
                            if (ctx.dataIndex === 1) return `${ctx.dataset.label}: −${formatted} tCO₂e`;
                            return `${ctx.dataset.label}: ${formatted} tCO₂e`;
                        },
                    },
                },
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: '#E4EDEB' },
                    ticks: { color: '#6B8A85', font: { size: 12, family: 'Poppins' } },
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#6B8A85', font: { size: 11, family: 'Poppins' }, maxRotation: 0 },
                },
            },
            animation: { duration: 350 },
            onHover: (event, elements) => {
                const target = event?.native?.target;
                if (target) target.style.cursor = elements?.length ? 'pointer' : 'default';
            },
        }),
        [dateLocale]
    );

    const handleProjectChange = (e) => {
        const projectId = e.target.value;
        setSelectedProject(projectId);
        if (projectId) {
            const available = projectTreeCounts[projectId];
            const reportTrees = treesRequiredAnnually || 0;
            setTreesToPlant(Math.min(available, reportTrees > 0 ? reportTrees : available));
        } else {
            setTreesToPlant(0);
        }
    };

    const handleSliderChange = (e) => {
        setTreesToPlant(parseInt(e.target.value, 10));
    };

    const showNotification = (message, type = 'success') => {
        setNotification({ message, type });
        setTimeout(() => setNotification(null), 4000);
    };

    const handleConfirmPlant = () => {
        if (!selectedProject) {
            showNotification('Please select a project first.', 'warning');
            return;
        }
        if (treesToPlant === 0) {
            showNotification('Please select at least one tree to plant.', 'warning');
            return;
        }
        const projectName = PROJECTS[selectedProject]?.name || 'selected project';
        showNotification(
            `Thank you! Your commitment to plant ${formatNumber(treesToPlant)} trees in "${projectName}" has been recorded. Our team will confirm the verification details.`,
            'success'
        );
    };

    const handleSaveConfig = (e) => {
        e.preventDefault();
        const { organizationName, targetYear, ambitionLevel: al } = configForm;
        if (!targetYear || !al) {
            showNotification('Please fill in all required fields (Target Year & Ambition Level)', 'error');
            return;
        }
        const config = {
            organization_name: organizationName?.trim() || null,
            target_year: parseInt(targetYear, 10),
            ambition_level: al,
            include_bau: true,
            include_tree_equivalency: true,
        };
        setConfigPreview(config);
        try {
            localStorage.setItem(DECARB_CONFIG_KEY, JSON.stringify(config));
        } catch (_) {}
        setConfigModalOpen(false);
        showNotification('Configuration saved successfully! Reports are now available.', 'success');
    };

    const handleResetConfig = () => {
        setConfigForm({ organizationName: '', targetYear: '', ambitionLevel: '' });
        setConfigPreview(null);
        try { localStorage.removeItem(DECARB_CONFIG_KEY); } catch (_) {}
        showNotification('Form reset', 'success');
    };

    return (
        <div className="dc-page">
            {notification && (
                <div className={`notification ${notification.type}`}>
                    <span>{notification.message}</span>
                </div>
            )}

            {/* Header */}
            <div className="dc-header">
                <div>
                    <h1 className="dc-title">Decarbonisation</h1>
                    <p className="dc-subtitle">Net-zero roadmap, reduction targets &amp; initiative tracking</p>
                </div>
                <div className="dc-header-actions">
                    <div className="dc-year-filter">
                        <label htmlFor="dc-baseline-year">Baseline</label>
                        <select
                            id="dc-baseline-year"
                            value={baselineYear}
                            onChange={(e) => setBaselineYear(Number(e.target.value))}
                        >
                            {baselineYearOptions.map((y) => (
                                <option key={y} value={y}>{y}</option>
                            ))}
                        </select>
                    </div>
                    <button type="button" className="dc-btn dc-btn--primary" onClick={() => setConfigModalOpen(true)}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13"><path d="M12 20V10M6 20V4M18 20v-6" /></svg>
                        {t('decarb.inputsButton')}
                    </button>
                    <button type="button" className="dc-btn dc-btn--primary">+ Add Initiative</button>
                </div>
            </div>

            {/* KPI Grid */}
            <div className="dc-kpi-grid">
                {V2_KPIS.map((k) => (
                    <div key={k.label} className="dc-kpi">
                        <div className="dc-kpi-label">{k.label}</div>
                        <div className="dc-kpi-row">
                            <div className="dc-kpi-value">{k.value}</div>
                            <div className="dc-kpi-icon" style={{ background: k.bg, color: k.color }}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15">
                                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                                </svg>
                            </div>
                        </div>
                        <div className="dc-kpi-note">{k.note}</div>
                    </div>
                ))}
            </div>

            {/* Tabs */}
            <div className="dc-tabs">
                <button
                    type="button"
                    className={`dc-tab ${activeTab === 'roadmap' ? 'on' : ''}`}
                    onClick={() => setActiveTab('roadmap')}
                >
                    Roadmap &amp; Initiatives
                </button>
                <button
                    type="button"
                    className={`dc-tab ${activeTab === 'offset' ? 'on' : ''}`}
                    onClick={() => setActiveTab('offset')}
                >
                    Tree Planting &amp; Offset
                </button>
            </div>

            {activeTab === 'roadmap' && (
                <div className="dc-grid-2">
                    {/* Emissions Reduction Roadmap */}
                    <div className="dc-card">
                        <div className="dc-card-title">Emissions Reduction Roadmap</div>
                        <DecarbRoadmapChart />
                    </div>

                    {/* Active Initiatives */}
                    <div className="dc-card">
                        <div className="dc-card-title">Active Initiatives</div>
                        {INITIATIVES.map((ini) => (
                            <div key={ini.id} className="dc-initiative">
                                <div className="dc-initiative-head">
                                    <div className="dc-initiative-name">{ini.name}</div>
                                    <span className={badgeClass(ini.status)}>{ini.status}</span>
                                </div>
                                <div className="dc-initiative-progress">
                                    <div className="dc-prog-bar">
                                        <div
                                            className="dc-prog-fill"
                                            style={{ width: `${ini.prog}%`, background: ini.prog === 100 ? '#27AE60' : '#1A9A8F' }}
                                        />
                                    </div>
                                    <span className="dc-initiative-pct">{ini.prog}%</span>
                                </div>
                                <div className="dc-initiative-saving">Saving: {ini.saving}</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {activeTab === 'offset' && (
                <>
                    {apiLoading && <p className="dc-loading">{t('decarb.loadingData')}</p>}
                    {!apiLoading && <p className="dc-loading">{t('decarb.usingBaselineYear', { year: baselineYear })}</p>}

                    <div className="dc-grid-offset">
                        {/* Left: Net Emissions Projection card */}
                        <div className="dc-card">
                            <div className="dc-card-title">{t('decarb.netEmissionsProjection')}</div>

                            {!configReady ? (
                                <div className="dc-placeholder">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="36" height="36">
                                        <path d="M12 20V10M6 20V4M18 20v-6" />
                                    </svg>
                                    <p className="dc-placeholder-title">{t('decarb.notConfiguredTitle')}</p>
                                    <p className="dc-placeholder-desc">{t('decarb.notConfiguredBody')}</p>
                                    <button type="button" className="dc-btn dc-btn--primary" onClick={() => setConfigModalOpen(true)}>
                                        {t('decarb.openInputsButton')}
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <div className="dc-metrics-row">
                                        <div className="dc-metric">
                                            <div className="dc-metric-label">{t('decarb.removalObligation')}</div>
                                            <div className="dc-metric-value">{formatNumber(totalEmissions)} <span>tCO₂e/yr</span></div>
                                        </div>
                                        <div className="dc-metric">
                                            <div className="dc-metric-label">{t('decarb.offsetPotential')}</div>
                                            <div className="dc-metric-value dc-metric-value--highlight">-{formatNumber(totalOffset)} <span>tCO₂e</span></div>
                                        </div>
                                        <div className="dc-metric">
                                            <div className="dc-metric-label">{t('decarb.projectedNet')}</div>
                                            <div className="dc-metric-value">{formatNumber(netEmissions)} <span>tCO₂e</span></div>
                                        </div>
                                    </div>
                                    {treesRequiredAnnually > 0 && (
                                        <p className="dc-trees-hint">
                                            {t('decarb.reportTreesHint', { trees: formatNumber(treesRequiredAnnually), rate: SEQUESTRATION_RATE })}
                                        </p>
                                    )}
                                    <div className="dc-chart-wrap">
                                        <Bar data={barChartData} options={barChartOptions} />
                                    </div>
                                    <div className="dc-slider-group">
                                        <div className="dc-slider-label">
                                            <span>{t('decarb.treesToPlantLabel')}</span>
                                            <span className="dc-slider-value">{t('decarb.treesCount', { formatted: formatNumber(treesToPlant) })}</span>
                                        </div>
                                        <input
                                            type="range"
                                            min="0"
                                            max={Math.max(currentProjectTrees, treesRequiredAnnually || 0)}
                                            value={treesToPlant}
                                            step="50"
                                            onChange={handleSliderChange}
                                            disabled={!selectedProject}
                                            className="dc-slider"
                                        />
                                        <div className="dc-slider-minmax">
                                            <span>0</span>
                                            <span>{formatNumber(Math.max(currentProjectTrees, treesRequiredAnnually || 0))}</span>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Right: Impact + Project Details */}
                        <div className="dc-sidebar">
                            <div className="dc-impact-card">
                                <div className="dc-impact-title">{t('decarb.yourContribution')}</div>
                                {configReady ? (
                                    <>
                                        <div className="dc-impact-big">{formatNumber(treesToPlant)}</div>
                                        <div className="dc-impact-desc">{t('decarb.treesPlantedDesc')}</div>
                                        <button type="button" className="dc-impact-btn" onClick={handleConfirmPlant}>
                                            {t('decarb.confirmPlant')}
                                        </button>
                                    </>
                                ) : (
                                    <div className="dc-impact-desc" style={{ padding: '1rem 0', opacity: 0.7, fontSize: '0.875rem' }}>
                                        {t('decarb.saveConfigForPlanting')}
                                    </div>
                                )}
                            </div>
                            <div className="dc-card">
                                <div className="dc-card-title">{t('decarb.projectDetails')}</div>
                                <div className="dc-project-select">
                                    <label htmlFor="dc-project-sel">{t('decarb.selectProject')}</label>
                                    <select id="dc-project-sel" value={selectedProject} onChange={handleProjectChange}>
                                        <option value="">{t('decarb.chooseProject')}</option>
                                        {Object.entries(PROJECTS).map(([id, project]) => (
                                            <option key={id} value={id}>{project.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="dc-project-details">
                                    {!selectedProject ? (
                                        <p className="dc-project-placeholder">{t('decarb.selectProjectAbove')}</p>
                                    ) : (
                                        <>
                                            <p className="dc-project-row"><strong>{t('decarb.projectField')}</strong> <span>{PROJECTS[selectedProject]?.name}</span></p>
                                            <p className="dc-project-row"><strong>{t('decarb.availableTrees')}</strong> <span>{formatNumber(currentProjectTrees)}</span></p>
                                            <p className="dc-project-row"><strong>{t('decarb.speciesMix')}</strong> <span>{SPECIES_MIX.join(', ')}</span></p>
                                            <p className="dc-project-row"><strong>{t('decarb.verification')}</strong> {t('decarb.verificationDetail')}</p>
                                            <div className="dc-verified-badge">
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
                                                {t('decarb.verifiedBlock')}
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {/* Config Modal */}
            {configModalOpen && (
                <div className="dc-modal-overlay" onClick={() => setConfigModalOpen(false)} role="dialog" aria-modal="true">
                    <div className="dc-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="dc-modal-header">
                            <h2>{t('decarb.configModalTitle')}</h2>
                            <button type="button" className="dc-modal-close" onClick={() => setConfigModalOpen(false)} aria-label={t('decarb.close')}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                            </button>
                        </div>
                        <div className="dc-modal-body">
                            <p className="dc-modal-desc">Define your decarbonisation strategy parameters. These inputs will guide the construction of your pathway.</p>
                            <div className="dc-modal-layout">
                                <form onSubmit={handleSaveConfig} className="dc-config-form">
                                    <div className="dc-config-card">
                                        <div className="dc-config-card-head">
                                            <div className="dc-config-num">0</div>
                                            <div>
                                                <div className="dc-config-card-title">Organization Name</div>
                                                <div className="dc-config-card-desc">Used on report cover and summary (optional)</div>
                                            </div>
                                        </div>
                                        <div className="dc-config-card-body">
                                            <label htmlFor="orgName">{t('decarb.organizationName')}</label>
                                            <input
                                                type="text"
                                                id="orgName"
                                                value={configForm.organizationName}
                                                onChange={(e) => setConfigForm({ ...configForm, organizationName: e.target.value })}
                                                placeholder="e.g. Sample Co Logistics"
                                            />
                                        </div>
                                    </div>
                                    <div className="dc-config-card">
                                        <div className="dc-config-card-head">
                                            <div className="dc-config-num">1</div>
                                            <div>
                                                <div className="dc-config-card-title">Level of Ambition</div>
                                                <div className="dc-config-card-desc">Defines how far emissions are intended to be reduced</div>
                                            </div>
                                        </div>
                                        <div className="dc-config-card-body">
                                            <label htmlFor="ambLevel">{t('decarb.ambitionLevel')}</label>
                                            <select
                                                id="ambLevel"
                                                value={configForm.ambitionLevel}
                                                onChange={(e) => setConfigForm({ ...configForm, ambitionLevel: e.target.value })}
                                                required
                                            >
                                                {ambitionOptions.map(opt => (
                                                    <option key={opt.value || 'empty'} value={opt.value}>{opt.label}</option>
                                                ))}
                                            </select>
                                            <p className="dc-help-text">Determines acceptable residual emissions and tree MRV requirements</p>
                                        </div>
                                    </div>
                                    <div className="dc-config-card">
                                        <div className="dc-config-card-head">
                                            <div className="dc-config-num">2</div>
                                            <div>
                                                <div className="dc-config-card-title">Target Year</div>
                                                <div className="dc-config-card-desc">Defines the time horizon for decarbonisation modelling</div>
                                            </div>
                                        </div>
                                        <div className="dc-config-card-body">
                                            <label htmlFor="tgtYear">{t('decarb.targetYear')}</label>
                                            <input
                                                type="number"
                                                id="tgtYear"
                                                value={configForm.targetYear}
                                                onChange={(e) => setConfigForm({ ...configForm, targetYear: e.target.value })}
                                                placeholder="e.g., 2030, 2040, 2050"
                                                min={2026}
                                                max={2100}
                                                required
                                            />
                                            <p className="dc-help-text">Used for emissions trajectory length</p>
                                        </div>
                                    </div>
                                    <div className="dc-config-actions">
                                        <button type="button" className="dc-btn dc-btn--outline" onClick={handleResetConfig}>
                                            {t('decarb.reset')}
                                        </button>
                                        <button type="submit" className="dc-btn dc-btn--primary">
                                            {t('decarb.saveConfiguration')}
                                        </button>
                                    </div>
                                </form>
                                <aside className="dc-config-sidebar">
                                    <div className="dc-config-summary">
                                        <h3>{t('decarb.summaryTitle')}</h3>
                                        <dl>
                                            <dt>{t('decarb.organizationSummary')}</dt>
                                            <dd>{configForm.organizationName || '—'}</dd>
                                            <dt>{t('decarb.ambitionSummary')}</dt>
                                            <dd>{configForm.ambitionLevel ? ambitionOptions.find(o => o.value === configForm.ambitionLevel)?.label || configForm.ambitionLevel : '—'}</dd>
                                            <dt>{t('decarb.targetYearSummary')}</dt>
                                            <dd>{configForm.targetYear || '—'}</dd>
                                        </dl>
                                    </div>
                                </aside>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Decarbonization;

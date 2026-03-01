import { useState, useMemo, useEffect } from 'react';
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
import './Decarbonization.css';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip);

const AMBITION_OPTIONS = [
    { value: '', label: 'Select ambition level' },
    { value: 'COMPLIANCE_MINIMUM', label: 'Compliance / Minimum Reduction' },
    { value: 'PARTIAL_REDUCTION', label: 'Partial Reduction (30-50%)' },
    { value: 'NEAR_ZERO', label: 'Near-Zero (90-95% reduction)' },
    { value: 'NET_ZERO', label: 'Net-Zero (100% reduction or offset)' }
];

const CAPEX_OPEX_OPTIONS = [
    { value: '', label: 'Select preference (optional)' },
    { value: 'CAPEX_HEAVY', label: 'CAPEX-Heavy Preferred' },
    { value: 'BALANCED', label: 'Balanced Approach' },
    { value: 'OPEX_LIGHT', label: 'OPEX-Light Preferred' }
];

// Project data (matches dummy: KKU, Majmaah)
const PROJECTS = {
    kku: { name: 'King Khalid University — KKU greening project', verified: true },
    majmaah: { name: 'Majmaah Planting project', verified: true },
};

const SPECIES_MIX = ['Date palm', 'Ghaf', 'Sidr'];

const CO2_PER_TREE = 0.15; // tCO2e offset per tree per year (simulation, matches dummy)

const DECARB_CONFIG_KEY = 'urimpact_decarbonization_config';

// Generate random tree count for each project (cached per session, 3000–6000 like dummy)
const generateTreeCount = () => Math.floor(Math.random() * (6000 - 3000 + 1)) + 3000;

function Decarbonization() {
    const { getTotalEmissions } = useDataStore();
    const [apiDashboard, setApiDashboard] = useState(null);
    const [apiLoading, setApiLoading] = useState(false);
    const hasToken = Boolean(getAuthToken());

    const totalEmissionsFromStore = getTotalEmissions();
    const totalEmissionsFromApi = apiDashboard?.emissions?.total?.totalCo2eTonnes;
    const currentTotalEmissions = totalEmissionsFromApi ?? totalEmissionsFromStore;

    const [selectedProject, setSelectedProject] = useState('');
    const [treesToPlant, setTreesToPlant] = useState(0);
    const [notification, setNotification] = useState(null);

    useEffect(() => {
        if (!hasToken) {
            setApiDashboard(null);
            return;
        }
        let cancelled = false;
        setApiLoading(true);
        const start = new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10);
        const end = new Date(new Date().getFullYear(), 11, 31).toISOString().slice(0, 10);
        getDashboard({ startDate: start, endDate: end })
            .then((d) => { if (!cancelled) setApiDashboard(d); })
            .catch(() => { if (!cancelled) setApiDashboard(null); })
            .finally(() => { if (!cancelled) setApiLoading(false); });
        return () => { cancelled = true; };
    }, [hasToken]);

    // Inputs & Constraints (decarbonisation strategy) — persisted for Reports access
    const [configForm, setConfigForm] = useState(() => {
        try {
            const saved = localStorage.getItem(DECARB_CONFIG_KEY);
            if (saved) {
                const c = JSON.parse(saved);
                return {
                    organizationName: c.organization_name ?? '',
                    targetYear: c.target_year ? String(c.target_year) : '',
                    ambitionLevel: c.ambition_level ?? '',
                    capexOpex: c.capex_opex_preference ?? ''
                };
            }
        } catch (_) {}
        return { organizationName: '', targetYear: '', ambitionLevel: '', capexOpex: '' };
    });
    const [configPreview, setConfigPreview] = useState(() => {
        try {
            const saved = localStorage.getItem(DECARB_CONFIG_KEY);
            if (saved) return JSON.parse(saved);
        } catch (_) {}
        return null;
    });
    const [configModalOpen, setConfigModalOpen] = useState(false);

    const ambitionLevel = configForm?.ambitionLevel || configPreview?.ambition_level || '';
    const reductionPercent = ambitionLevel === 'NET_ZERO' ? 100 : ambitionLevel === 'NEAR_ZERO' ? 85.1 : ambitionLevel === 'PARTIAL_REDUCTION' ? 45 : ambitionLevel === 'COMPLIANCE_MINIMUM' ? 25 : 0;
    const residualEmissions = useMemo(() => {
        const total = Number(currentTotalEmissions) || 0;
        if (!ambitionLevel || total <= 0) return total;
        return Math.max(0, total * (1 - reductionPercent / 100));
    }, [currentTotalEmissions, ambitionLevel, reductionPercent]);
    const totalEmissions = residualEmissions;

    // Generate and cache tree counts for projects
    const projectTreeCounts = useMemo(() => {
        return Object.keys(PROJECTS).reduce((acc, key) => {
            acc[key] = generateTreeCount();
            return acc;
        }, {});
    }, []);

    // Get current project's tree count
    const currentProjectTrees = selectedProject ? projectTreeCounts[selectedProject] : 6000;

    // Calculate offset (CO2_PER_TREE tCO2e per tree per year)
    const totalOffset = Math.round(treesToPlant * CO2_PER_TREE * 100) / 100;
    const netEmissions = Math.max(0, Math.round((totalEmissions - totalOffset) * 100) / 100);
    const offsetPercentage = totalEmissions > 0 ? (totalOffset / totalEmissions) * 100 : 0;

    const barChartData = useMemo(() => {
        const current = Number(totalEmissions) || 0;
        const projected = Number(netEmissions) || 0;
        return {
            labels: ['Residual Emissions', 'Projected Net Emissions'],
            datasets: [{
                label: 'tCO₂e',
                data: [current, projected],
                backgroundColor: ['#0F172A', '#14B8A6'],
                borderRadius: 6,
                barThickness: 60,
            }],
        };
    }, [totalEmissions, netEmissions]);

    const formatNumber = (num) => num.toLocaleString('en-US', { maximumFractionDigits: 2 });

    const handleProjectChange = (e) => {
        const projectId = e.target.value;
        setSelectedProject(projectId);
        
        if (projectId) {
            // Set slider to max (all available trees) by default
            setTreesToPlant(projectTreeCounts[projectId]);
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
        const { organizationName, targetYear, ambitionLevel, capexOpex } = configForm;
        if (!targetYear || !ambitionLevel) {
            showNotification('Please fill in all required fields (Target Year & Ambition Level)', 'error');
            return;
        }
        const config = {
            organization_name: organizationName?.trim() || null,
            target_year: parseInt(targetYear, 10),
            ambition_level: ambitionLevel,
            capex_opex_preference: capexOpex || null
        };
        setConfigPreview(config);
        try {
            localStorage.setItem(DECARB_CONFIG_KEY, JSON.stringify(config));
        } catch (_) {}
        setConfigModalOpen(false);
        showNotification('Configuration saved successfully! Reports are now available.', 'success');
    };

    const handleResetConfig = () => {
        setConfigForm({
            organizationName: '',
            targetYear: '',
            ambitionLevel: '',
            capexOpex: ''
        });
        setConfigPreview(null);
        try {
            localStorage.removeItem(DECARB_CONFIG_KEY);
        } catch (_) {}
        showNotification('Form reset', 'success');
    };

    return (
        <div className="decarbonization-content">
            {/* Notification */}
            {notification && (
                <div className={`notification ${notification.type}`}>
                    <i className={`fas fa-${
                        notification.type === 'success' ? 'check-circle' :
                        notification.type === 'warning' ? 'exclamation-triangle' :
                        notification.type === 'error' ? 'exclamation-circle' : 'info-circle'
                    }`}></i>
                    <span>{notification.message}</span>
                </div>
            )}

            {/* Page Header */}
            <div className="page-header decarb-page-header">
                <div className="page-header-text">
                    <h1 className="decarb-main-title">Decarbonization scenario</h1>
                    <p className="decarb-main-subtitle">See how planting trees offsets your residual emissions (post-pathway). Baseline uses report residual from your ambition level.</p>
                </div>
                <button
                    type="button"
                    className="btn btn-primary btn-config-open"
                    onClick={() => setConfigModalOpen(true)}
                >
                    <i className="fas fa-sliders-h"></i>
                    Inputs & Constraints
                </button>
            </div>

            {/* Inputs & Constraints Modal */}
            {configModalOpen && (
                <div
                    className="config-modal-overlay"
                    onClick={() => setConfigModalOpen(false)}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="config-modal-title"
                >
                    <div className="config-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="config-modal-header">
                            <h2 id="config-modal-title">Inputs & Constraints</h2>
                            <button
                                type="button"
                                className="config-modal-close"
                                onClick={() => setConfigModalOpen(false)}
                                aria-label="Close"
                            >
                                <i className="fas fa-times"></i>
                            </button>
                        </div>
                        <div className="config-modal-body">
                            <div className="config-step decarb-config">
                                <div className="config-page-header">
                                    <p>Define your decarbonisation strategy parameters. These inputs will guide the construction of your pathway.</p>
                                </div>

                                <div className="config-step-layout">
                    <form onSubmit={handleSaveConfig} className="config-form">
                        <div className="config-card">
                            <div className="config-card-header">
                                <div className="config-card-title">
                                    <span className="config-card-number">0</span>
                                    Organization Name
                                </div>
                                <div className="config-card-description">
                                    Used on report cover and summary (optional)
                                </div>
                            </div>
                            <div className="config-card-content">
                                <div className="form-group">
                                    <label htmlFor="organizationName">Organization / Company Name</label>
                                    <input
                                        type="text"
                                        id="organizationName"
                                        value={configForm.organizationName}
                                        onChange={(e) => setConfigForm({ ...configForm, organizationName: e.target.value })}
                                        placeholder="e.g. Sample Co Logistics"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="config-card">
                            <div className="config-card-header">
                                <div className="config-card-title">
                                    <span className="config-card-number">1</span>
                                    Level of Ambition
                                </div>
                                <div className="config-card-description">
                                    Defines how far emissions are intended to be reduced
                                </div>
                            </div>
                            <div className="config-card-content">
                                <div className="form-group">
                                    <label htmlFor="ambitionLevel">Ambition Level *</label>
                                    <select
                                        id="ambitionLevel"
                                        value={configForm.ambitionLevel}
                                        onChange={(e) => setConfigForm({ ...configForm, ambitionLevel: e.target.value })}
                                        required
                                    >
                                        {AMBITION_OPTIONS.map(opt => (
                                            <option key={opt.value || 'empty'} value={opt.value}>{opt.label}</option>
                                        ))}
                                    </select>
                                    <p className="help-text">Determines acceptable residual emissions and tree MRV requirements</p>
                                </div>
                            </div>
                        </div>

                        <div className="config-card">
                            <div className="config-card-header">
                                <div className="config-card-title">
                                    <span className="config-card-number">2</span>
                                    Target Year
                                </div>
                                <div className="config-card-description">
                                    Defines the time horizon for decarbonisation modelling
                                </div>
                            </div>
                            <div className="config-card-content">
                                <div className="form-group">
                                    <label htmlFor="targetYear">Target Year *</label>
                                    <input
                                        type="number"
                                        id="targetYear"
                                        value={configForm.targetYear}
                                        onChange={(e) => setConfigForm({ ...configForm, targetYear: e.target.value })}
                                        placeholder="e.g., 2030, 2040, 2050"
                                        min={2026}
                                        max={2100}
                                        required
                                    />
                                    <p className="help-text">Used for emissions trajectory length and cost amortisation</p>
                                </div>
                            </div>
                        </div>

                        <div className="config-card">
                            <div className="config-card-header">
                                <div className="config-card-title">
                                    <span className="config-card-number">3</span>
                                    CAPEX vs OPEX Preference
                                </div>
                                <div className="config-card-description">
                                    Indicates preference for upfront investment vs ongoing operating costs (Optional)
                                </div>
                            </div>
                            <div className="config-card-content">
                                <div className="form-group">
                                    <label htmlFor="capexOpex">Investment Preference</label>
                                    <select
                                        id="capexOpex"
                                        value={configForm.capexOpex}
                                        onChange={(e) => setConfigForm({ ...configForm, capexOpex: e.target.value })}
                                    >
                                        {CAPEX_OPEX_OPTIONS.map(opt => (
                                            <option key={opt.value || 'empty'} value={opt.value}>{opt.label}</option>
                                        ))}
                                    </select>
                                    <p className="help-text">Used for ranking and optimization of decarbonisation levers</p>
                                </div>
                            </div>
                        </div>

                        <div className="config-button-group">
                            <button type="button" className="btn btn-secondary" onClick={handleResetConfig}>
                                Reset
                            </button>
                            <button type="submit" className="btn btn-primary">
                                Save Configuration
                            </button>
                        </div>
                    </form>

                    <aside className="config-sidebar">
                        <div className="config-summary-card">
                            <h3>Summary</h3>
                            <dl className="config-summary-list">
                                <dt>Organization</dt>
                                <dd>{configForm.organizationName || '—'}</dd>
                                <dt>Ambition</dt>
                                <dd>{configForm.ambitionLevel ? AMBITION_OPTIONS.find(o => o.value === configForm.ambitionLevel)?.label || configForm.ambitionLevel : '—'}</dd>
                                <dt>Target Year</dt>
                                <dd>{configForm.targetYear || '—'}</dd>
                                <dt>Investment</dt>
                                <dd>{configForm.capexOpex ? CAPEX_OPEX_OPTIONS.find(o => o.value === configForm.capexOpex)?.label || configForm.capexOpex : '—'}</dd>
                            </dl>
                        </div>
                    </aside>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {apiLoading && (
                <p className="decarb-loading">Loading emissions data…</p>
            )}

            <div className="decarb-grid">
                {/* Left: Net Emissions Projection card */}
                <div className="decarb-card decarb-card-main">
                    <div className="decarb-card-title">Net Emissions Projection</div>
                    <div className="metrics-row">
                        <div className="metric-box">
                            <div className="metric-label">Residual Emissions</div>
                            <div className="metric-number">{formatNumber(totalEmissions)} <span className="metric-unit">tCO₂e</span></div>
                        </div>
                        <div className="metric-box">
                            <div className="metric-label">Offset Potential</div>
                            <div className="metric-number metric-number-highlight">-{formatNumber(totalOffset)} <span className="metric-unit">tCO₂e</span></div>
                        </div>
                        <div className="metric-box">
                            <div className="metric-label">Projected Net</div>
                            <div className="metric-number">{formatNumber(netEmissions)} <span className="metric-unit">tCO₂e</span></div>
                        </div>
                    </div>
                    <div className="chart-wrapper" style={{ height: 280 }}>
                        <Bar
                            data={barChartData}
                            options={{
                                responsive: true,
                                maintainAspectRatio: false,
                                plugins: { legend: { display: false }, tooltip: { enabled: true } },
                                scales: {
                                    y: {
                                        beginAtZero: true,
                                        grid: { color: '#E2E8F0' },
                                        ticks: { color: '#475569', font: { size: 12 } },
                                    },
                                    x: {
                                        grid: { display: false },
                                        ticks: { color: '#475569', font: { size: 12 } },
                                    },
                                },
                                animation: { duration: 400 },
                            }}
                        />
                    </div>
                    <div className="slider-group">
                        <div className="slider-label">
                            <span>Trees to Plant (URIMPACT Initiative)</span>
                            <span className="slider-value">{formatNumber(treesToPlant)} Trees</span>
                        </div>
                        <input
                            type="range"
                            min="0"
                            max={currentProjectTrees}
                            value={treesToPlant}
                            step="50"
                            onChange={handleSliderChange}
                            disabled={!selectedProject}
                            className="decarb-slider"
                        />
                        <div className="slider-minmax">
                            <span>0</span>
                            <span>{formatNumber(currentProjectTrees)}</span>
                        </div>
                    </div>
                </div>

                {/* Right: Impact card + Project Details */}
                <div className="decarb-sidebar">
                    <div className="impact-card">
                        <div className="impact-title">Your Contribution</div>
                        <div className="impact-big-number">{formatNumber(treesToPlant)}</div>
                        <div className="impact-desc">Trees planted in verified reforestation projects.</div>
                        <button type="button" className="cta-button" onClick={handleConfirmPlant}>
                            Confirm &amp; Plant Now
                        </button>
                    </div>
                    <div className="decarb-card decarb-card-details">
                        <div className="decarb-card-title">Project Details</div>
                        <div className="project-select-wrap">
                            <label htmlFor="project-select">Select a project</label>
                            <select
                                id="project-select"
                                value={selectedProject}
                                onChange={handleProjectChange}
                            >
                                <option value="">— Choose a project —</option>
                                {Object.entries(PROJECTS).map(([id, project]) => (
                                    <option key={id} value={id}>{project.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="project-details-box">
                            {!selectedProject ? (
                                <p className="project-info-placeholder">Select a project above to view details.</p>
                            ) : (
                                <>
                                    <p className="project-info-row"><strong>Project:</strong> <span>{PROJECTS[selectedProject]?.name}</span></p>
                                    <p className="project-info-row"><strong>Available trees:</strong> <span>{formatNumber(currentProjectTrees)}</span></p>
                                    <p className="project-info-row"><strong>Species mix:</strong> <span>{SPECIES_MIX.join(', ')}</span></p>
                                    <p className="project-info-row"><strong>Verification:</strong> High-resolution satellite + drone audits</p>
                                    <div className="verified-badge-block">
                                        <i className="fas fa-check-circle"></i> <strong>Verified:</strong> Each tree is verified by high resolution satellite or drone data.
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Decarbonization;

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import './Reports.css';

const GAP_ITEMS = [
    { id: 1, title: 'Scope 3 – Purchased Goods & Services data missing', desc: 'Category 1 has no entries for 2024. Required for GHG Protocol compliance.', severity: 'high', framework: 'GHG Protocol' },
    { id: 2, title: 'GRI 304 – Biodiversity assessment incomplete', desc: 'Only 2 of 8 disclosure items completed. Site impact study pending.', severity: 'high', framework: 'GRI Standards' },
    { id: 3, title: 'ESG – Social risk assessment not started', desc: 'GRI 403 Occupational Health & Safety section has 0% completion.', severity: 'high', framework: 'GRI Standards' },
    { id: 4, title: 'Water recycling metrics below target', desc: 'Current 42% vs 60% target. Plant B has no water recycling data.', severity: 'medium', framework: 'BRSR' },
    { id: 5, title: 'OHS incident reporting gap', desc: 'Q3 and Q4 incident data not submitted for Warehouse – Chennai.', severity: 'medium', framework: 'GRI Standards' },
    { id: 6, title: 'Energy intensity ratio not calculated', desc: 'Missing revenue denominator for GRI 302-3 disclosure.', severity: 'low', framework: 'GRI Standards' },
];

const COMPLIANCE_FRAMEWORKS = [
    { name: 'GHG Protocol', pct: 89 },
    { name: 'GRI Standards', pct: 78 },
    { name: 'BRSR', pct: 71 },
    { name: 'TCFD', pct: 62 },
    { name: 'CDP', pct: 55 },
];

const AI_RECS = [
    { title: 'Prioritize Scope 3 Cat. 1 data collection', desc: 'Assign procurement team to gather supplier emissions data. Est. 3 weeks.' },
    { title: 'Complete biodiversity site assessment', desc: 'Engage environmental consultant for Plant A & B. Budget: ~$8,000.' },
    { title: 'Automate OHS incident reporting', desc: 'Connect existing EHS system via API to close recurring gap.' },
];

const SEVERITY_CONFIG = {
    high: { label: 'High', color: '#E74C3C', bg: '#FDEAEA' },
    medium: { label: 'Medium', color: '#F39C12', bg: '#FEF6E4' },
    low: { label: 'Low', color: '#27AE60', bg: '#E8F8EE' },
};

export default function Reports() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [filter, setFilter] = useState('all');

    const filtered = filter === 'all' ? GAP_ITEMS : GAP_ITEMS.filter((g) => g.severity === filter);
    const highCount = GAP_ITEMS.filter((g) => g.severity === 'high').length;
    const medCount = GAP_ITEMS.filter((g) => g.severity === 'medium').length;

    return (
        <div className="gap-page">
            {/* Header */}
            <div className="gap-ph">
                <div>
                    <div className="gap-pt">Gap Analysis</div>
                    <div className="gap-ps">Identify compliance gaps and improvement opportunities</div>
                </div>
                <div className="gap-actions">
                    <button type="button" className="gap-btn gap-btn-o" onClick={() => window.print()}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                        Download Report
                    </button>
                    <button type="button" className="gap-btn gap-btn-p">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>
                        Run Analysis
                    </button>
                </div>
            </div>

            {/* KPI Row */}
            <div className="gap-kpi-row">
                <div className="gap-kpi" style={{ borderTop: '3px solid #E74C3C' }}>
                    <div className="gap-kpi-label">Total Gaps</div>
                    <div className="gap-kpi-value">{GAP_ITEMS.length}</div>
                </div>
                <div className="gap-kpi" style={{ borderTop: '3px solid #E74C3C' }}>
                    <div className="gap-kpi-label">High Priority</div>
                    <div className="gap-kpi-value">{highCount}</div>
                </div>
                <div className="gap-kpi" style={{ borderTop: '3px solid #F39C12' }}>
                    <div className="gap-kpi-label">Medium Priority</div>
                    <div className="gap-kpi-value">{medCount}</div>
                </div>
                <div className="gap-kpi" style={{ borderTop: '3px solid #1A9A8F' }}>
                    <div className="gap-kpi-label">Compliance Rate</div>
                    <div className="gap-kpi-value">78%</div>
                </div>
            </div>

            {/* Filter */}
            <div className="gap-filter-row">
                {['all', 'high', 'medium', 'low'].map((f) => (
                    <button
                        key={f}
                        type="button"
                        className={`gap-filter-btn ${filter === f ? 'on' : ''}`}
                        onClick={() => setFilter(f)}
                    >
                        {f === 'all' ? 'All Gaps' : SEVERITY_CONFIG[f].label}
                    </button>
                ))}
            </div>

            <div className="gap-g2">
                {/* Left: Gap Items */}
                <div className="gap-card">
                    <div className="gap-card-title">Identified Gaps ({filtered.length})</div>
                    <div className="gap-items">
                        {filtered.map((gap) => {
                            const sev = SEVERITY_CONFIG[gap.severity];
                            return (
                                <div key={gap.id} className="gap-item">
                                    <div className="gap-sev" style={{ background: sev.color }} />
                                    <div className="gap-item-body">
                                        <div className="gap-item-head">
                                            <span className="gap-item-title">{gap.title}</span>
                                            <span className="gap-sev-badge" style={{ background: sev.bg, color: sev.color }}>{sev.label}</span>
                                        </div>
                                        <div className="gap-item-desc">{gap.desc}</div>
                                        <div className="gap-item-foot">
                                            <span className="gap-item-fw">{gap.framework}</span>
                                            <button type="button" className="gap-fix-btn" onClick={() => navigate('/data-input')}>Fix Now</button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Right column */}
                <div className="gap-right-col">
                    {/* Compliance by Framework */}
                    <div className="gap-card">
                        <div className="gap-card-title">Compliance by Framework</div>
                        {COMPLIANCE_FRAMEWORKS.map((fw) => (
                            <div key={fw.name} className="gap-fw-row">
                                <div className="gap-fw-head">
                                    <span className="gap-fw-name">{fw.name}</span>
                                    <span className="gap-fw-pct" style={{ color: fw.pct >= 80 ? '#27AE60' : fw.pct >= 60 ? '#F39C12' : '#E74C3C' }}>{fw.pct}%</span>
                                </div>
                                <div className="gap-fw-track">
                                    <div
                                        className="gap-fw-fill"
                                        style={{
                                            width: `${fw.pct}%`,
                                            background: fw.pct >= 80 ? '#1A9A8F' : fw.pct >= 60 ? '#F39C12' : '#E74C3C',
                                        }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* AI Recommendations */}
                    <div className="gap-card">
                        <div className="gap-card-title">
                            <span className="gap-ai-badge">AI</span>
                            Recommendations
                        </div>
                        {AI_RECS.map((rec, i) => (
                            <div key={i} className="gap-air">
                                <div className="gap-air-ico">
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
                                </div>
                                <div>
                                    <div className="gap-air-title">{rec.title}</div>
                                    <div className="gap-air-desc">{rec.desc}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

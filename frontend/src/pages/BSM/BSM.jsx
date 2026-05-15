import { useTranslation } from 'react-i18next';
import './BSM.css';

const KPI_DATA = [
    { label: 'IFRS S1 Completion', value: '72%', bg: '#EAF7F6', color: '#1A9A8F' },
    { label: 'IFRS S2 Completion', value: '62%', bg: '#E8F4FB', color: '#2980B9' },
    { label: 'CDP Score', value: 'B-', bg: '#E8F8EE', color: '#27AE60' },
    { label: 'GRI Index', value: '76%', bg: '#FEF6E4', color: '#E67E22' },
];

const FRAMEWORKS = [
    { label: 'IFRS S1', desc: 'General Sustainability-related Disclosures', pct: 72, color: '#1A9A8F' },
    { label: 'IFRS S2', desc: 'Climate-related Disclosures', pct: 62, color: '#2980B9' },
    { label: 'GRI Standards', desc: 'Global Reporting Initiative', pct: 78, color: '#27AE60' },
    { label: 'CDP', desc: 'Carbon Disclosure Project', pct: 55, color: '#8E44AD' },
    { label: 'SASB', desc: 'Sustainability Accounting Standards', pct: 48, color: '#E67E22' },
];

const DISCLOSURES = [
    { label: 'IFRS S1 Report', date: 'Mar 31, 2026', cls: 'bsm-badge--red' },
    { label: 'IFRS S2 Climate Report', date: 'Apr 15, 2026', cls: 'bsm-badge--amber' },
    { label: 'CDP Response', date: 'Aug 01, 2026', cls: 'bsm-badge--blue' },
    { label: 'GRI Index Publication', date: 'Sep 30, 2026', cls: 'bsm-badge--gray' },
];

export default function BSM() {
    const { t } = useTranslation();

    return (
        <div className="bsm-page">
            <div className="bsm-header">
                <div>
                    <h1 className="bsm-title">Business Sustainability Management</h1>
                    <p className="bsm-subtitle">Integrated sustainability governance across business functions</p>
                </div>
                <button type="button" className="bsm-btn bsm-btn--primary">+ Add Report</button>
            </div>

            <div className="bsm-kpi-grid">
                {KPI_DATA.map((k) => (
                    <div key={k.label} className="bsm-kpi">
                        <div className="bsm-kpi-label">{k.label}</div>
                        <div className="bsm-kpi-row">
                            <div className="bsm-kpi-value">{k.value}</div>
                            <div className="bsm-kpi-icon" style={{ background: k.bg, color: k.color }}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15">
                                    <rect x="2" y="7" width="20" height="14" rx="2" />
                                </svg>
                            </div>
                        </div>
                        <div className="bsm-kpi-change">
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="18 15 12 9 6 15" /></svg>
                            +5% <span>vs 2023</span>
                        </div>
                    </div>
                ))}
            </div>

            <div className="bsm-grid-2">
                <div className="bsm-card">
                    <div className="bsm-card-title">Framework Completion</div>
                    {FRAMEWORKS.map((f) => (
                        <div key={f.label} className="bsm-framework-item">
                            <div className="bsm-prog-labels">
                                <span className="bsm-prog-name">{f.label}</span>
                                <span className="bsm-prog-desc">{f.desc}</span>
                                <span className="bsm-prog-pct">{f.pct}%</span>
                            </div>
                            <div className="bsm-prog-bar">
                                <div className="bsm-prog-fill" style={{ width: `${f.pct}%`, background: f.color }} />
                            </div>
                        </div>
                    ))}
                </div>

                <div className="bsm-card">
                    <div className="bsm-card-title">Upcoming Disclosures</div>
                    {DISCLOSURES.map((d) => (
                        <div key={d.label} className="bsm-disclosure-item">
                            <span className="bsm-disclosure-label">{d.label}</span>
                            <span className={`bsm-badge ${d.cls}`}>{d.date}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

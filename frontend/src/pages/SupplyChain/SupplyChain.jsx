import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import './SupplyChain.css';

const DUMMY_SUPPLIERS = [
    { name: 'SABIC', cat: 'Raw Materials', tier: 'Tier 1', score: 82, emissions: '12,400', risk: 'Low' },
    { name: 'Saudi Logistics', cat: 'Logistics', tier: 'Tier 1', score: 74, emissions: '4,800', risk: 'Medium' },
    { name: 'Saudi Aramco', cat: 'Fuel', tier: 'Tier 1', score: 61, emissions: '8,200', risk: 'High' },
    { name: 'Saudi Electricity Co.', cat: 'Equipment', tier: 'Tier 2', score: 88, emissions: '2,100', risk: 'Low' },
    { name: 'Maaden', cat: 'Packaging', tier: 'Tier 2', score: 42, emissions: '1,400', risk: 'High' },
];

const KPI_DATA = [
    { label: 'Total Suppliers', value: '186', bg: '#EAF7F6', color: '#1A9A8F' },
    { label: 'Assessed', value: '128', bg: '#E8F8EE', color: '#27AE60' },
    { label: 'High-Risk', value: '19', bg: '#FDEAEA', color: '#E74C3C' },
    { label: 'Scope 3 Coverage', value: '74%', bg: '#E8F4FB', color: '#2980B9' },
];

function riskBadgeClass(risk) {
    if (risk === 'Low') return 'sc-badge sc-badge--green';
    if (risk === 'Medium') return 'sc-badge sc-badge--amber';
    return 'sc-badge sc-badge--red';
}

function tierPillClass(tier) {
    return tier === 'Tier 1' ? 'sc-pill sc-pill--dark' : 'sc-pill sc-pill--teal';
}

function scoreColor(s) {
    if (s >= 75) return '#27AE60';
    if (s >= 55) return '#F39C12';
    return '#E74C3C';
}

export default function SupplyChain() {
    const { t } = useTranslation();
    const [search, setSearch] = useState('');
    const [tierFilter, setTierFilter] = useState('All');
    const [riskFilter, setRiskFilter] = useState('All');

    const filtered = DUMMY_SUPPLIERS.filter((s) => {
        if (search && !s.name.toLowerCase().includes(search.toLowerCase())) return false;
        if (tierFilter !== 'All' && s.tier !== tierFilter) return false;
        if (riskFilter !== 'All' && s.risk !== riskFilter) return false;
        return true;
    });

    return (
        <div className="sc-page">
            <div className="sc-header">
                <div>
                    <h1 className="sc-title">Supply Chain Management</h1>
                    <p className="sc-subtitle">Upstream &amp; downstream supplier sustainability tracking</p>
                </div>
                <button type="button" className="sc-btn sc-btn--primary">+ Add Supplier</button>
            </div>

            <div className="sc-kpi-grid">
                {KPI_DATA.map((k) => (
                    <div key={k.label} className="sc-kpi">
                        <div className="sc-kpi-label">{k.label}</div>
                        <div className="sc-kpi-row">
                            <div className="sc-kpi-value">{k.value}</div>
                            <div className="sc-kpi-icon" style={{ background: k.bg, color: k.color }}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15">
                                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                                </svg>
                            </div>
                        </div>
                        <div className="sc-kpi-change">
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="18 15 12 9 6 15" /></svg>
                            +12% <span>vs last year</span>
                        </div>
                    </div>
                ))}
            </div>

            <div className="sc-table-card">
                <div className="sc-table-header">
                    <div className="sc-table-title">Supplier List</div>
                    <div className="sc-table-filters">
                        <div className="sc-search">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13">
                                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                            </svg>
                            <input
                                placeholder="Search supplier..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                        <select className="sc-select" value={tierFilter} onChange={(e) => setTierFilter(e.target.value)}>
                            <option value="All">All Tiers</option>
                            <option value="Tier 1">Tier 1</option>
                            <option value="Tier 2">Tier 2</option>
                        </select>
                        <select className="sc-select" value={riskFilter} onChange={(e) => setRiskFilter(e.target.value)}>
                            <option value="All">All Risk</option>
                            <option value="High">High</option>
                            <option value="Medium">Medium</option>
                            <option value="Low">Low</option>
                        </select>
                    </div>
                </div>

                <table className="sc-table">
                    <thead>
                        <tr>
                            <th>Supplier</th>
                            <th>Category</th>
                            <th>Tier</th>
                            <th>ESG Score</th>
                            <th>Emissions</th>
                            <th>Risk</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.map((s) => (
                            <tr key={s.name}>
                                <td style={{ fontWeight: 600 }}>{s.name}</td>
                                <td>{s.cat}</td>
                                <td><span className={tierPillClass(s.tier)}>{s.tier}</span></td>
                                <td>
                                    <div className="sc-score-cell">
                                        <div className="sc-score-bar">
                                            <div className="sc-score-fill" style={{ width: `${s.score}%`, background: scoreColor(s.score) }} />
                                        </div>
                                        <span style={{ fontWeight: 700 }}>{s.score}</span>
                                    </div>
                                </td>
                                <td style={{ fontWeight: 600 }}>{s.emissions} tCO&#x2082;e</td>
                                <td><span className={riskBadgeClass(s.risk)}>{s.risk}</span></td>
                                <td>
                                    <div className="sc-actions">
                                        <button type="button" className="sc-btn sc-btn--outline sc-btn--sm">Assess</button>
                                        <button type="button" className="sc-btn sc-btn--outline sc-btn--sm">View</button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                <div className="sc-table-footer">
                    <span className="sc-table-info">Showing 1–{filtered.length} of 186</span>
                    <div className="sc-pagination">
                        <span className="sc-page-btn active">1</span>
                        <span className="sc-page-btn">2</span>
                        <span className="sc-page-btn">3</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

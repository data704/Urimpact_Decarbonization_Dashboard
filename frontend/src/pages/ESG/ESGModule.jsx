import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import ESGGri2OrganizationalForm from './ESGGri2OrganizationalForm.jsx';
import ESGGri3MaterialTopicsForm from './ESGGri3MaterialTopicsForm.jsx';
import ESGEnvDisclosureForm from './ESGEnvDisclosureForm.jsx';
import ESGSocialForm from './ESGSocialForm.jsx';
import ESGGovernanceForm from './ESGGovernanceForm.jsx';
import { ENV_FORM_KEYS } from './esgEnvironmentConfig.js';
import { SOCIAL_FORM_KEYS } from './esgSocialConfig.js';
import { GOV_FORM_KEYS } from './esgGovernanceConfig.js';
import './ESGModule.css';

const ESG_KPIS = [
    { label: 'Overall ESG Score', value: '78/100', bg: '#F4E8FB', ic: '#8E44AD', iconPath: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z' },
    { label: 'Environment', value: '80/100', bg: '#E8F8EE', ic: '#27AE60', iconPath: 'M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z' },
    { label: 'Social', value: '75/100', bg: '#E8F4FB', ic: '#2980B9', iconPath: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2' },
    { label: 'Governance', value: '78/100', bg: '#F4E8FB', ic: '#8E44AD', iconPath: 'M3 11l19-9-9 19-2-8-8-2z' },
];

const GENERAL_CARDS = [
    { gri: 'GRI 2', name: 'General Disclosures', questions: 34, pct: 82 },
    { gri: 'GRI 3', name: 'Material Topics', questions: 14, pct: 67 },
];

const ENV_CARDS = [
    { gri: 'GRI 301', name: 'Materials', pct: 58, formKey: 'gri301' },
    { gri: 'GRI 302', name: 'Energy', pct: 88, formKey: 'gri302' },
    { gri: 'GRI 303', name: 'Water and Effluents', pct: 72, formKey: 'gri303' },
    { gri: 'GRI 304', name: 'Biodiversity', pct: 45, c: '#E67E22' },
    { gri: 'GRI 305', name: 'Emissions', pct: 91, c: '#27AE60' },
    { gri: 'GRI 306', name: 'Waste', pct: 68, c: '#1A9A8F' },
    { gri: 'GRI 307', name: 'Environmental Compliance', pct: 100, c: '#27AE60' },
];

const SOCIAL_CARDS = [
    { gri: 'GRI 401', name: 'Employment', pct: 95, formKey: 'gri401' },
    { gri: 'GRI 402', name: 'Labor / Management Relations', pct: 70, formKey: 'gri402' },
    { gri: 'GRI 403', name: 'Occupational Health & Safety', pct: 88, formKey: 'gri403' },
    { gri: 'GRI 404', name: 'Training and Education', pct: 76, formKey: 'gri404' },
    { gri: 'GRI 405', name: 'Diversity and Equal Opportunity', pct: 82, formKey: 'gri405' },
    { gri: 'GRI 406', name: 'Non-Discrimination', pct: 100, formKey: 'gri406' },
    { gri: 'GRI 407', name: 'Freedom of Association & Collective Bargaining', pct: 90, formKey: 'gri407' },
    { gri: 'GRI 408', name: 'Child Labor', pct: 100, formKey: 'gri408' },
    { gri: 'GRI 409', name: 'Forced Labor', pct: 100 },
    { gri: 'GRI 413', name: 'Local Communities', pct: 65 },
    { gri: 'GRI 414', name: 'Supplier Social Assessment', pct: 58 },
    { gri: 'GRI 416', name: 'Customer Health and Safety', pct: 72 },
    { gri: 'GRI 418', name: 'Customer Privacy', pct: 88 },
    { gri: 'GRI 419', name: 'Socioeconomic Compliance', pct: 100 },
];

const GOV_CARDS = [
    { gri: 'GRI 201', name: 'Economic Performance', pct: 91, formKey: 'gri201' },
    { gri: 'GRI 202', name: 'Market Presence', pct: 84, formKey: 'gri202' },
    { gri: 'GRI 203', name: 'Indirect Economic Impacts', pct: 60, formKey: 'gri203' },
    { gri: 'GRI 204', name: 'Procurement Practices', pct: 72, formKey: 'gri204' },
    { gri: 'GRI 205', name: 'Anti-Corruption', pct: 100, formKey: 'gri205' },
    { gri: 'GRI 206', name: 'Anti-Competitive Behaviour', pct: 100, formKey: 'gri206' },
    { gri: 'GRI 207', name: 'Tax', pct: 78, formKey: 'gri207' },
];

const TABS = [
    { key: 'gen', label: 'General Disclosure' },
    { key: 'env', label: 'Environment (GRI 300)' },
    { key: 'soc', label: 'Social (GRI 400)' },
    { key: 'gov', label: 'Governance (GRI 200)' },
];

function badgeClass(pct) {
    if (pct === 100) return 'esg-badge--green';
    if (pct >= 60) return 'esg-badge--blue';
    return 'esg-badge--amber';
}

function badgeLabel(pct) {
    if (pct === 100) return 'Complete';
    if (pct >= 60) return 'In Progress';
    return 'Needs Data';
}

function barColor(pct) {
    if (pct >= 85) return '#27AE60';
    if (pct >= 60) return '#2980B9';
    return '#F39C12';
}

function ESGCard({ gri, name, pct, griStyle, iconStyle, onClick, clickable }) {
    const gBg = griStyle?.bg || '#EAF7F6';
    const gColor = griStyle?.color || '#1A9A8F';
    const icoStyle = iconStyle || { background: '#EAF7F6', color: '#1A9A8F' };

    return (
        <div
            className={`esg-ecard${clickable ? ' esg-ecard--clickable' : ''}`}
            role={clickable ? 'button' : undefined}
            tabIndex={clickable ? 0 : undefined}
            onClick={clickable ? onClick : undefined}
            onKeyDown={
                clickable
                    ? (e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              onClick?.();
                          }
                      }
                    : undefined
            }
        >
            <div className="esg-ecard-header">
                <div className="esg-ecard-icon" style={icoStyle}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                    </svg>
                </div>
                <div>
                    <div className="esg-egri" style={{ background: gBg, color: gColor }}>{gri}</div>
                    <div className="esg-ename">{name}</div>
                </div>
            </div>
            <div className="esg-prog-bar">
                <div className="esg-prog-fill" style={{ width: `${pct}%`, background: barColor(pct) }} />
            </div>
            <div className="esg-ecard-footer">
                <span className="esg-ecard-pct">{pct}%</span>
                <span className={`esg-badge ${badgeClass(pct)}`}>{badgeLabel(pct)}</span>
            </div>
        </div>
    );
}

export default function ESGModule() {
    const { t } = useTranslation();
    const [tab, setTab] = useState('gen');
    const [genView, setGenView] = useState('overview');
    const [envView, setEnvView] = useState(null);
    const [socView, setSocView] = useState(null);
    const [govView, setGovView] = useState(null);

    return (
        <div className="esg-page">
            <div className="esg-header">
                <div>
                    <h1 className="esg-title">ESG Module</h1>
                    <p className="esg-subtitle">Environmental, Social & Governance reporting · GRI Standards</p>
                </div>
                <button type="button" className="esg-btn esg-btn--primary">+ Add Data</button>
            </div>

            <div className="esg-kpi-grid">
                {ESG_KPIS.map((k) => (
                    <div key={k.label} className="esg-kpi">
                        <div className="esg-kpi-label">{k.label}</div>
                        <div className="esg-kpi-row">
                            <div className="esg-kpi-value">{k.value}</div>
                            <div className="esg-kpi-icon" style={{ background: k.bg, color: k.ic }}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15">
                                    <path d={k.iconPath} />
                                </svg>
                            </div>
                        </div>
                        <div className="esg-kpi-change">
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="18 15 12 9 6 15" /></svg>
                            +5.6%<span>vs last year</span>
                        </div>
                    </div>
                ))}
            </div>

            <div className="esg-tabs">
                {TABS.map((t2) => (
                    <button
                        key={t2.key}
                        type="button"
                        className={`esg-tab ${tab === t2.key ? 'on' : ''}`}
                        onClick={() => {
                            setTab(t2.key);
                            if (t2.key === 'gen') setGenView('overview');
                            if (t2.key === 'env') setEnvView(null);
                            if (t2.key === 'soc') setSocView(null);
                            if (t2.key === 'gov') setGovView(null);
                        }}
                    >
                        {t2.label}
                    </button>
                ))}
            </div>

            {tab === 'gen' && genView === 'gri2' && (
                <ESGGri2OrganizationalForm onBack={() => setGenView('overview')} />
            )}

            {tab === 'gen' && genView === 'gri3' && (
                <ESGGri3MaterialTopicsForm onBack={() => setGenView('overview')} />
            )}

            {tab === 'gen' && genView === 'overview' && (
                <div className="esg-grid-2">
                    {GENERAL_CARDS.map((c) => (
                        <div
                            key={c.gri}
                            className={`esg-ecard esg-ecard--general${c.gri === 'GRI 2' || c.gri === 'GRI 3' ? ' esg-ecard--clickable' : ''}`}
                            role={c.gri === 'GRI 2' || c.gri === 'GRI 3' ? 'button' : undefined}
                            tabIndex={c.gri === 'GRI 2' || c.gri === 'GRI 3' ? 0 : undefined}
                            onClick={
                                c.gri === 'GRI 2'
                                    ? () => setGenView('gri2')
                                    : c.gri === 'GRI 3'
                                      ? () => setGenView('gri3')
                                      : undefined
                            }
                            onKeyDown={
                                c.gri === 'GRI 2' || c.gri === 'GRI 3'
                                    ? (e) => {
                                          if (e.key === 'Enter' || e.key === ' ') {
                                              e.preventDefault();
                                              setGenView(c.gri === 'GRI 2' ? 'gri2' : 'gri3');
                                          }
                                      }
                                    : undefined
                            }
                        >
                            <div className="esg-ecard-header">
                                <div className="esg-ecard-icon">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                        <polyline points="14 2 14 8 20 8" />
                                    </svg>
                                </div>
                                <div>
                                    <div className="esg-egri">{c.gri}</div>
                                    <div className="esg-ename">{c.name}</div>
                                </div>
                            </div>
                            <div className="esg-gen-stats">
                                <div className="esg-gen-stat">
                                    <div className="esg-gen-stat-val">{c.pct}%</div>
                                    <div className="esg-gen-stat-label">Completion</div>
                                </div>
                                <div className="esg-gen-stat">
                                    <div className="esg-gen-stat-val">{c.questions}</div>
                                    <div className="esg-gen-stat-label">Questions</div>
                                </div>
                            </div>
                            <div className="esg-prog-bar">
                                <div className="esg-prog-fill" style={{ width: `${c.pct}%`, background: '#1A9A8F' }} />
                            </div>
                            <div className="esg-ecard-footer">
                                <span className="esg-ecard-meta">Updated: May 8, 2024</span>
                                <div className="esg-ecard-actions">
                                    <button
                                        type="button"
                                        className="esg-btn-sm esg-btn-sm--outline"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (c.gri === 'GRI 2') setGenView('gri2');
                                            if (c.gri === 'GRI 3') setGenView('gri3');
                                        }}
                                    >
                                        Add Data
                                    </button>
                                    <button
                                        type="button"
                                        className="esg-btn-sm esg-btn-sm--outline"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (c.gri === 'GRI 2') setGenView('gri2');
                                            if (c.gri === 'GRI 3') setGenView('gri3');
                                        }}
                                    >
                                        View Data
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {tab === 'env' && envView && ENV_FORM_KEYS.has(envView) && (
                <ESGEnvDisclosureForm formKey={envView} onBack={() => setEnvView(null)} />
            )}

            {tab === 'env' && !envView && (
                <div className="esg-grid-3">
                    {ENV_CARDS.map((c) => (
                        <ESGCard
                            key={c.gri}
                            gri={c.gri}
                            name={c.name}
                            pct={c.pct}
                            griStyle={{ bg: '#E8F8EE', color: '#27AE60' }}
                            iconStyle={{ background: '#E8F8EE', color: '#27AE60' }}
                            clickable={Boolean(c.formKey)}
                            onClick={c.formKey ? () => setEnvView(c.formKey) : undefined}
                        />
                    ))}
                </div>
            )}

            {tab === 'soc' && socView && SOCIAL_FORM_KEYS.has(socView) && (
                <ESGSocialForm formKey={socView} onBack={() => setSocView(null)} />
            )}

            {tab === 'soc' && !socView && (
                <div className="esg-grid-3">
                    {SOCIAL_CARDS.map((c) => (
                        <ESGCard
                            key={c.gri}
                            gri={c.gri}
                            name={c.name}
                            pct={c.pct}
                            griStyle={{ bg: '#E8F4FB', color: '#2980B9' }}
                            iconStyle={{ background: '#E8F4FB', color: '#2980B9' }}
                            clickable={Boolean(c.formKey)}
                            onClick={c.formKey ? () => setSocView(c.formKey) : undefined}
                        />
                    ))}
                </div>
            )}

            {tab === 'gov' && govView && GOV_FORM_KEYS.has(govView) && (
                <ESGGovernanceForm formKey={govView} onBack={() => setGovView(null)} />
            )}

            {tab === 'gov' && !govView && (
                <div className="esg-grid-3">
                    {GOV_CARDS.map((c) => (
                        <ESGCard
                            key={c.gri}
                            gri={c.gri}
                            name={c.name}
                            pct={c.pct}
                            griStyle={{ bg: '#F4E8FB', color: '#8E44AD' }}
                            iconStyle={{ background: '#F4E8FB', color: '#8E44AD' }}
                            clickable={Boolean(c.formKey)}
                            onClick={c.formKey ? () => setGovView(c.formKey) : undefined}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

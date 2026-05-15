import { useTranslation } from 'react-i18next';
import './LearnWithUs.css';

const KPI_DATA = [
    { label: 'Courses Available', value: '48', bg: '#EAF7F6', color: '#1A9A8F' },
    { label: 'Completed', value: '12', bg: '#E8F8EE', color: '#27AE60' },
    { label: 'Certifications', value: '3', bg: '#FEF6E4', color: '#E67E22' },
    { label: 'Hours Learned', value: '24h', bg: '#E8F4FB', color: '#2980B9' },
];

const COURSES = [
    { title: 'GHG Protocol Foundations', cat: 'GHG Accounting', dur: '4h 30m', level: 'Beginner', pct: 100, color: '#1A9A8F', bg: '#EAF7F6' },
    { title: 'GRI Standards – Environmental', cat: 'ESG Reporting', dur: '6h', level: 'Intermediate', pct: 65, color: '#27AE60', bg: '#E8F8EE' },
    { title: 'Net Zero Strategy & Decarb.', cat: 'Strategy', dur: '5h', level: 'Advanced', pct: 30, color: '#2980B9', bg: '#E8F4FB' },
    { title: 'Supply Chain Sustainability', cat: 'Supply Chain', dur: '3h', level: 'Beginner', pct: 0, color: '#E67E22', bg: '#FEF6E4' },
    { title: 'IFRS S1 & S2 Reporting Framework', cat: 'Compliance', dur: '4h', level: 'Intermediate', pct: 0, color: '#8E44AD', bg: '#F4E8FB' },
    { title: 'Carbon Markets & Offsetting', cat: 'Finance', dur: '2h 30m', level: 'Advanced', pct: 0, color: '#E74C3C', bg: '#FDEAEA' },
];

function statusText(pct) {
    if (pct === 100) return 'Completed';
    if (pct > 0) return `${pct}% complete`;
    return 'Not started';
}

function btnText(pct) {
    if (pct === 100) return 'Review';
    if (pct > 0) return 'Continue';
    return 'Start';
}

export default function LearnWithUs() {
    const { t } = useTranslation();

    return (
        <div className="lwu-page">
            <div className="lwu-header">
                <div>
                    <h1 className="lwu-title">Learn With Us</h1>
                    <p className="lwu-subtitle">Training, resources and certifications for sustainability professionals</p>
                </div>
            </div>

            <div className="lwu-kpi-grid">
                {KPI_DATA.map((k) => (
                    <div key={k.label} className="lwu-kpi">
                        <div className="lwu-kpi-label">{k.label}</div>
                        <div className="lwu-kpi-row">
                            <div className="lwu-kpi-value">{k.value}</div>
                            <div className="lwu-kpi-icon" style={{ background: k.bg, color: k.color }}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15">
                                    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                                    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
                                </svg>
                            </div>
                        </div>
                        <div className="lwu-kpi-change">
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="18 15 12 9 6 15" /></svg>
                            +4 <span>this month</span>
                        </div>
                    </div>
                ))}
            </div>

            <div className="lwu-course-grid">
                {COURSES.map((c) => (
                    <div key={c.title} className="lwu-course-card">
                        <div className="lwu-course-banner" style={{ background: c.bg }}>
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={c.color} strokeWidth="1.8">
                                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                                <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
                            </svg>
                        </div>
                        <span className="lwu-course-cat" style={{ color: c.color, background: c.bg }}>
                            {c.cat}
                        </span>
                        <div className="lwu-course-title">{c.title}</div>
                        <div className="lwu-course-meta">{c.dur} &middot; {c.level}</div>
                        <div className="lwu-prog-bar">
                            <div className="lwu-prog-fill" style={{ width: `${c.pct}%`, background: c.color }} />
                        </div>
                        <div className="lwu-course-footer">
                            <span className="lwu-course-status">{statusText(c.pct)}</span>
                            <button type="button" className="lwu-btn lwu-btn--primary lwu-btn--sm">
                                {btnText(c.pct)}
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

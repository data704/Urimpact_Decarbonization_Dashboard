import { useState, useRef, useEffect } from 'react';
import './GHGAnalytics.css';

const VIEWS = [
    { key: 'overview', label: 'Overview', sub: 'All Scopes Combined', icon: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z' },
    { key: 'scope1', label: 'Scope 1', sub: 'Stationary, Mobile, Fugitive, Process', icon: 'M2 20h20M6 20V10l6-6 6 6v10' },
    { key: 'scope2', label: 'Scope 2', sub: 'Electricity, Steam, Heating, Cooling', icon: 'M13 2L3 14h9l-1 8 10-12h-9l1-8z' },
    { key: 'scope3', label: 'Scope 3', sub: 'Upstream & Downstream (Cat. 1-15)', icon: 'M1 6s0-2 3-2 5 4 8 4 5-4 8-4 3 2 3 2v14s0-2-3-2-5 4-8 4-5-4-8-4-3 2-3 2z' },
];

function HeatCell({ value, min, max, scopeColor = '26,154,143' }) {
    const pct = (value - min) / (max - min);
    const alpha = 0.1 + pct * 0.85;
    const bg = `rgba(${scopeColor},${alpha})`;
    const tc = pct > 0.6 ? '#fff' : '#1A2E2B';
    const display = value >= 1000 ? `${(value / 1000).toFixed(1)}K` : value;
    return (
        <td style={{ padding: '5px 3px', textAlign: 'center', background: bg, borderRadius: 6, fontSize: 11, fontWeight: 600, color: tc }}>
            {display}
        </td>
    );
}

/* ══════════════ OVERVIEW ══════════════ */
function OverviewView() {
    const kpis = [
        { label: 'Total GHG Emissions', sub: 'All Scopes · tCO₂e', value: '12,456', change: '-8.4%', bg: '#EAF7F6', ic: '#1A9A8F' },
        { label: 'Scope 1 Direct', sub: 'tCO₂e · 2024', value: '2,345', change: '-6.1%', bg: '#EAF7F6', ic: '#1A9A8F' },
        { label: 'Scope 2 Indirect', sub: 'tCO₂e · 2024', value: '3,210', change: '-7.3%', bg: '#E8F4FB', ic: '#2980B9' },
        { label: 'Scope 3 Value Chain', sub: 'tCO₂e · 2024', value: '6,901', change: '-9.7%', bg: '#FEF6E4', ic: '#E67E22' },
    ];

    const months = ['J','F','M','A','M','J','J','A','S','O','N','D'];
    const s1m = [48,52,58,45,62,68,54,50,42,38,44,30];
    const s2m = [62,65,70,58,75,82,66,62,55,50,58,45];
    const s3m = [105,112,120,98,128,138,114,108,95,88,100,80];

    const quarters = [
        { q: 'Q1 2024', s1: 606, s2: 836, s3: 1740, t: '3,182' },
        { q: 'Q2 2024', s1: 598, s2: 812, s3: 1720, t: '3,130' },
        { q: 'Q3 2024', s1: 578, s2: 780, s3: 1720, t: '3,078' },
        { q: 'Q4 2024', s1: 563, s2: 782, s3: 1721, t: '3,066' },
    ];

    const facilities = [
        { f: 'Plant A – Mumbai', vals: [1820,1760,1940,1680,2050,2180,1960,1840,1680,1580,1720,1380] },
        { f: 'Plant B – Pune', vals: [1410,1360,1540,1290,1650,1720,1540,1450,1320,1240,1380,1080] },
        { f: 'Head Office', vals: [240,220,260,210,280,295,268,255,230,210,240,192] },
        { f: 'Warehouse – Chennai', vals: [380,360,400,340,420,440,405,388,355,328,370,314] },
    ];
    const allFacTotals = [3850,3700,4140,3520,4400,4635,4173,3933,3585,3358,3710,2966];

    return (
        <>
            <div className="an-kpi-grid an-g4">
                {kpis.map((k) => (
                    <div key={k.label} className="an-kpi">
                        <div className="an-kpi-label">{k.label}<small>{k.sub}</small></div>
                        <div className="an-kpi-row">
                            <div className="an-kpi-value">{k.value}</div>
                            <div className="an-kpi-icon" style={{ background: k.bg, color: k.ic }}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15">
                                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                                </svg>
                            </div>
                        </div>
                        <div className="an-kpi-change an-kpi-change--good">
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="18 15 12 9 6 15" /></svg>
                            {k.change}<span>vs last year</span>
                        </div>
                    </div>
                ))}
            </div>

            {/* Month on Month + Year on Year */}
            <div className="an-g2">
                <div className="an-card">
                    <div className="an-card-title">Month-on-Month Emissions
                        <div className="an-toggle-group">
                            <span className="an-toggle-btn active">2024</span>
                            <span className="an-toggle-btn">2023</span>
                        </div>
                    </div>
                    <svg viewBox="0 0 480 170" width="100%" style={{ overflow: 'visible' }}>
                        <line x1="36" y1="10" x2="36" y2="148" stroke="#E4EDEB" strokeWidth="1" />
                        <line x1="36" y1="148" x2="475" y2="148" stroke="#E4EDEB" strokeWidth="1" />
                        {[0,40,80,120].map((y, i) => (
                            <g key={i}>
                                <line x1="36" y1={148 - y} x2="475" y2={148 - y} stroke="#E4EDEB" strokeWidth=".6" strokeDasharray="3 3" />
                                <text x="30" y={152 - y} textAnchor="end" fontSize="9" fill="#9BB5B0">{['0','500','1K','1.5K'][i]}</text>
                            </g>
                        ))}
                        {months.map((m, i) => {
                            const x = 36 + i * 37;
                            return (
                                <g key={m + i}>
                                    <rect x={x} y={148 - s1m[i] * 0.8} width="10" height={s1m[i] * 0.8} fill="#1A9A8F" rx="2" />
                                    <rect x={x + 10} y={148 - s2m[i] * 0.8} width="10" height={s2m[i] * 0.8} fill="#3DC8BE" rx="2" />
                                    <rect x={x + 20} y={148 - s3m[i] * 0.8} width="10" height={s3m[i] * 0.8} fill="#A8DDD9" rx="2" />
                                    <text x={x + 15} y="162" textAnchor="middle" fontSize="9" fill="#9BB5B0">{m}</text>
                                </g>
                            );
                        })}
                    </svg>
                    <div className="an-legend">
                        {[{ c: '#1A9A8F', l: 'Scope 1' }, { c: '#3DC8BE', l: 'Scope 2' }, { c: '#A8DDD9', l: 'Scope 3' }].map((x) => (
                            <div key={x.l} className="an-legend-item"><div className="an-legend-dot" style={{ background: x.c }} />{x.l}</div>
                        ))}
                    </div>
                </div>

                <div className="an-card">
                    <div className="an-card-title">Year-on-Year Trend</div>
                    <svg viewBox="0 0 440 170" width="100%" style={{ overflow: 'visible' }}>
                        <line x1="36" y1="10" x2="36" y2="148" stroke="#E4EDEB" strokeWidth="1" />
                        <line x1="36" y1="148" x2="430" y2="148" stroke="#E4EDEB" strokeWidth="1" />
                        {[0,40,80,120].map((y, i) => (
                            <g key={i}>
                                <line x1="36" y1={148 - y} x2="430" y2={148 - y} stroke="#E4EDEB" strokeWidth=".6" strokeDasharray="3 3" />
                                <text x="30" y={152 - y} textAnchor="end" fontSize="9" fill="#9BB5B0">{['0','5K','10K','15K'][i]}</text>
                            </g>
                        ))}
                        {['2021','2022','2023','2024'].map((yr, i) => (
                            <text key={yr} x={100 + i * 104} y="162" textAnchor="middle" fontSize="10" fill="#9BB5B0">{yr}</text>
                        ))}
                        <polyline points="100,48 204,56 308,68 412,80" fill="none" stroke="#1A9A8F" strokeWidth="2.5" strokeLinejoin="round" />
                        <polyline points="100,60 204,68 308,78 412,86" fill="none" stroke="#3DC8BE" strokeWidth="2" strokeLinejoin="round" strokeDasharray="5 3" />
                        <polyline points="100,30 204,38 308,50 412,62" fill="none" stroke="#A8DDD9" strokeWidth="2" strokeLinejoin="round" />
                        {[[100,48],[204,56],[308,68],[412,80]].map(([cx, cy], i) => (
                            <circle key={i} cx={cx} cy={cy} r="4" fill="#1A9A8F" stroke="#fff" strokeWidth="2" />
                        ))}
                    </svg>
                    <div className="an-yoy-summary">
                        {[{ l: 'Total 2021', v: '15,240', chg: '—' }, { l: 'Total 2022', v: '14,890', chg: '-2.3%' }, { l: 'Total 2023', v: '13,620', chg: '-8.5%' }, { l: 'Total 2024', v: '12,456', chg: '-8.4%' }].map((s) => (
                            <div key={s.l} className="an-yoy-box">
                                <div className="an-yoy-label">{s.l}</div>
                                <div className="an-yoy-val">{s.v}</div>
                                <div className="an-yoy-chg" style={{ color: s.chg === '—' ? '#9BB5B0' : '#27AE60' }}>{s.chg}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Quarterly + Donut */}
            <div className="an-quarterly-row">
                <div className="an-card">
                    <div className="an-card-title">Quarterly Analysis – All Scopes
                        <div className="an-toggle-group">
                            {['Q1','Q2','Q3','Q4'].map((q, i) => (
                                <span key={q} className={`an-toggle-btn ${i === 3 ? 'active' : ''}`}>{q}</span>
                            ))}
                        </div>
                    </div>
                    <div className="an-g4" style={{ marginBottom: 14 }}>
                        {quarters.map((q) => (
                            <div key={q.q} className="an-quarter-box">
                                <div className="an-quarter-label">{q.q}</div>
                                {[{ l: 'S1', v: q.s1, c: '#1A9A8F' }, { l: 'S2', v: q.s2, c: '#2980B9' }, { l: 'S3', v: q.s3, c: '#E67E22' }].map((s) => (
                                    <div key={s.l} className="an-quarter-row">
                                        <div className="an-quarter-scope"><div className="an-quarter-dot" style={{ background: s.c }} /><span>{s.l}</span></div>
                                        <span style={{ fontSize: 11.5, fontWeight: 600, color: '#1A2E2B' }}>{s.v}</span>
                                    </div>
                                ))}
                                <div className="an-quarter-total">
                                    <span>Total</span><span>{q.t}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="an-card an-donut-card">
                    <div className="an-card-title">Scope Distribution 2024</div>
                    <div className="an-donut-wrap">
                        <div className="an-donut-ring">
                            <svg viewBox="0 0 160 160" width="160" height="160">
                                <circle cx="80" cy="80" r="62" fill="none" stroke="#E4EDEB" strokeWidth="22" />
                                <circle cx="80" cy="80" r="62" fill="none" stroke="#1A9A8F" strokeWidth="22" strokeDasharray="118 389" strokeDashoffset="0" transform="rotate(-90 80 80)" />
                                <circle cx="80" cy="80" r="62" fill="none" stroke="#3DC8BE" strokeWidth="22" strokeDasharray="162 389" strokeDashoffset="-118" transform="rotate(-90 80 80)" />
                                <circle cx="80" cy="80" r="62" fill="none" stroke="#A8DDD9" strokeWidth="22" strokeDasharray="109 389" strokeDashoffset="-280" transform="rotate(-90 80 80)" />
                            </svg>
                            <div className="an-donut-center">
                                <div className="an-donut-val">12.4K</div>
                                <div className="an-donut-unit">tCO₂e Total</div>
                            </div>
                        </div>
                        <div className="an-donut-legend">
                            {[{ l: 'Scope 1', pct: '18.8%', v: '2,345', c: '#1A9A8F' }, { l: 'Scope 2', pct: '25.8%', v: '3,210', c: '#3DC8BE' }, { l: 'Scope 3', pct: '55.4%', v: '6,901', c: '#A8DDD9' }].map((s) => (
                                <div key={s.l} className="an-donut-legend-row">
                                    <div className="an-donut-legend-dot" style={{ background: s.c }} />
                                    <span className="an-donut-legend-label">{s.l}</span>
                                    <span className="an-donut-legend-val">{s.v}</span>
                                    <span className="an-donut-legend-pct" style={{ color: s.c }}>{s.pct}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Facility Heatmap */}
            <div className="an-card">
                <div className="an-card-title">
                    Facility-wise Emissions Heatmap – All Scopes (tCO₂e)
                    <div className="an-heatmap-legend">
                        <div className="an-hm-lg"><div className="an-hm-dot" style={{ background: '#EAF7F6' }} />Low</div>
                        <div className="an-hm-lg"><div className="an-hm-dot" style={{ background: '#8DD8D3' }} />Medium</div>
                        <div className="an-hm-lg"><div className="an-hm-dot" style={{ background: '#1A9A8F' }} />High</div>
                    </div>
                </div>
                <div style={{ overflowX: 'auto' }}>
                    <table className="an-heatmap-table">
                        <thead>
                            <tr>
                                <th style={{ textAlign: 'left' }}>Facility</th>
                                {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map((m) => (
                                    <th key={m} style={{ textAlign: 'center' }}>{m}</th>
                                ))}
                                <th style={{ textAlign: 'right' }}>Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            {facilities.map((row) => {
                                const total = row.vals.reduce((a, b) => a + b, 0).toLocaleString();
                                return (
                                    <tr key={row.f}>
                                        <td style={{ fontWeight: 600, whiteSpace: 'nowrap', background: '#fff', borderRadius: 6 }}>{row.f}</td>
                                        {row.vals.map((v, i) => <HeatCell key={i} value={v} min={180} max={2200} />)}
                                        <td style={{ fontWeight: 800, color: '#1A9A8F', textAlign: 'right', background: '#fff', borderRadius: 6 }}>{total}</td>
                                    </tr>
                                );
                            })}
                            <tr className="an-heatmap-total-row">
                                <td style={{ fontWeight: 700 }}>All Facilities</td>
                                {allFacTotals.map((v, i) => (
                                    <td key={i} style={{ textAlign: 'center', background: '#EAF7F6', borderRadius: 6, fontWeight: 700, color: '#1A9A8F' }}>
                                        {(v / 1000).toFixed(1)}K
                                    </td>
                                ))}
                                <td style={{ fontWeight: 800, color: '#1A9A8F', textAlign: 'right' }}>12,456</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </>
    );
}

/* ══════════════ SCOPE 1 ══════════════ */
function Scope1View() {
    const kpis = [
        { l: 'Stationary Combustion', v: '1,120', pct: 48, c: '#1A9A8F' },
        { l: 'Mobile Combustion', v: '680', pct: 29, c: '#3DC8BE' },
        { l: 'Fugitive Emissions', v: '320', pct: 14, c: '#85D8D4' },
        { l: 'Process Emissions', v: '225', pct: 9, c: '#C8EDEA' },
    ];
    const yoyData = [
        { n: 'Stationary', vals: [1380, 1290, 1200, 1120], chg: '-6.7%' },
        { n: 'Mobile', vals: [810, 776, 724, 680], chg: '-6.1%' },
        { n: 'Fugitive', vals: [378, 364, 342, 320], chg: '-6.4%' },
        { n: 'Process', vals: [258, 250, 240, 225], chg: '-6.3%' },
        { n: 'Total S1', vals: [2826, 2680, 2506, 2345], chg: '-6.4%', bold: true },
    ];

    return (
        <>
            <div className="an-kpi-grid an-g4">
                {kpis.map((k) => (
                    <div key={k.l} className="an-kpi">
                        <div className="an-kpi-label">{k.l}<small>tCO₂e</small></div>
                        <div className="an-kpi-row">
                            <div className="an-kpi-value">{k.v}</div>
                            <div className="an-kpi-icon" style={{ background: '#EAF7F6', color: '#1A9A8F' }}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>
                            </div>
                        </div>
                        <div className="an-kpi-bar"><div className="an-kpi-bar-fill" style={{ width: `${k.pct}%`, background: k.c }} /></div>
                    </div>
                ))}
            </div>

            <div className="an-g2">
                <div className="an-card">
                    <div className="an-card-title">Scope 1 – Month-on-Month by Category</div>
                    <svg viewBox="0 0 480 170" width="100%" style={{ overflow: 'visible' }}>
                        <line x1="36" y1="10" x2="36" y2="148" stroke="#E4EDEB" strokeWidth="1" />
                        <line x1="36" y1="148" x2="475" y2="148" stroke="#E4EDEB" strokeWidth="1" />
                        {[0,35,70,105].map((y, i) => (
                            <g key={i}>
                                <line x1="36" y1={148 - y} x2="475" y2={148 - y} stroke="#E4EDEB" strokeWidth=".6" strokeDasharray="3 3" />
                                <text x="30" y={152 - y} textAnchor="end" fontSize="9" fill="#9BB5B0">{['0','100','200','300'][i]}</text>
                            </g>
                        ))}
                        {['J','F','M','A','M','J','J','A','S','O','N','D'].map((m, i) => {
                            const sc = [92,96,105,88,112,118,98,94,85,80,90,72];
                            const mc = [54,57,62,52,66,72,59,55,50,47,52,42];
                            const x = 36 + i * 37;
                            return (
                                <g key={m + i}>
                                    <rect x={x} y={148 - sc[i] * 0.5} width="8" height={sc[i] * 0.5} fill="#1A9A8F" rx="2" />
                                    <rect x={x + 8} y={148 - mc[i] * 0.5} width="8" height={mc[i] * 0.5} fill="#3DC8BE" rx="2" />
                                    <rect x={x + 16} y={148 - 26 * 0.5} width="8" height={26 * 0.5} fill="#85D8D4" rx="2" />
                                    <rect x={x + 24} y={148 - 18 * 0.5} width="8" height={18 * 0.5} fill="#C8EDEA" rx="2" />
                                    <text x={x + 16} y="162" textAnchor="middle" fontSize="9" fill="#9BB5B0">{m}</text>
                                </g>
                            );
                        })}
                    </svg>
                    <div className="an-legend">
                        {[{ c: '#1A9A8F', l: 'Stationary' }, { c: '#3DC8BE', l: 'Mobile' }, { c: '#85D8D4', l: 'Fugitive' }, { c: '#C8EDEA', l: 'Process' }].map((x) => (
                            <div key={x.l} className="an-legend-item"><div className="an-legend-dot" style={{ background: x.c }} />{x.l}</div>
                        ))}
                    </div>
                </div>
                <div className="an-card">
                    <div className="an-card-title">Scope 1 – Year-on-Year by Category</div>
                    <table className="an-data-table">
                        <thead>
                            <tr>
                                {['Category', '2021', '2022', '2023', '2024', 'Change'].map((h) => (
                                    <th key={h} style={{ textAlign: h === 'Category' ? 'left' : 'right' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {yoyData.map((r) => (
                                <tr key={r.n}>
                                    <td style={{ fontWeight: r.bold ? 700 : 500, color: r.bold ? '#1A9A8F' : undefined }}>{r.n}</td>
                                    {r.vals.map((v, i) => <td key={i} style={{ textAlign: 'right', fontWeight: r.bold ? 700 : undefined, color: r.bold ? '#1A9A8F' : undefined }}>{v.toLocaleString()}</td>)}
                                    <td style={{ textAlign: 'right', fontWeight: 600, color: '#27AE60' }}>{r.chg}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="an-g2">
                <div className="an-card">
                    <div className="an-card-title">Scope 1 – Quarterly Breakdown</div>
                    <div className="an-g4">
                        {[{ q: 'Q1', s: 606, m: 366, f: 165, p: 116 }, { q: 'Q2', s: 598, m: 362, f: 162, p: 114 }, { q: 'Q3', s: 578, m: 350, f: 156, p: 110 }, { q: 'Q4', s: 563, m: 341, f: 152, p: 109 }].map((q) => (
                            <div key={q.q} className="an-quarter-box">
                                <div className="an-quarter-label">{q.q}</div>
                                {[{ l: 'Stat.', v: q.s, c: '#1A9A8F' }, { l: 'Mob.', v: q.m, c: '#3DC8BE' }, { l: 'Fug.', v: q.f, c: '#85D8D4' }, { l: 'Proc.', v: q.p, c: '#C8EDEA' }].map((s) => (
                                    <div key={s.l} className="an-quarter-row">
                                        <span style={{ fontSize: 10.5, color: '#9BB5B0' }}>{s.l}</span>
                                        <span style={{ fontSize: 11, fontWeight: 600, color: s.c }}>{s.v}</span>
                                    </div>
                                ))}
                                <div className="an-quarter-total"><span /><span>{q.s + q.m + q.f + q.p}</span></div>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="an-card">
                    <div className="an-card-title" style={{ fontSize: 12.5 }}>Facility Heatmap – Scope 1 (tCO₂e)</div>
                    <table className="an-heatmap-table an-heatmap-table--compact">
                        <thead>
                            <tr>
                                <th style={{ textAlign: 'left' }}>Facility</th>
                                {['Q1','Q2','Q3','Q4'].map((q) => <th key={q} style={{ textAlign: 'center' }}>{q}</th>)}
                                <th style={{ textAlign: 'right' }}>Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            {[{ f: 'Plant A', vals: [620,612,590,575] }, { f: 'Plant B', vals: [480,472,456,444] }, { f: 'Head Office', vals: [64,62,60,58] }, { f: 'Warehouse', vals: [97,95,91,88] }].map((r) => (
                                <tr key={r.f}>
                                    <td style={{ fontWeight: 600, fontSize: 11.5 }}>{r.f}</td>
                                    {r.vals.map((v, i) => <HeatCell key={i} value={v} min={58} max={620} />)}
                                    <td style={{ fontWeight: 800, color: '#1A9A8F', textAlign: 'right' }}>{r.vals.reduce((a, b) => a + b, 0)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </>
    );
}

/* ══════════════ SCOPE 2 ══════════════ */
function Scope2View() {
    const kpis = [
        { l: 'Purchased Electricity', v: '1,850', pct: 58, c: '#2980B9' },
        { l: 'Purchased Steam', v: '620', pct: 19, c: '#3498DB' },
        { l: 'Purchased Heating', v: '490', pct: 15, c: '#5DADE2' },
        { l: 'Purchased Cooling', v: '250', pct: 8, c: '#AED6F1' },
    ];
    const yoyData = [
        { n: 'Electricity', vals: [2200, 2040, 1960, 1850], chg: '-5.6%' },
        { n: 'Steam', vals: [740, 710, 668, 620], chg: '-7.2%' },
        { n: 'Heating', vals: [584, 556, 528, 490], chg: '-7.2%' },
        { n: 'Cooling', vals: [300, 288, 272, 250], chg: '-8.1%' },
        { n: 'Total S2', vals: [3824, 3594, 3428, 3210], chg: '-6.4%', bold: true },
    ];

    return (
        <>
            <div className="an-kpi-grid an-g4">
                {kpis.map((k) => (
                    <div key={k.l} className="an-kpi">
                        <div className="an-kpi-label">{k.l}<small>tCO₂e</small></div>
                        <div className="an-kpi-row">
                            <div className="an-kpi-value">{k.v}</div>
                            <div className="an-kpi-icon" style={{ background: '#E8F4FB', color: '#2980B9' }}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>
                            </div>
                        </div>
                        <div className="an-kpi-bar"><div className="an-kpi-bar-fill" style={{ width: `${k.pct}%`, background: k.c }} /></div>
                    </div>
                ))}
            </div>

            <div className="an-g2">
                <div className="an-card">
                    <div className="an-card-title">Scope 2 – Month-on-Month by Category</div>
                    <svg viewBox="0 0 480 170" width="100%" style={{ overflow: 'visible' }}>
                        <line x1="36" y1="10" x2="36" y2="148" stroke="#E4EDEB" strokeWidth="1" />
                        <line x1="36" y1="148" x2="475" y2="148" stroke="#E4EDEB" strokeWidth="1" />
                        {[0,40,80,120].map((y, i) => (
                            <g key={i}>
                                <line x1="36" y1={148 - y} x2="475" y2={148 - y} stroke="#E4EDEB" strokeWidth=".6" strokeDasharray="3 3" />
                                <text x="30" y={152 - y} textAnchor="end" fontSize="9" fill="#9BB5B0">{['0','200','400','600'][i]}</text>
                            </g>
                        ))}
                        {['J','F','M','A','M','J','J','A','S','O','N','D'].map((m, i) => {
                            const el = [154,148,165,142,172,178,164,158,144,136,150,120];
                            const x = 36 + i * 37;
                            return (
                                <g key={m + i}>
                                    <rect x={x} y={148 - el[i] * 0.23} width="8" height={el[i] * 0.23} fill="#2980B9" rx="2" />
                                    <rect x={x + 8} y={148 - 52 * 0.23} width="8" height={52 * 0.23} fill="#3498DB" rx="2" />
                                    <rect x={x + 16} y={148 - 41 * 0.23} width="8" height={41 * 0.23} fill="#5DADE2" rx="2" />
                                    <rect x={x + 24} y={148 - 21 * 0.23} width="8" height={21 * 0.23} fill="#AED6F1" rx="2" />
                                    <text x={x + 16} y="162" textAnchor="middle" fontSize="9" fill="#9BB5B0">{m}</text>
                                </g>
                            );
                        })}
                    </svg>
                    <div className="an-legend">
                        {[{ c: '#2980B9', l: 'Electricity' }, { c: '#3498DB', l: 'Steam' }, { c: '#5DADE2', l: 'Heating' }, { c: '#AED6F1', l: 'Cooling' }].map((x) => (
                            <div key={x.l} className="an-legend-item"><div className="an-legend-dot" style={{ background: x.c }} />{x.l}</div>
                        ))}
                    </div>
                </div>
                <div className="an-card">
                    <div className="an-card-title">Scope 2 – Year-on-Year</div>
                    <table className="an-data-table">
                        <thead><tr>{['Category','2021','2022','2023','2024','Change'].map((h) => <th key={h} style={{ textAlign: h === 'Category' ? 'left' : 'right' }}>{h}</th>)}</tr></thead>
                        <tbody>
                            {yoyData.map((r) => (
                                <tr key={r.n}>
                                    <td style={{ fontWeight: r.bold ? 700 : 500, color: r.bold ? '#2980B9' : undefined }}>{r.n}</td>
                                    {r.vals.map((v, i) => <td key={i} style={{ textAlign: 'right', fontWeight: r.bold ? 700 : undefined, color: r.bold ? '#2980B9' : undefined }}>{v.toLocaleString()}</td>)}
                                    <td style={{ textAlign: 'right', fontWeight: 600, color: '#27AE60' }}>{r.chg}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </>
    );
}

/* ══════════════ SCOPE 3 ══════════════ */
function Scope3View() {
    const kpis = [
        { l: 'Upstream (Cat. 1-8)', v: '4,230', pct: 61, c: '#E67E22' },
        { l: 'Downstream (Cat. 9-15)', v: '2,671', pct: 39, c: '#F39C12' },
        { l: 'Top Category', sub: 'Purchased Goods (Cat.1)', v: '1,940', c: '#E67E22' },
        { l: 'Highest Risk Cat.', sub: 'Business Travel (Cat.6)', v: '620', c: '#C0392B' },
    ];

    const yoyData = [
        { n: 'Cat.1 Purchased Goods', vals: [2180, 2060, 1940], chg: '-5.8%' },
        { n: 'Cat.4 Upstream Transport', vals: [1020, 980, 965], chg: '-1.5%' },
        { n: 'Cat.6 Business Travel', vals: [710, 670, 620], chg: '-7.5%' },
        { n: 'Cat.2 Capital Goods', vals: [840, 790, 745], chg: '-5.7%' },
        { n: 'Cat.7 Employee Commuting', vals: [490, 465, 430], chg: '-7.5%' },
        { n: 'Cat.3 Fuel & Energy', vals: [380, 354, 320], chg: '-9.6%' },
        { n: 'Cat.9 Downstream Trans.', vals: [310, 292, 268], chg: '-8.2%' },
        { n: 'Others (8 categories)', vals: [680, 650, 613], chg: '-5.7%' },
    ];

    return (
        <>
            <div className="an-kpi-grid an-g4">
                {kpis.map((k) => (
                    <div key={k.l} className="an-kpi">
                        <div className="an-kpi-label">{k.l}<small>{k.sub || 'tCO₂e'}</small></div>
                        <div className="an-kpi-row">
                            <div className="an-kpi-value">{k.v}</div>
                            <div className="an-kpi-icon" style={{ background: '#FEF6E4', color: '#E67E22' }}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15"><path d="M1 6s0-2 3-2 5 4 8 4 5-4 8-4 3 2 3 2v14s0-2-3-2-5 4-8 4-5-4-8-4-3 2-3 2z" /></svg>
                            </div>
                        </div>
                        {k.pct && <div className="an-kpi-bar"><div className="an-kpi-bar-fill" style={{ width: `${k.pct}%`, background: k.c }} /></div>}
                    </div>
                ))}
            </div>

            <div className="an-g2">
                <div className="an-card">
                    <div className="an-card-title">Scope 3 – Category-wise Year-on-Year</div>
                    <table className="an-data-table" style={{ fontSize: 11.5 }}>
                        <thead><tr>{['Category','2022','2023','2024','∆ YoY'].map((h) => <th key={h} style={{ textAlign: h === 'Category' ? 'left' : 'right' }}>{h}</th>)}</tr></thead>
                        <tbody>
                            {yoyData.map((r) => (
                                <tr key={r.n}>
                                    <td style={{ fontWeight: 500, whiteSpace: 'nowrap' }}>{r.n}</td>
                                    {r.vals.map((v, i) => <td key={i} style={{ textAlign: 'right' }}>{v.toLocaleString()}</td>)}
                                    <td style={{ textAlign: 'right', fontWeight: 600, color: '#27AE60' }}>{r.chg}</td>
                                </tr>
                            ))}
                            <tr style={{ borderTop: '2px solid #E4EDEB' }}>
                                <td style={{ fontWeight: 700, color: '#E67E22' }}>Total S3</td>
                                {[7610, 7261, 6901].map((v, i) => <td key={i} style={{ textAlign: 'right', fontWeight: 700, color: '#E67E22' }}>{v.toLocaleString()}</td>)}
                                <td style={{ textAlign: 'right', fontWeight: 700, color: '#27AE60' }}>-5.0%</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div className="an-card">
                        <div className="an-card-title">Scope 3 – Quarterly Split</div>
                        <div className="an-g4">
                            {[{ q: 'Q1', up: 1068, dn: 678, t: 1746 }, { q: 'Q2', up: 1056, dn: 672, t: 1728 }, { q: 'Q3', up: 1062, dn: 668, t: 1730 }, { q: 'Q4', up: 1044, dn: 653, t: 1697 }].map((q) => (
                                <div key={q.q} className="an-quarter-box">
                                    <div className="an-quarter-label">{q.q}</div>
                                    <div className="an-quarter-row"><span style={{ fontSize: 10.5, color: '#9BB5B0' }}>Upstream</span><span style={{ fontSize: 11, fontWeight: 600, color: '#E67E22' }}>{q.up}</span></div>
                                    <div className="an-quarter-row"><span style={{ fontSize: 10.5, color: '#9BB5B0' }}>Downstream</span><span style={{ fontSize: 11, fontWeight: 600, color: '#F39C12' }}>{q.dn}</span></div>
                                    <div className="an-quarter-total"><span /><span style={{ color: '#E67E22' }}>{q.t}</span></div>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="an-card" style={{ flex: 1 }}>
                        <div className="an-card-title" style={{ fontSize: 12.5 }}>Facility Heatmap – Scope 3 (tCO₂e)</div>
                        <table className="an-heatmap-table an-heatmap-table--compact">
                            <thead><tr><th style={{ textAlign: 'left' }}>Facility</th>{['Q1','Q2','Q3','Q4'].map((q) => <th key={q} style={{ textAlign: 'center' }}>{q}</th>)}<th style={{ textAlign: 'right' }}>Total</th></tr></thead>
                            <tbody>
                                {[{ f: 'Plant A', vals: [560,552,555,540] }, { f: 'Plant B', vals: [688,680,680,668] }, { f: 'Head Office', vals: [312,308,306,300] }, { f: 'Warehouse', vals: [186,184,185,182] }].map((r) => (
                                    <tr key={r.f}>
                                        <td style={{ fontWeight: 600, fontSize: 11.5 }}>{r.f}</td>
                                        {r.vals.map((v, i) => <HeatCell key={i} value={v} min={182} max={688} scopeColor="230,126,34" />)}
                                        <td style={{ fontWeight: 800, color: '#E67E22', textAlign: 'right' }}>{r.vals.reduce((a, b) => a + b, 0)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </>
    );
}

/* ══════════════ MAIN COMPONENT ══════════════ */
export default function GHGAnalytics() {
    const [view, setView] = useState('overview');
    const [ddOpen, setDdOpen] = useState(false);
    const ddRef = useRef(null);

    useEffect(() => {
        function handleClick(e) {
            if (ddRef.current && !ddRef.current.contains(e.target)) setDdOpen(false);
        }
        document.addEventListener('click', handleClick);
        return () => document.removeEventListener('click', handleClick);
    }, []);

    const currentView = VIEWS.find((v) => v.key === view) || VIEWS[0];

    return (
        <div className="ghg-analytics">
            {/* Header row */}
            <div className="an-header">
                <div className="an-view-selector">
                    <span style={{ fontSize: 13, fontWeight: 600 }}>View:</span>
                    <div className="an-dropdown" ref={ddRef}>
                        <button type="button" className="an-dd-btn" onClick={() => setDdOpen(!ddOpen)}>
                            <span className="an-dd-label">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    {currentView.icon.split('|').map((p, i) => <path key={i} d={p} />)}
                                </svg>
                                {currentView.label}
                            </span>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9" /></svg>
                        </button>
                        {ddOpen && (
                            <div className="an-dd-menu">
                                {VIEWS.map((v) => (
                                    <div key={v.key} className="an-dd-option" onClick={() => { setView(v.key); setDdOpen(false); }}>
                                        <div className="an-dd-option-icon">
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                {v.icon.split('|').map((p, i) => <path key={i} d={p} />)}
                                            </svg>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: 12.5, fontWeight: 600 }}>{v.label}</div>
                                            <div style={{ fontSize: 10.5, color: '#9BB5B0', marginTop: 1 }}>{v.sub}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {view === 'overview' && <OverviewView />}
            {view === 'scope1' && <Scope1View />}
            {view === 'scope2' && <Scope2View />}
            {view === 'scope3' && <Scope3View />}
        </div>
    );
}

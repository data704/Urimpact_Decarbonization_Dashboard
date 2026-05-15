/**
 * Interactive dashboard widgets — Chart.js powered charts + animated rings.
 */
import { useState, useEffect, useRef } from 'react';
import {
    Chart as ChartJS,
    ArcElement,
    BarElement,
    CategoryScale,
    LinearScale,
    Tooltip as CJTooltip,
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, CJTooltip);

/* ── Animated Footprint Ring ── */
export function FootprintRing({ pct, color, size = 80, stroke = 9, label }) {
    const [animPct, setAnimPct] = useState(0);
    const [hovered, setHovered] = useState(false);
    const clamped = Math.min(100, Math.max(0, pct));

    useEffect(() => {
        let raf;
        const start = performance.now();
        const duration = 900;
        const animate = (now) => {
            const t = Math.min((now - start) / duration, 1);
            const ease = 1 - Math.pow(1 - t, 3); // easeOutCubic
            setAnimPct(clamped * ease);
            if (t < 1) raf = requestAnimationFrame(animate);
        };
        raf = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(raf);
    }, [clamped]);

    const r = size / 2 - stroke / 2;
    const c = 2 * Math.PI * r;
    const d = c * (animPct / 100);

    return (
        <div
            className="dash-sfp-ring-interactive"
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{ position: 'relative', display: 'inline-block', cursor: 'default' }}
        >
            <svg
                viewBox={`0 0 ${size} ${size}`}
                width={size}
                height={size}
                className="dash-sfp-svg"
                aria-hidden
                style={{ transition: 'transform 0.2s', transform: hovered ? 'scale(1.08)' : 'scale(1)' }}
            >
                <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#E4EDEB" strokeWidth={stroke} />
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={r}
                    fill="none"
                    stroke={color}
                    strokeWidth={hovered ? stroke + 2 : stroke}
                    strokeDasharray={`${d} ${c}`}
                    transform={`rotate(-90 ${size / 2} ${size / 2})`}
                    strokeLinecap="round"
                    style={{ transition: 'stroke-width 0.2s, filter 0.2s', filter: hovered ? `drop-shadow(0 0 4px ${color}40)` : 'none' }}
                />
            </svg>
            {hovered && label && (
                <div className="dash-ring-tooltip">
                    {label}: {Math.round(pct)}%
                </div>
            )}
        </div>
    );
}

/* ── Interactive Monthly Energy Bar Chart ── */
export function MonthlyEnergyChart({ data, months, t }) {
    const heights = data || [75, 70, 82, 66, 88, 92, 85, 80, 73, 68, 62, 58];
    const labels = months || ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    const chartData = {
        labels,
        datasets: [
            {
                data: heights,
                backgroundColor: heights.map((_, i) =>
                    i === heights.length - 1 ? '#1A9A8F' : '#C8EDEA'
                ),
                hoverBackgroundColor: '#1A9A8F',
                borderRadius: 4,
                borderSkipped: false,
                barPercentage: 0.7,
            },
        ],
    };

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: {
                backgroundColor: '#1A2E2B',
                titleColor: '#fff',
                bodyColor: '#eaf7f6',
                padding: 10,
                cornerRadius: 8,
                displayColors: false,
                callbacks: {
                    label: (ctx) => `${ctx.parsed.y} MWh`,
                },
            },
        },
        scales: {
            x: {
                grid: { display: false },
                ticks: { color: '#9BB5B0', font: { size: 10, family: 'Poppins, sans-serif' } },
            },
            y: {
                display: false,
                beginAtZero: true,
            },
        },
        onHover: (event, elements, chart) => {
            chart.canvas.style.cursor = elements.length ? 'pointer' : 'default';
        },
    };

    return (
        <div style={{ height: 140, width: '100%' }}>
            <Bar data={chartData} options={options} />
        </div>
    );
}

/* ── Interactive Waste Donut Chart ── */
export function WasteDonutChart({ recycled = 42, composted = 26, landfill = 32, labels: customLabels }) {
    const fallbackLabels = ['Recycled', 'Composted', 'Landfill'];
    const lbls = customLabels || fallbackLabels;

    const chartData = {
        labels: lbls,
        datasets: [
            {
                data: [recycled, composted, landfill],
                backgroundColor: ['#1A9A8F', '#3DC8BE', '#C8EDEA'],
                hoverBackgroundColor: ['#158A80', '#2DB8AE', '#A8DDD9'],
                borderWidth: 0,
                hoverOffset: 8,
            },
        ],
    };

    const options = {
        responsive: true,
        maintainAspectRatio: true,
        cutout: '62%',
        plugins: {
            legend: { display: false },
            tooltip: {
                backgroundColor: '#1A2E2B',
                titleColor: '#fff',
                bodyColor: '#eaf7f6',
                padding: 10,
                cornerRadius: 8,
                callbacks: {
                    label: (ctx) => `${ctx.label}: ${ctx.parsed}%`,
                },
            },
        },
        onHover: (event, elements, chart) => {
            chart.canvas.style.cursor = elements.length ? 'pointer' : 'default';
        },
    };

    return (
        <div style={{ width: 110, height: 110 }}>
            <Doughnut data={chartData} options={options} />
        </div>
    );
}

/* ── Legacy SVG fallbacks (kept for backwards compat) ── */
export function MonthlyEnergySvg() {
    const heights = [75, 70, 82, 66, 88, 92, 85, 80, 73, 68, 62, 58];
    const months = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
    return (
        <svg viewBox="0 0 300 110" width="100%" className="dash-energy-svg" aria-hidden>
            {months.map((m, i) => {
                const h = heights[i];
                return (
                    <g key={m + i}>
                        <rect
                            x={6 + i * 23}
                            y={110 - h}
                            width={14}
                            height={h}
                            fill={i === 11 ? 'var(--up-teal-dark, #1a9a8f)' : 'var(--up-teal-bg, #eaf7f6)'}
                            rx={3}
                        />
                        <text x={13 + i * 23} y={108} textAnchor="middle" fontSize={8} fill="#9BB5B0">
                            {m}
                        </text>
                    </g>
                );
            })}
        </svg>
    );
}

export function WasteDonutSvg() {
    return (
        <svg viewBox="0 0 110 110" width={110} height={110} className="dash-waste-svg" aria-hidden>
            <circle cx="55" cy="55" r="42" fill="none" stroke="#E4EDEB" strokeWidth="14" />
            <circle cx="55" cy="55" r="42" fill="none" stroke="#1A9A8F" strokeWidth="14" strokeDasharray="110 264" strokeDashoffset="0" transform="rotate(-90 55 55)" />
            <circle cx="55" cy="55" r="42" fill="none" stroke="#3DC8BE" strokeWidth="14" strokeDasharray="69 264" strokeDashoffset="-110" transform="rotate(-90 55 55)" />
            <circle cx="55" cy="55" r="42" fill="none" stroke="#C8EDEA" strokeWidth="14" strokeDasharray="85 264" strokeDashoffset="-179" transform="rotate(-90 55 55)" />
        </svg>
    );
}

export function ProgressBarRow({ label, pct, color }) {
    const [animWidth, setAnimWidth] = useState(0);
    const [hovered, setHovered] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => setAnimWidth(pct), 100);
        return () => clearTimeout(timer);
    }, [pct]);

    return (
        <div
            className="dash-prog-row"
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{ cursor: 'default' }}
        >
            <div className="dash-prog-lbl">
                <span>{label}</span>
                <span className="dash-prog-pct" style={{ color: pct < 50 ? 'var(--up-red, #e74c3c)' : undefined, fontWeight: hovered ? 700 : undefined }}>
                    {pct}%
                </span>
            </div>
            <div className="dash-prog-track">
                <div
                    className="dash-prog-fill"
                    style={{
                        width: `${animWidth}%`,
                        background: color,
                        transition: 'width 0.8s cubic-bezier(0.22,1,0.36,1)',
                        filter: hovered ? 'brightness(1.15)' : 'none',
                    }}
                />
            </div>
        </div>
    );
}

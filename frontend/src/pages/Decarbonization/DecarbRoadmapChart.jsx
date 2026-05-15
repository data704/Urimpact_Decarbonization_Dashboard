import { useMemo, useState, useCallback } from 'react';

const YEARS = ['2020', '2022', '2024', '2026', '2028', '2030', '2035', '2040', '2045'];
const Y_MAX = 18000;

function yToPx(yVal) {
    return 160 - (yVal / Y_MAX) * 150;
}

function xForIndex(i) {
    return 40 + i * 45;
}

const SERIES = {
    actual: {
        label: 'Actual/Planned',
        color: '#1A9A8F',
        values: [14400, 13200, 11400, 9600, 7800, 6600, 4800, 3200, 1200],
    },
    bau: {
        label: 'BAU Scenario',
        color: '#CBD5D3',
        values: [14400, 13600, 12400, 10800, 9200, 7600, 5200, 2800, 1200],
    },
};

function buildPolyline(values) {
    return values.map((v, i) => `${xForIndex(i)},${yToPx(v)}`).join(' ');
}

export default function DecarbRoadmapChart() {
    const [hoveredIndex, setHoveredIndex] = useState(null);
    const [hideBau, setHideBau] = useState(false);

    const toggleBau = useCallback(() => setHideBau((v) => !v), []);

    const points = useMemo(
        () =>
            YEARS.map((year, i) => ({
                year,
                x: xForIndex(i),
                actual: SERIES.actual.values[i],
                bau: SERIES.bau.values[i],
            })),
        []
    );

    const tooltip = hoveredIndex != null ? points[hoveredIndex] : null;
    const tooltipY = tooltip ? Math.min(yToPx(tooltip.actual), yToPx(tooltip.bau)) - 8 : 0;

    return (
        <div className="dc-roadmap-wrap">
            <svg
                viewBox="0 0 460 190"
                width="100%"
                className="dc-roadmap-svg"
                role="img"
                aria-label="Emissions reduction roadmap"
                onMouseLeave={() => setHoveredIndex(null)}
            >
                <line x1="40" y1="10" x2="40" y2="160" stroke="#E4EDEB" strokeWidth="1" />
                <line x1="40" y1="160" x2="450" y2="160" stroke="#E4EDEB" strokeWidth="1" />
                {[0, 40, 80, 120, 150].map((y, i) => (
                    <g key={y}>
                        <line x1="40" y1={160 - y} x2="450" y2={160 - y} stroke="#E4EDEB" strokeWidth="0.7" strokeDasharray="4 3" />
                        <text x="34" y={164 - y} textAnchor="end" fontSize="9" fill="#9BB5B0">
                            {['0', '5K', '10K', '15K', '18K'][i]}
                        </text>
                    </g>
                ))}
                {YEARS.map((l, i) => (
                    <text key={l} x={xForIndex(i)} y="175" textAnchor="middle" fontSize="9" fill="#9BB5B0">
                        {l}
                    </text>
                ))}

                {!hideBau && (
                    <polyline
                        points={buildPolyline(SERIES.bau.values)}
                        fill="none"
                        stroke={SERIES.bau.color}
                        strokeWidth="1.5"
                        strokeDasharray="5 3"
                        pointerEvents="none"
                    />
                )}
                <polyline
                    points={buildPolyline(SERIES.actual.values)}
                    fill="none"
                    stroke={SERIES.actual.color}
                    strokeWidth="2.5"
                    strokeLinejoin="round"
                    pointerEvents="none"
                />
                <polyline
                    points="220,102 265,120 310,135 355,148 400,158"
                    fill="none"
                    stroke={SERIES.actual.color}
                    strokeWidth="2"
                    strokeDasharray="6 3"
                    pointerEvents="none"
                />

                {hoveredIndex != null && (
                    <line
                        x1={points[hoveredIndex].x}
                        y1="10"
                        x2={points[hoveredIndex].x}
                        y2="160"
                        stroke="#C8EDEA"
                        strokeWidth="1"
                        pointerEvents="none"
                    />
                )}

                {points.map((p, i) => (
                    <g key={p.year}>
                        <rect
                            x={p.x - 22}
                            y="10"
                            width="44"
                            height="150"
                            fill="transparent"
                            className="dc-roadmap-hit"
                            onMouseEnter={() => setHoveredIndex(i)}
                            onFocus={() => setHoveredIndex(i)}
                            tabIndex={0}
                            role="button"
                            aria-label={`${p.year}: ${p.actual.toLocaleString()} tCO₂e planned`}
                        />
                        {hoveredIndex === i && (
                            <>
                                <circle cx={p.x} cy={yToPx(p.actual)} r="5" fill="#1A9A8F" stroke="#fff" strokeWidth="2" />
                                {!hideBau && (
                                    <circle cx={p.x} cy={yToPx(p.bau)} r="4" fill="#CBD5D3" stroke="#fff" strokeWidth="1.5" />
                                )}
                            </>
                        )}
                    </g>
                ))}

                <circle cx="400" cy="158" r="5" fill="#27AE60" />
                <text x="400" y="148" textAnchor="middle" fontSize="10" fill="#27AE60" fontWeight="700">
                    Net Zero
                </text>
            </svg>

            {tooltip && (
                <div
                    className="dc-roadmap-tooltip"
                    style={{ left: `${(tooltip.x / 460) * 100}%`, top: `${(tooltipY / 190) * 100}%` }}
                >
                    <div className="dc-roadmap-tooltip-year">{tooltip.year}</div>
                    <div className="dc-roadmap-tooltip-row">
                        <span className="dc-roadmap-tooltip-dot" style={{ background: SERIES.actual.color }} />
                        Planned: <strong>{tooltip.actual.toLocaleString()}</strong> tCO₂e
                    </div>
                    {!hideBau && (
                        <div className="dc-roadmap-tooltip-row">
                            <span className="dc-roadmap-tooltip-dot" style={{ background: SERIES.bau.color }} />
                            BAU: <strong>{tooltip.bau.toLocaleString()}</strong> tCO₂e
                        </div>
                    )}
                </div>
            )}

            <div className="dc-legend dc-legend--interactive">
                <div className="dc-legend-item">
                    <div className="dc-legend-dot" style={{ background: SERIES.actual.color }} />
                    Actual/Planned
                </div>
                <button
                    type="button"
                    className={`dc-legend-item dc-legend-btn ${hideBau ? 'dc-legend-item--off' : ''}`}
                    onClick={toggleBau}
                >
                    <div className="dc-legend-dot" style={{ background: SERIES.bau.color }} />
                    BAU Scenario
                </button>
                <div className="dc-legend-item">
                    <div className="dc-legend-dot" style={{ background: '#27AE60' }} />
                    Net Zero Target
                </div>
            </div>
        </div>
    );
}

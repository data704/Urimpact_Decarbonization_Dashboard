import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Filler,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line, Doughnut, Bar } from 'react-chartjs-2';
import roiIcons from './roiIcons';
import {
  industries,
  forecastData,
  cashflowData,
  pathwayData,
  monteCarloDistribution,
  financialKPIs,
  sensitivityMatrix,
  roadmapMilestones,
  carbonPricingExposure,
} from './roiDummyData';
import './ROI.css';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Filler, Title, Tooltip, Legend);

const TABS = [
  { id: 'overview', label: 'ROI Dashboard', icon: 'dashboard' },
  { id: 'baseline', label: 'Baseline Analysis', icon: 'baseline' },
  { id: 'hotspot', label: 'Hotspot Detection', icon: 'hotspot' },
  { id: 'interventions', label: 'Interventions Library', icon: 'interventions' },
  { id: 'scenario', label: 'Scenario Builder', icon: 'scenario' },
  { id: 'financial', label: 'Financial Analysis', icon: 'financial' },
  { id: 'pathway', label: 'Pathways', icon: 'pathway' },
  { id: 'risk', label: 'Risk & Monte Carlo', icon: 'risk' },
];

const INDUSTRY_KEYS = Object.keys(industries);

const FUNNEL_STAGES = [
  { icon: 'ruler', label: 'Baseline' },
  { icon: 'fire', label: 'Hotspots' },
  { icon: 'bulb', label: 'Interventions' },
  { icon: 'settings', label: 'Scenarios' },
  { icon: 'trendUp', label: 'ROI' },
  { icon: 'mapPin', label: 'Roadmap' },
];

const BASELINE_TABS = ['Organization', 'Facilities', 'Energy', 'Water', 'Waste', 'Transportation', 'Procurement', 'Financials'];

/* ─── Shared chart options ─── */
const lineChartBase = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: {
    y: { grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { callback: (v) => (v / 1000) + 'K' } },
    x: { grid: { display: false } },
  },
};

/* ══════════════════════════════════════════════
   Component
═══════════════════════════════════════════════ */
export default function ROIModule() {
  const [activeTab, setActiveTab] = useState('overview');
  const [industry, setIndustry] = useState('fnb');
  const [funnelIdx, setFunnelIdx] = useState(0);
  const [baselineTab, setBaselineTab] = useState(0);

  /* Scenario sliders */
  const [sliders, setSliders] = useState({ inflation: 5, elec: 8, fuel: 6, carbon: 200, tech: 1 });

  const data = industries[industry];

  const handleSlider = useCallback((key, val) => {
    setSliders((prev) => ({ ...prev, [key]: Number(val) }));
  }, []);

  /* ── Scenario calculations ── */
  const scenarioValues = useMemo(() => {
    const { elec, carbon, fuel } = sliders;
    const e = elec / 100, c = carbon / 200, f = fuel / 100;
    const bauM = 1 + e * 0.5 + f * 0.3;
    const consM = 1 - 0.25 - c * 0.1;
    const modM = 1 - 0.42 - c * 0.15 - e * 0.1;
    const aggrM = 1 - 0.72 - c * 0.2 - e * 0.15 - f * 0.1;
    const base = [250, 265, 282, 300, 318, 250];
    const mul = (arr, m) => arr.map((v) => Math.round(Math.max(v * m * 1000, 500)));
    return {
      bau: mul(base, bauM),
      cons: mul([250, 230, 210, 190, 168, 250].map((v) => v * consM / bauM), bauM),
      mod: mul([250, 220, 190, 155, 110, 250].map((v) => v * modM / bauM), bauM),
      aggr: mul([250, 200, 158, 110, 60, 250].map((v) => v * aggrM / bauM), bauM),
    };
  }, [sliders]);

  /* ═══════════ RENDER ═══════════ */
  return (
    <div className="roi-page">
      {/* Page Header */}
      <div className="roi-page-header">
        <div className="roi-page-icon">{roiIcons.trendUp}</div>
        <div>
          <div className="roi-page-title">ROI &amp; Scenario Analysis</div>
          <div className="roi-page-subtitle">Executive financial overview &middot; Jan&ndash;Dec 2026 &middot; URIMPACT</div>
        </div>
      </div>

      {/* Module Tabs */}
      <div className="roi-module-tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`roi-module-tab${activeTab === t.id ? ' active' : ''}`}
            onClick={() => setActiveTab(t.id)}
          >
            {roiIcons[t.icon]}
            {t.label}
          </button>
        ))}
      </div>

      {/* ── TAB: ROI DASHBOARD ── */}
      {activeTab === 'overview' && (
        <OverviewTab
          data={data}
          industry={industry}
          setIndustry={setIndustry}
          funnelIdx={funnelIdx}
          setFunnelIdx={setFunnelIdx}
        />
      )}

      {/* ── TAB: BASELINE ANALYSIS ── */}
      {activeTab === 'baseline' && (
        <BaselineTab baselineTab={baselineTab} setBaselineTab={setBaselineTab} />
      )}

      {/* ── TAB: HOTSPOT DETECTION ── */}
      {activeTab === 'hotspot' && <HotspotTab data={data} />}

      {/* ── TAB: INTERVENTIONS LIBRARY ── */}
      {activeTab === 'interventions' && <InterventionsTab data={data} />}

      {/* ── TAB: SCENARIO BUILDER ── */}
      {activeTab === 'scenario' && (
        <ScenarioTab sliders={sliders} onSlider={handleSlider} scenarioValues={scenarioValues} />
      )}

      {/* ── TAB: FINANCIAL ANALYSIS ── */}
      {activeTab === 'financial' && <FinancialTab />}

      {/* ── TAB: PATHWAYS ── */}
      {activeTab === 'pathway' && <PathwayTab />}

      {/* ── TAB: RISK & MONTE CARLO ── */}
      {activeTab === 'risk' && <RiskTab />}
    </div>
  );
}

/* ═══════════════════════════════════════════
   SUB-TAB COMPONENTS
═══════════════════════════════════════════ */

/* ── Overview ── */
function OverviewTab({ data, industry, setIndustry, funnelIdx, setFunnelIdx }) {
  return (
    <>
      {/* Industry switcher */}
      <div className="roi-industry-bar">
        <span className="roi-industry-label">Demo Industry:</span>
        <div className="roi-industry-btns">
          {INDUSTRY_KEYS.map((k) => (
            <button key={k} className={`roi-ind-btn${industry === k ? ' active' : ''}`} onClick={() => setIndustry(k)}>
              {industries[k].label}
            </button>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div className="roi-kpi-grid">
        {data.kpis.map((kpi, i) => (
          <div key={i} className="roi-kpi-card" style={{ animationDelay: `${0.05 + i * 0.05}s` }}>
            <div className={`roi-kpi-icon ${kpi.cls}`}>{roiIcons[kpi.icon]}</div>
            <div className="roi-kpi-label">{kpi.label}</div>
            <div className="roi-kpi-value">{kpi.value}</div>
            <div className="roi-kpi-sub">{kpi.sub}</div>
            <div className={`roi-kpi-trend ${kpi.trendCls}`}>{kpi.trend}</div>
          </div>
        ))}
      </div>

      {/* Funnel + Treemap */}
      <div className="roi-grid-3">
        <div className="roi-card">
          <div className="roi-card-header">
            <div>
              <div className="roi-card-title">Sustainability Opportunity Funnel</div>
              <div className="roi-card-subtitle">Click any stage to explore</div>
            </div>
            <span className="roi-card-badge">6 Stages</span>
          </div>
          <div className="roi-funnel">
            {FUNNEL_STAGES.map((s, i) => (
              <span key={i} style={{ display: 'contents' }}>
                <div
                  className={`roi-funnel-node${funnelIdx === i ? ' active' : ''}`}
                  onClick={() => setFunnelIdx(i)}
                >
                  <div className="roi-fn-icon">{roiIcons[s.icon]}</div>
                  <div className="roi-fn-label">{s.label}</div>
                </div>
                {i < FUNNEL_STAGES.length - 1 && <span className="roi-funnel-arrow">&rsaquo;</span>}
              </span>
            ))}
          </div>
        </div>

        <div className="roi-card">
          <div className="roi-card-header">
            <div className="roi-card-title">Emission Hotspots</div>
            <span className="roi-card-badge">Top 5</span>
          </div>
          <div className="roi-treemap">
            {data.treemap.map((cell, i) => (
              <div key={i} className={`roi-tm-cell roi-tm-${cell.bg}${i === 0 ? ' large' : ''}`}>
                <div className="roi-tm-label">{cell.label}</div>
                <div className="roi-tm-pct">{cell.pct}%</div>
                <div className="roi-tm-sub">{cell.cost}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Investment table + Forecast chart */}
      <div className="roi-grid-2">
        <div className="roi-card">
          <div className="roi-card-header">
            <div>
              <div className="roi-card-title">Best Investment Opportunities</div>
              <div className="roi-card-subtitle">Ranked by ROI Score</div>
            </div>
          </div>
          <table className="roi-data-table">
            <thead>
              <tr>
                <th>Intervention</th><th>CAPEX (SAR)</th><th>Savings/yr</th><th>Payback</th><th>ROI Score</th>
              </tr>
            </thead>
            <tbody>
              {data.interventions.map((r, i) => (
                <tr key={i}>
                  <td><strong>{r.name}</strong></td>
                  <td>{r.capex}</td>
                  <td>{r.savings}</td>
                  <td>{r.payback}</td>
                  <td>
                    <span className={`roi-score-badge ${r.score >= 80 ? 'roi-score-high' : 'roi-score-mid'}`}>
                      {r.score}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="roi-card">
          <div className="roi-card-header">
            <div className="roi-card-title">Emission Forecast 2026&ndash;2050</div>
            <span className="roi-card-badge">4 Scenarios</span>
          </div>
          <div className="roi-chart-container">
            <ForecastChart />
          </div>
          <div className="roi-chart-legend">
            <span className="roi-legend-item"><span className="roi-legend-dot" style={{ background: '#E95C5C' }} />BAU</span>
            <span className="roi-legend-item"><span className="roi-legend-dot" style={{ background: '#F5B942' }} />Conservative</span>
            <span className="roi-legend-item"><span className="roi-legend-dot" style={{ background: '#1CA39A' }} />Moderate</span>
            <span className="roi-legend-item"><span className="roi-legend-dot" style={{ background: '#4CAF50' }} />Aggressive</span>
          </div>
        </div>
      </div>
    </>
  );
}

/* ── Baseline ── */
function BaselineTab({ baselineTab, setBaselineTab }) {
  return (
    <>
      <div className="roi-baseline-tabs">
        {BASELINE_TABS.map((t, i) => (
          <button key={t} className={`roi-baseline-tab${baselineTab === i ? ' active' : ''}`} onClick={() => setBaselineTab(i)}>
            {t}
          </button>
        ))}
      </div>
      <div className="roi-grid-2">
        <div className="roi-card">
          <div className="roi-card-header">
            <div className="roi-card-title">Scope Breakdown</div>
            <span className="roi-card-badge">tCO&#x2082;e</span>
          </div>
          <div className="roi-chart-container sm">
            <ScopeChart />
          </div>
          <div className="roi-chart-legend">
            <span className="roi-legend-item"><span className="roi-legend-sq" style={{ background: '#1CA39A' }} />Scope 1</span>
            <span className="roi-legend-item"><span className="roi-legend-sq" style={{ background: '#2196F3' }} />Scope 2</span>
            <span className="roi-legend-item"><span className="roi-legend-sq" style={{ background: '#9C27B0' }} />Scope 3</span>
          </div>
        </div>
        <div className="roi-card">
          <div className="roi-card-header"><div className="roi-card-title">Intensity Metrics</div></div>
          <div className="roi-intensity-grid">
            <div className="roi-intensity-card teal">
              <div className="roi-intensity-label">Emission Intensity</div>
              <div className="roi-intensity-value">2.48</div>
              <div className="roi-intensity-unit">tCO&#x2082;e / Production Unit</div>
            </div>
            <div className="roi-intensity-card blue">
              <div className="roi-intensity-label">Energy Intensity</div>
              <div className="roi-intensity-value">180</div>
              <div className="roi-intensity-unit">kWh / Product Unit</div>
            </div>
            <div className="roi-intensity-card green">
              <div className="roi-intensity-label">Carbon Cost Intensity</div>
              <div className="roi-intensity-value">SAR 12.4</div>
              <div className="roi-intensity-unit">per tCO&#x2082;e</div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/* ── Hotspot ── */
function HotspotTab({ data }) {
  return (
    <>
      <div className="roi-hotspot-banner">
        <div className="roi-hotspot-banner-icon">{roiIcons.search}</div>
        <div>
          <div className="roi-hotspot-banner-title">AI-Powered Hotspot Detection</div>
          <div className="roi-hotspot-banner-sub">Top 5 emission sources identified across your facility portfolio</div>
        </div>
      </div>
      <div className="roi-hotspot-grid">
        {data.hotspots.map((h, i) => (
          <div key={i} className="roi-hs-card">
            <div className="roi-hs-pct">{h.pct}%</div>
            <div className="roi-hs-name">{h.name}</div>
            <div className="roi-hs-cost">{h.cost} &middot; {h.tco2e}</div>
            <div className="roi-hs-bar"><div className="roi-hs-bar-fill" style={{ width: `${h.pct}%` }} /></div>
            <div className="roi-hs-potential">&darr; Potential: {h.potential}</div>
          </div>
        ))}
      </div>
      <div className="roi-ai-box">
        <div className="roi-ai-icon">{roiIcons.robot}</div>
        <div>
          <div className="roi-ai-title">AI Insight</div>
          <div className="roi-ai-text">
            {data.hotspots[0]?.name} contributes {data.hotspots[0]?.pct}% of facility emissions &mdash; the single largest opportunity.
            Combined interventions targeting the top 3 hotspots deliver a payback of under 5 years with an ROI Score of 87+.
          </div>
        </div>
      </div>
    </>
  );
}

/* ── Interventions ── */
function InterventionsTab({ data }) {
  return (
    <>
      <div className="roi-filter-bar">
        <select className="roi-filter-select"><option>All Industries</option></select>
        <select className="roi-filter-select"><option>All Facility Types</option></select>
        <select className="roi-filter-select"><option>All Emission Sources</option></select>
        <select className="roi-filter-select"><option>Payback &lt;5 yrs</option><option>Payback 5&ndash;10 yrs</option><option>Any Payback</option></select>
        <select className="roi-filter-select"><option>CAPEX &lt;SAR 5M</option><option>SAR 5&ndash;15M</option><option>Any CAPEX</option></select>
      </div>
      <div className="roi-int-grid">
        {data.interventionCards.map((card, i) => (
          <div key={i} className="roi-int-card">
            <div className="roi-int-tag">{card.tag}</div>
            <div className="roi-int-name">{card.name}</div>
            {Object.entries(card.metrics).map(([k, v]) => (
              <div key={k} className="roi-int-metric">
                <span className="roi-int-metric-label">{k}</span>
                <span className="roi-int-metric-val">{v}</span>
              </div>
            ))}
            <div className="roi-int-score">
              <span className="roi-int-score-label">ROI Score</span>
              <div className="roi-int-score-bar"><div className="roi-int-score-fill" style={{ width: `${card.score}%` }} /></div>
              <span className="roi-int-score-num">{card.score}</span>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

/* ── Scenario Builder ── */
function ScenarioTab({ sliders, onSlider, scenarioValues }) {
  const labels = ['2026', '2030', '2035', '2040', '2045', '2050'];

  const chartData = useMemo(() => ({
    labels,
    datasets: [
      { label: 'BAU', data: scenarioValues.bau, borderColor: '#E95C5C', borderWidth: 2, tension: 0.4, pointRadius: 3, fill: false },
      { label: 'Conservative', data: scenarioValues.cons, borderColor: '#F5B942', borderWidth: 2, tension: 0.4, pointRadius: 3, borderDash: [5, 3] },
      { label: 'Moderate', data: scenarioValues.mod, borderColor: '#1CA39A', borderWidth: 2.5, tension: 0.4, pointRadius: 3 },
      { label: 'Aggressive', data: scenarioValues.aggr, borderColor: '#4CAF50', borderWidth: 2.5, tension: 0.4, pointRadius: 3 },
    ],
  }), [scenarioValues]);

  return (
    <>
      <div className="roi-scenario-cards">
        <div className="roi-sc-card bau active">
          <div className="roi-sc-label" style={{ color: '#E95C5C' }}>Business As Usual</div>
          <div className="roi-sc-value" style={{ color: '#E95C5C' }}>{scenarioValues.bau[5]?.toLocaleString()}</div>
          <div className="roi-sc-sub" style={{ color: '#E95C5C' }}>tCO&#x2082;e by 2050</div>
        </div>
        <div className="roi-sc-card cons">
          <div className="roi-sc-label" style={{ color: '#e6a817' }}>Conservative</div>
          <div className="roi-sc-value" style={{ color: '#e6a817' }}>{scenarioValues.cons[5]?.toLocaleString()}</div>
          <div className="roi-sc-sub" style={{ color: '#e6a817' }}>tCO&#x2082;e by 2050</div>
        </div>
        <div className="roi-sc-card mod">
          <div className="roi-sc-label" style={{ color: '#1CA39A' }}>Moderate</div>
          <div className="roi-sc-value" style={{ color: '#1CA39A' }}>{scenarioValues.mod[5]?.toLocaleString()}</div>
          <div className="roi-sc-sub" style={{ color: '#1CA39A' }}>tCO&#x2082;e by 2050</div>
        </div>
        <div className="roi-sc-card aggr">
          <div className="roi-sc-label" style={{ color: '#4CAF50' }}>Aggressive</div>
          <div className="roi-sc-value" style={{ color: '#4CAF50' }}>{scenarioValues.aggr[5]?.toLocaleString()}</div>
          <div className="roi-sc-sub" style={{ color: '#4CAF50' }}>tCO&#x2082;e by 2050</div>
        </div>
      </div>

      <div className="roi-grid-2">
        <div className="roi-card">
          <div className="roi-card-header">
            <div className="roi-card-title">Scenario Inputs</div>
            <span className="roi-card-badge">Live Update</span>
          </div>
          <SliderRow label="Inflation Rate" value={sliders.inflation} min={0} max={15} step={1} unit="%" onChange={(v) => onSlider('inflation', v)} />
          <SliderRow label="Electricity Escalation" value={sliders.elec} min={0} max={20} step={1} unit="%" onChange={(v) => onSlider('elec', v)} />
          <SliderRow label="Fuel Escalation" value={sliders.fuel} min={0} max={20} step={1} unit="%" onChange={(v) => onSlider('fuel', v)} />
          <SliderRow label="Carbon Price (SAR/tCO&#x2082;e)" value={sliders.carbon} min={0} max={1000} step={10} unit="" onChange={(v) => onSlider('carbon', v)} />
          <SliderRow label="Technology Degradation" value={sliders.tech} min={0} max={5} step={0.1} unit="%" onChange={(v) => onSlider('tech', v)} />
        </div>
        <div className="roi-card">
          <div className="roi-card-header"><div className="roi-card-title">Projected Forecast</div></div>
          <div className="roi-chart-container lg">
            <Line data={chartData} options={lineChartBase} />
          </div>
        </div>
      </div>
    </>
  );
}

/* ── Financial Analysis ── */
function FinancialTab() {
  return (
    <>
      <div className="roi-financial-kpis">
        {financialKPIs.map((kpi, i) => (
          <div key={i} className="roi-kpi-card">
            <div className="roi-kpi-label">{kpi.label}</div>
            <div className="roi-kpi-value">{kpi.value}</div>
            {kpi.sub && <div className="roi-kpi-sub">{kpi.sub}</div>}
            {kpi.trend && <div className={`roi-kpi-trend ${kpi.trendCls}`}>{kpi.trendCls === 'up' ? '\u25B2' : '\u2193'} {kpi.trend}</div>}
          </div>
        ))}
      </div>

      <div className="roi-grid-2">
        <div className="roi-card">
          <div className="roi-card-header">
            <div className="roi-card-title">Cash Flow Waterfall</div>
            <span className="roi-card-badge">25 Year</span>
          </div>
          <div className="roi-chart-container">
            <CashflowChart />
          </div>
        </div>
        <div className="roi-card">
          <div className="roi-card-header">
            <div className="roi-card-title">Financial Sensitivity Matrix</div>
            <span className="roi-card-badge">NPV Impact</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <div className="roi-matrix-grid">
              <div />
              {sensitivityMatrix.headers.map((h) => <div key={h} className="roi-mx-header">{h}</div>)}
              {sensitivityMatrix.rows.map((row) => (
                <span key={row.label} style={{ display: 'contents' }}>
                  <div className="roi-mx-row-label">{row.label}</div>
                  {row.values.map((v, j) => (
                    <div key={j} className={`roi-mx-cell roi-mx-${row.levels[j]}`}>{v}</div>
                  ))}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/* ── Pathways ── */
function PathwayTab() {
  return (
    <>
      <div className="roi-card" style={{ marginBottom: 20 }}>
        <div className="roi-card-header">
          <div className="roi-card-title">Decarbonization Roadmap 2026&ndash;2050</div>
          <span className="roi-card-badge">Net Zero Target</span>
        </div>
        <div className="roi-timeline">
          {roadmapMilestones.map((m, i) => (
            <div key={i} className="roi-tl-item">
              <div className="roi-tl-dot-row">
                <div className={`roi-tl-dot${m.isTarget ? ' target' : ''}`} />
                {i < roadmapMilestones.length - 1 && <div className="roi-tl-line" />}
              </div>
              <div className={`roi-tl-year${m.isTarget ? ' target' : ''}`}>{m.year}</div>
              <div className="roi-tl-events">
                {m.events.map((ev, j) => (
                  <div key={j} className={`roi-tl-event${m.isTarget ? ' target-event' : ''}`}>{ev}</div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="roi-grid-3">
        <div className="roi-card">
          <div className="roi-card-header"><div className="roi-card-title">Cumulative Reduction</div></div>
          <div className="roi-chart-container sm">
            <PathwayChart />
          </div>
        </div>
        <div className="roi-card">
          <div className="roi-card-header"><div className="roi-card-title">Carbon Pricing Exposure</div></div>
          <div className="roi-exposure-grid">
            {carbonPricingExposure.map((item, i) => (
              <div key={i} className={`roi-exposure-item ${item.bg}`}>
                <span className="roi-exposure-label">{item.label}</span>
                <span className="roi-exposure-value">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

/* ── Risk & Monte Carlo ── */
function RiskTab() {
  return (
    <div className="roi-grid-2">
      <div className="roi-card">
        <div className="roi-card-header">
          <div className="roi-card-title">Monte Carlo Simulation</div>
          <span className="roi-card-badge">10,000 Runs</span>
        </div>
        <div className="roi-mc-inputs">
          <MCInput cls="teal" label="Fuel Price Volatility" min={0} max={50} def={20} prefix="\u00B1" suffix="%" />
          <MCInput cls="blue" label="Carbon Price Volatility" min={0} max={100} def={35} prefix="\u00B1" suffix="%" />
          <MCInput cls="green" label="Production Growth" min={0} max={20} def={8} prefix="+" suffix="%" />
          <MCInput cls="amber" label="Tech Efficiency" min={0} max={30} def={15} prefix="+" suffix="%" />
        </div>
        <div className="roi-chart-container sm">
          <MonteCarloChart />
        </div>
      </div>

      <div className="roi-card">
        <div className="roi-card-header"><div className="roi-card-title">Confidence Intervals &amp; Risk-Adjusted ROI</div></div>
        <div className="roi-gauge-row" style={{ marginBottom: 16 }}>
          <div className="roi-gauge-card" style={{ background: '#EAF7F5' }}>
            <div className="roi-gauge-num" style={{ color: '#1CA39A' }}>SAR 142M</div>
            <div className="roi-gauge-label">P10 &mdash; Pessimistic</div>
          </div>
          <div className="roi-gauge-card" style={{ background: '#e8f5e9' }}>
            <div className="roi-gauge-num" style={{ color: '#4CAF50' }}>SAR 188M</div>
            <div className="roi-gauge-label">P50 &mdash; Base Case</div>
          </div>
          <div className="roi-gauge-card" style={{ background: '#e3f2fd' }}>
            <div className="roi-gauge-num" style={{ color: '#1565c0' }}>SAR 241M</div>
            <div className="roi-gauge-label">P90 &mdash; Optimistic</div>
          </div>
        </div>
        <div className="roi-chart-container sm">
          <RiskGaugeChart />
        </div>
        <div className="roi-risk-npv-box">
          <div className="roi-risk-npv-label">Risk-Adjusted NPV</div>
          <div className="roi-risk-npv-value">SAR 182M</div>
          <div className="roi-risk-npv-prob">92% probability of positive returns</div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   CHART COMPONENTS
═══════════════════════════════════════════ */
function ForecastChart() {
  const data = useMemo(() => ({
    labels: forecastData.labels,
    datasets: [
      { label: 'BAU', data: forecastData.bau, borderColor: '#E95C5C', backgroundColor: 'rgba(233,92,92,0.08)', borderWidth: 2, tension: 0.4, pointRadius: 3, fill: true },
      { label: 'Conservative', data: forecastData.conservative, borderColor: '#F5B942', backgroundColor: 'rgba(245,185,66,0.08)', borderWidth: 2, tension: 0.4, pointRadius: 3, borderDash: [5, 3] },
      { label: 'Moderate', data: forecastData.moderate, borderColor: '#1CA39A', backgroundColor: 'rgba(28,163,154,0.08)', borderWidth: 2.5, tension: 0.4, pointRadius: 3, borderDash: [6, 3] },
      { label: 'Aggressive', data: forecastData.aggressive, borderColor: '#4CAF50', backgroundColor: 'rgba(76,175,80,0.08)', borderWidth: 2.5, tension: 0.4, pointRadius: 3, fill: true },
    ],
  }), []);
  const options = useMemo(() => ({
    ...lineChartBase,
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: (c) => c.dataset.label + ': ' + c.raw.toLocaleString() + ' tCO\u2082e' } },
    },
  }), []);
  return <Line data={data} options={options} />;
}

function ScopeChart() {
  const data = useMemo(() => ({
    labels: ['Scope 1', 'Scope 2', 'Scope 3'],
    datasets: [{ data: [2345, 3210, 6901], backgroundColor: ['#1CA39A', '#2196F3', '#9C27B0'], borderWidth: 0, hoverOffset: 8 }],
  }), []);
  const options = useMemo(() => ({
    responsive: true, maintainAspectRatio: false, cutout: '65%',
    plugins: { legend: { display: false } },
  }), []);
  return <Doughnut data={data} options={options} />;
}

function CashflowChart() {
  const data = useMemo(() => ({
    labels: cashflowData.labels,
    datasets: [
      { label: 'CAPEX', data: cashflowData.capex, backgroundColor: 'rgba(233,92,92,0.7)' },
      { label: 'OPEX', data: cashflowData.opex, backgroundColor: 'rgba(245,185,66,0.7)' },
      { label: 'Energy Savings', data: cashflowData.energySavings, backgroundColor: 'rgba(28,163,154,0.7)' },
      { label: 'Carbon Benefits', data: cashflowData.carbonBenefits, backgroundColor: 'rgba(76,175,80,0.7)' },
    ],
  }), []);
  const options = useMemo(() => ({
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: true, position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } } },
    scales: {
      x: { stacked: true, grid: { display: false } },
      y: { stacked: true, grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { callback: (v) => 'SAR ' + v + 'M' } },
    },
  }), []);
  return <Bar data={data} options={options} />;
}

function PathwayChart() {
  const data = useMemo(() => ({
    labels: pathwayData.labels,
    datasets: [
      { label: 'Emission Level', data: pathwayData.emissionLevel, borderColor: '#1CA39A', backgroundColor: 'rgba(28,163,154,0.15)', fill: true, tension: 0.4, borderWidth: 3, pointRadius: 4 },
      { label: 'Net Zero Target', data: pathwayData.netZeroTarget, borderColor: '#4CAF50', borderWidth: 1.5, borderDash: [6, 4], pointRadius: 0, fill: false },
    ],
  }), []);
  return <Line data={data} options={lineChartBase} />;
}

function MonteCarloChart() {
  const labels = useMemo(() => monteCarloDistribution.map((_, i) => 'SAR ' + (100 + i * 6) + 'M'), []);
  const data = useMemo(() => ({
    labels,
    datasets: [{
      label: 'Frequency',
      data: monteCarloDistribution,
      backgroundColor: monteCarloDistribution.map((_, i) =>
        i < 5 ? 'rgba(233,92,92,0.6)' : i > 18 ? 'rgba(76,175,80,0.6)' : 'rgba(28,163,154,0.6)'
      ),
      borderRadius: 2,
    }],
  }), [labels]);
  const options = useMemo(() => ({
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { ticks: { maxRotation: 45, autoSkip: true, maxTicksLimit: 7 }, grid: { display: false } },
      y: { grid: { color: 'rgba(0,0,0,0.05)' } },
    },
  }), []);
  return <Bar data={data} options={options} />;
}

function RiskGaugeChart() {
  const data = useMemo(() => ({
    labels: ['P10 Pessimistic', 'P50 Base', 'P90 Optimistic'],
    datasets: [{
      data: [142, 46, 53],
      backgroundColor: ['rgba(28,163,154,0.8)', 'rgba(76,175,80,0.8)', 'rgba(33,150,243,0.8)'],
      borderWidth: 0, circumference: 180, rotation: -90,
    }],
  }), []);
  const options = useMemo(() => ({
    responsive: true, maintainAspectRatio: false, cutout: '65%',
    plugins: { legend: { display: false } },
  }), []);
  return <Doughnut data={data} options={options} />;
}

/* ═══════════════════════════════════════════
   HELPER COMPONENTS
═══════════════════════════════════════════ */
function SliderRow({ label, value, min, max, step, unit, onChange }) {
  return (
    <div className="roi-slider-row">
      <div className="roi-slider-label" dangerouslySetInnerHTML={{ __html: label }} />
      <input
        className="roi-slider-input"
        type="range"
        min={min} max={max} step={step}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <div className="roi-slider-val">
        {step < 1 ? Number(value).toFixed(1) : value}{unit}
      </div>
    </div>
  );
}

function MCInput({ cls, label, min, max, def, prefix, suffix }) {
  const [val, setVal] = useState(def);
  return (
    <div className={`roi-mc-input-card ${cls}`}>
      <div className="roi-mc-input-label">{label}</div>
      <input className="roi-mc-input-range" type="range" min={min} max={max} value={val} step={1} onChange={(e) => setVal(Number(e.target.value))} />
      <div className="roi-mc-input-val">{prefix}{val}{suffix}</div>
    </div>
  );
}

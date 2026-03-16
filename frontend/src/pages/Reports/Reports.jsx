import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    ArcElement,
    Title,
    Tooltip,
    Legend,
    Filler,
} from 'chart.js';
import { Line, Bar, Pie } from 'react-chartjs-2';
import { useDataStore } from '../../context/DataStoreContext';
import { getAuthToken, getDashboard, getReportNarratives } from '../../api/client';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import './Reports.css';

ChartJS.register(
    CategoryScale, LinearScale, PointElement, LineElement,
    BarElement, ArcElement, Title, Tooltip, Legend, Filler
);

const EMPLOYEES = 164;
const DECARB_CONFIG_KEY = 'urimpact_decarbonization_config';
const ENGINE_VERSION = '2.0';
const POLICY_VERSION = '2.0';
// Narrative cache: stored in localStorage so narratives survive page navigation
const NARRATIVE_CACHE_KEY = 'urimpact_narrative_cache';

// ─── Tier Policy (versioned, matches backend AMBITION_TIERS) ─────────────────
const AMBITION_TIERS = {
    MODERATE_50: { R_total: 0.50, StructuralResidual: 0.15, label: 'Moderate (50%)' },
    HIGH_75:     { R_total: 0.75, StructuralResidual: 0.08, label: 'High (75%)' },
    NEARZERO_90: { R_total: 0.90, StructuralResidual: 0.05, label: 'Near-Zero (90%)' },
};

// ─── Deterministic Calculation Engine ────────────────────────────────────────
// Single source of truth: every number in the report comes from this object.
function computeReportOutputs({ config, totalTonnes, scope1Tonnes, scope2Tonnes, breakdownRaw, baseYear }) {
    const SEQUESTRATION_RATE_DEFAULT = 0.025;
    const BAU_GROWTH_RATE_DEFAULT = 0.0;

    const tierKey = config?.ambition_level;
    const tier = AMBITION_TIERS[tierKey] ?? AMBITION_TIERS['NEARZERO_90'];
    const include_bau = true;
    const include_trees = true;
    const targetYear = config?.target_year ?? (baseYear + 5);
    const orgName = config?.organization_name || 'Your Organization';
    const bauGrowthRate = BAU_GROWTH_RATE_DEFAULT;
    const seqRate = SEQUESTRATION_RATE_DEFAULT;

    const baseline_total = Math.round(totalTonnes);
    const scope1_total = Math.round(scope1Tonnes);
    const scope2_total = Math.round(scope2Tonnes);
    const n = Math.max(1, targetYear - baseYear);

    const R_total = tier.R_total;
    const StructuralResidualPct = tier.StructuralResidual;

    // ── PATHWAY ──────────────────────────────────────────────────────────────
    // E_target = E × (1 − R_total)
    const target_emissions = Math.round(baseline_total * (1 - R_total));

    // Keep full precision internally (spec §2.2: "internal calculations: keep full precision")
    const annual_reduction_raw = (baseline_total - target_emissions) / n;
    // Display-rounded version for tables/text (2 dp per spec §2.2)
    const annual_reduction_tco2e = parseFloat(annual_reduction_raw.toFixed(2));
    // % of baseline — compute from raw value to avoid accumulated truncation
    const annual_reduction_pct_of_baseline = parseFloat(((annual_reduction_raw / Math.max(1, baseline_total)) * 100).toFixed(1));

    // ── RESIDUAL ─────────────────────────────────────────────────────────────
    // E_residual_ceiling = E × StructuralResidual%
    const residual_ceiling_tco2e = Math.round(baseline_total * StructuralResidualPct);
    // Removal obligation = E_residual_ceiling (one-to-one neutralisation principle)
    const removal_requirement_tco2e_per_year = residual_ceiling_tco2e;
    // Structural reduction (eliminated segment for charts): baseline − target
    const eliminated_tco2e = baseline_total - target_emissions;

    // ── INTERVENTION SERIES (use raw LAR to avoid cumulative rounding drift) ─
    const intervention_years = [];
    const intervention_emissions = [];
    for (let i = 0; i <= n; i++) {
        intervention_years.push(baseYear + i);
        // Use raw precision for series; final point should equal E_target exactly
        const raw = baseline_total - annual_reduction_raw * i;
        intervention_emissions.push(Math.max(0, Math.round(raw)));
    }

    // ── BAU SERIES (optional) ─────────────────────────────────────────────────
    const bau = include_bau
        ? {
              enabled: true,
              growth_rate: bauGrowthRate,
              bau_target_year_emissions: Math.round(baseline_total * Math.pow(1 + bauGrowthRate, n)),
              series_years: intervention_years,
              series_emissions: intervention_years.map((_, i) =>
                  Math.round(baseline_total * Math.pow(1 + bauGrowthRate, i))
              ),
          }
        : { enabled: false };

    // ── TREES (optional) ──────────────────────────────────────────────────────
    const trees_per_year_raw = removal_requirement_tco2e_per_year / seqRate;
    const trees = include_trees
        ? {
              enabled: true,
              sequestration_rate: seqRate,
              trees_per_year: Math.round(trees_per_year_raw),
              trees_cumulative: Math.round(trees_per_year_raw * n),
          }
        : { enabled: false };

    // ── REMOVAL SERIES (year-by-year, for S7 chart per spec §2.3) ─────────────
    const removals_series = include_trees
        ? {
              years: intervention_years,
              annual: intervention_years.map(() => removal_requirement_tco2e_per_year),
              cumulative: intervention_years.map((_, i) => Math.round(removal_requirement_tco2e_per_year * (i + 1))),
          }
        : null;

    // ── ASSUMPTIONS ARRAY (spec §2.3) ─────────────────────────────────────────
    const assumptions = [
        { assumption_id: 'boundary', label: 'Emissions boundary', value: 'Operational emissions included in this model only', unit: null, source: 'GHG Protocol', notes: 'Other emission sources and categories may be excluded by design' },
        { assumption_id: 'pathway_linearity', label: 'Pathway shape', value: 'Linear', unit: null, source: 'Model design', notes: 'Planning simplification; not a performance guarantee' },
        { assumption_id: 'tier_r_total', label: `R_total (${tierKey})`, value: R_total, unit: '%', source: `Policy v${POLICY_VERSION}`, notes: 'Policy-defined, not empirically measured' },
        { assumption_id: 'tier_residual', label: `StructuralResidual% (${tierKey})`, value: StructuralResidualPct, unit: '%', source: `Policy v${POLICY_VERSION}`, notes: 'Hardcoded to tier; policy-defined' },
        { assumption_id: 'removal_principle', label: 'Removal obligation', value: 'Equal to residual ceiling', unit: 'tCO2e/yr', source: 'One-to-one neutralisation', notes: 'Removals address residual only; do not substitute reductions' },
        ...(include_bau ? [{ assumption_id: 'bau_growth', label: 'BAU growth rate', value: bauGrowthRate, unit: '%', source: 'Default (0%)', notes: 'Comparator only; does not affect pathway or residual math' }] : []),
        ...(include_trees ? [{ assumption_id: 'seq_rate', label: 'Sequestration rate', value: seqRate, unit: 'tCO2e/tree/yr', source: 'Default', notes: 'Illustrative; actual capacity requires third-party verification' }] : []),
        { assumption_id: 'no_financial', label: 'Financial modelling', value: 'Excluded', unit: null, source: 'Governance doc', notes: 'No financial projections or third-party verification included' },
    ];

    // ── BREAKDOWN ─────────────────────────────────────────────────────────────
    let breakdown = [];
    if (breakdownRaw && breakdownRaw.length > 0) {
        breakdown = breakdownRaw.map((c) => {
            const raw = c.totalTonnes ?? c.total / 1000;
            const tco2e = Math.round(Number(raw) || 0);
            return {
                name: c.category.replace(/_/g, ' '),
                scope: c.category === 'ELECTRICITY' ? 'Scope 2' : 'Scope 1',
                tco2e,
                pct_of_total: parseFloat(((tco2e / Math.max(1, baseline_total)) * 100).toFixed(1)),
            };
        }).filter((d) => d.tco2e > 0);
    }
    if (breakdown.length === 0) {
        // fallback from scope totals
            breakdown = [
            { name: 'Purchased Electricity', scope: 'Electricity', tco2e: scope2_total, pct_of_total: parseFloat(((scope2_total / Math.max(1, baseline_total)) * 100).toFixed(1)) },
            { name: 'Mobile Combustion',     scope: 'Fuel (mobile)', tco2e: Math.round(scope1_total * 0.6), pct_of_total: parseFloat(((Math.round(scope1_total * 0.6) / Math.max(1, baseline_total)) * 100).toFixed(1)) },
            { name: 'Stationary Combustion', scope: 'Fuel (stationary)', tco2e: Math.round(scope1_total * 0.4), pct_of_total: parseFloat(((Math.round(scope1_total * 0.4) / Math.max(1, baseline_total)) * 100).toFixed(1)) },
        ].filter((d) => d.tco2e > 0);
    }

    // QA checks
    const qa_checks = {
        baseline_positive: baseline_total > 0,
        base_before_target: baseYear < targetYear,
        scope_sum_matches: Math.abs((scope1_total + scope2_total) - baseline_total) <= 1,
        residual_below_target: StructuralResidualPct < (1 - R_total),
    };

    // Run manifest
    const manifest = {
        engine_version: ENGINE_VERSION,
        policy_version: POLICY_VERSION,
        generated_at: new Date().toISOString(),
        input_hash: btoa(`${tierKey}|${baseYear}|${targetYear}|${baseline_total}`).slice(0, 16),
    };

    return {
        org: { name: orgName },
        period: { base_year: baseYear, target_year: targetYear },
        tier: { key: tierKey, label: tier.label, R_total, StructuralResidual: StructuralResidualPct },
        totals: { baseline_total, scope1_total, scope2_total },
        breakdown,
        pathway: { r_total: R_total, r_total_pct: parseFloat((R_total * 100).toFixed(1)), years_to_target: n, target_emissions, annual_reduction_tco2e, annual_reduction_pct_of_baseline },
        residual: { structural_residual_pct: StructuralResidualPct, structural_residual_pct_display: parseFloat((StructuralResidualPct * 100).toFixed(1)), residual_ceiling_tco2e, removal_requirement_tco2e_per_year, eliminated_tco2e },
        series: { intervention: { years: intervention_years, emissions: intervention_emissions }, removals: removals_series },
        bau,
        trees,
        assumptions,
        qa_checks,
        manifest,
    };
}

// ─── Chart colour palette ─────────────────────────────────────────────────────
const CHART_COLORS = ['#14B8A6', '#1E293B', '#0F766E', '#475569', '#059669', '#334155', '#10B981', '#64748B'];

function Reports() {
    const decarbConfig = useMemo(() => {
        try {
            const s = localStorage.getItem(DECARB_CONFIG_KEY);
            if (!s) return null;
            const c = JSON.parse(s);
            if (!c.target_year || !c.ambition_level) return null;
            return c;
        } catch { return null; }
    }, []);

    const {
        getTotalEmissions, getTotalScope1, getTotalScope2,
        getReportingPeriodLabel, getMonthlyData,
    } = useDataStore();

    const [reportRange, setReportRange] = useState('annual');
    const [customDateRange, setCustomDateRange] = useState(null);
    const [customModalOpen, setCustomModalOpen] = useState(false);
    const [customStart, setCustomStart] = useState('');
    const [customEnd, setCustomEnd] = useState('');
    const [toast, setToast] = useState('');

    const hasToken = Boolean(getAuthToken());
    const [apiReport, setApiReport] = useState(null);
    const [apiLoading, setApiLoading] = useState(false);
    const [pdfGenerating, setPdfGenerating] = useState(false);

    // AI narratives state — initialise from cache immediately to avoid flash of empty text
    const [narratives, setNarratives] = useState(() => {
        try {
            const cached = localStorage.getItem(NARRATIVE_CACHE_KEY);
            if (cached) return JSON.parse(cached).data ?? {};
        } catch { /* ignore */ }
        return {};
    });
    const [narrativesLoading, setNarrativesLoading] = useState(false);

    const dateRange = useMemo(() => {
        if (customDateRange?.start && customDateRange?.end) {
            return { start: customDateRange.start, end: customDateRange.end };
        }
        const now = new Date();
        if (reportRange === 'monthly') {
            const start = new Date(now.getFullYear(), now.getMonth(), 1);
            const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
        }
        const start = new Date(now.getFullYear(), 0, 1);
        const end = new Date(now.getFullYear(), 11, 31);
        return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
    }, [reportRange, customDateRange]);

    useEffect(() => {
        if (!hasToken) { setApiReport(null); return; }
        let cancelled = false;
        setApiLoading(true);
        getDashboard({ startDate: dateRange.start, endDate: dateRange.end })
            .then((d) => { if (!cancelled) setApiReport(d); })
            .catch(() => { if (!cancelled) setApiReport(null); })
            .finally(() => { if (!cancelled) setApiLoading(false); });
        return () => { cancelled = true; };
    }, [hasToken, dateRange.start, dateRange.end]);

    const totalTonnes = apiReport?.emissions?.total?.totalCo2eTonnes ?? getTotalEmissions();
    const scope1Tonnes = apiReport?.emissions?.byScope?.SCOPE_1?.totalTonnes ?? getTotalScope1();
    const scope2Tonnes = apiReport?.emissions?.byScope?.SCOPE_2?.totalTonnes ?? getTotalScope2();
    const baseYear = new Date(dateRange.start).getFullYear();

    // Compute canonical outputs object (single source of truth)
    const outputs = useMemo(() => {
        if (!decarbConfig || totalTonnes <= 0) return null;
        try {
            return computeReportOutputs({
                config: decarbConfig,
                totalTonnes,
                scope1Tonnes,
                scope2Tonnes,
                breakdownRaw: apiReport?.emissions?.byCategory || [],
                baseYear,
            });
        } catch (err) {
            console.error('Engine error:', err);
            return null;
        }
    }, [decarbConfig, totalTonnes, scope1Tonnes, scope2Tonnes, apiReport, baseYear]);

    // Stable string key that captures every input that would change the narrative.
    // When this key matches the cached key in localStorage, no API call is needed.
    const narrativeCacheFingerprint = useMemo(() => {
        if (!outputs) return null;
        const o = outputs;
        return JSON.stringify({
            tier:     o.tier.key,
            base_year: o.period.base_year,
            target_year: o.period.target_year,
            baseline: o.totals.baseline_total,
            scope1:   o.totals.scope1_total,
            scope2:   o.totals.scope2_total,
            breakdown: o.breakdown.map((d) => `${d.name}:${d.tco2e}`).join(','),
            bau:      o.bau.enabled,
            trees:    o.trees.enabled,
        });
    }, [outputs]);

    // Dynamic page sequence (depends on which optional sections are enabled)
    const pagePlan = useMemo(() => {
        const pages = ['S0_cover', 'S1_exec', 'S2S3_baseline', 'S4_pathway'];
        if (outputs?.bau?.enabled) pages.push('S5_bau');
        pages.push('S6_residual');
        if (outputs?.trees?.enabled) pages.push('S7_trees');
        pages.push('S8_strategy', 'S9_roadmap', 'S10_assumptions', 'S11_appendix');
        return pages;
    }, [outputs?.bau?.enabled, outputs?.trees?.enabled]);

    const totalPages = pagePlan.length;
    const getPageNum = useCallback((key) => pagePlan.indexOf(key) + 1, [pagePlan]);

    // Fetch Claude narratives only when inputs actually change.
    // Cache narratives in localStorage so page navigation never triggers unnecessary API calls.
    useEffect(() => {
        if (!outputs || !narrativeCacheFingerprint || !hasToken) return;

        // ── Cache check ──────────────────────────────────────────────────────
        // If the stored fingerprint matches current inputs, use cached text and stop.
        try {
            const raw = localStorage.getItem(NARRATIVE_CACHE_KEY);
            if (raw) {
                const cached = JSON.parse(raw);
                if (cached.fingerprint === narrativeCacheFingerprint && cached.data && Object.keys(cached.data).length > 0) {
                    setNarratives(cached.data);
                    return; // Cache hit — no API call needed
                }
            }
        } catch { /* corrupted cache; proceed to fetch */ }

        // ── Cache miss → call Claude ──────────────────────────────────────────
        const o = outputs;
        const sections = [
            {
                section_id: 'S1', slot_id: 'exec.narrative',
                bindings: { baseline_total: o.totals.baseline_total, target_emissions: o.pathway.target_emissions, target_year: o.period.target_year, r_total_pct: o.pathway.r_total_pct, annual_reduction_tco2e: o.pathway.annual_reduction_tco2e, residual_ceiling_tco2e: o.residual.residual_ceiling_tco2e, removal_requirement_tco2e_per_year: o.residual.removal_requirement_tco2e_per_year },
            },
            {
                section_id: 'S2', slot_id: 'baseline.caption',
                bindings: { baseline_total: o.totals.baseline_total, scope1_total: o.totals.scope1_total, scope2_total: o.totals.scope2_total, breakdown: o.breakdown.slice(0, 4) },
            },
            {
                section_id: 'S3', slot_id: 'sources.caption',
                bindings: { breakdown: o.breakdown.slice(0, 4), baseline_total: o.totals.baseline_total },
            },
            {
                section_id: 'S4', slot_id: 'pathway.caption',
                bindings: { baseline_total: o.totals.baseline_total, target_emissions: o.pathway.target_emissions, base_year: o.period.base_year, target_year: o.period.target_year, annual_reduction_tco2e: o.pathway.annual_reduction_tco2e, annual_reduction_pct: o.pathway.annual_reduction_pct_of_baseline, r_total_pct: o.pathway.r_total_pct, tier_label: o.tier.label },
            },
            {
                section_id: 'S5', slot_id: 'bau.caption',
                bindings: { bau_enabled: o.bau.enabled, baseline_total: o.totals.baseline_total, target_emissions: o.pathway.target_emissions, bau_target_year_emissions: o.bau.bau_target_year_emissions, target_year: o.period.target_year, bau_growth_rate: o.bau.growth_rate },
            },
            {
                section_id: 'S6', slot_id: 'residual.caption',
                bindings: { residual_ceiling_tco2e: o.residual.residual_ceiling_tco2e, structural_residual_pct_display: o.residual.structural_residual_pct_display, removal_requirement_tco2e_per_year: o.residual.removal_requirement_tco2e_per_year, tier_label: o.tier.label, target_emissions: o.pathway.target_emissions },
            },
            {
                section_id: 'S7', slot_id: 'removals.caption',
                bindings: { removal_requirement_tco2e_per_year: o.residual.removal_requirement_tco2e_per_year, trees_enabled: o.trees.enabled, trees_per_year: o.trees.trees_per_year, trees_cumulative: o.trees.trees_cumulative, sequestration_rate: o.trees.sequestration_rate, years_to_target: o.pathway.years_to_target, target_year: o.period.target_year },
            },
            {
                section_id: 'S8', slot_id: 'strategy.text',
                bindings: { top_sources: o.breakdown.slice(0, 2).map(d => d.name), annual_reduction_tco2e: o.pathway.annual_reduction_tco2e, years_to_target: o.pathway.years_to_target, target_year: o.period.target_year, r_total_pct: o.pathway.r_total_pct },
            },
            {
                section_id: 'S9', slot_id: 'roadmap.caption',
                bindings: {
                    baseline_total: o.totals.baseline_total,
                    scope1_total: o.totals.scope1_total,
                    scope2_total: o.totals.scope2_total,
                    top_source: o.breakdown[0]?.name ?? 'Not provided',
                    top_source_share_pct: o.breakdown[0]?.pct_of_total ?? 0,
                    second_source: o.breakdown[1]?.name ?? 'Not provided',
                    second_source_share_pct: o.breakdown[1]?.pct_of_total ?? 0,
                    years_to_target: o.pathway.years_to_target,
                    annual_reduction_tco2e: o.pathway.annual_reduction_tco2e,
                    annual_reduction_pct_of_baseline: o.pathway.annual_reduction_pct_of_baseline,
                    target_emissions: o.pathway.target_emissions,
                    residual_ceiling_tco2e: o.residual.residual_ceiling_tco2e,
                    removal_requirement_tco2e_per_year: o.residual.removal_requirement_tco2e_per_year,
                    ambition_tier: o.tier.label,
                },
            },
            {
                section_id: 'S10', slot_id: 'assumptions.bullets',
                bindings: { bau_enabled: o.bau.enabled, trees_enabled: o.trees.enabled, tier_label: o.tier.label, structural_residual_pct_display: o.residual.structural_residual_pct_display },
            },
        ];

        let cancelled = false;
        setNarrativesLoading(true);
        getReportNarratives(sections)
            .then((arr) => {
                if (cancelled) return;
                const dict = {};
                arr.forEach((item) => { if (item.slot_id) dict[item.slot_id] = item.text; });
                setNarratives(dict);
                // ── Persist to cache ─────────────────────────────────────────
                try {
                    localStorage.setItem(NARRATIVE_CACHE_KEY, JSON.stringify({
                        fingerprint: narrativeCacheFingerprint,
                        data: dict,
                        cached_at: new Date().toISOString(),
                    }));
                } catch { /* localStorage full or unavailable — ignore */ }
            })
            .catch(() => { /* silently fallback — report still usable without AI text */ })
            .finally(() => { if (!cancelled) setNarrativesLoading(false); });
        return () => { cancelled = true; };
    // narrativeCacheFingerprint is derived from outputs; re-running on outputs ref would be redundant
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [narrativeCacheFingerprint, hasToken]);

    const intensity = totalTonnes / EMPLOYEES;

    const fmt = (val) => {
        const num = typeof val === 'number' ? val : parseFloat(val);
        return Number.isFinite(num) ? num.toLocaleString('en-US', { maximumFractionDigits: 0 }) : '0';
    };
    const fmtPct = (val) => (typeof val === 'number' ? val.toFixed(1) : '0.0') + '%';

    function kgToTonnes(kg) { return kg == null ? 0 : kg / 1000; }

    function formatDateLabel(dateStr) {
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }

    const showToast = (msg) => {
        setToast(msg);
        setTimeout(() => setToast(''), 3000);
    };

    const reportPeriodLabel = useMemo(() => {
        if (customDateRange?.start && customDateRange?.end) {
            return `Reporting Period: ${formatDateLabel(customDateRange.start)} – ${formatDateLabel(customDateRange.end)}`;
        }
        if (!hasToken && getReportingPeriodLabel()) return 'Reporting Period: ' + getReportingPeriodLabel();
        return `Reporting Period: ${formatDateLabel(dateRange.start)} – ${formatDateLabel(dateRange.end)}`;
    }, [customDateRange, dateRange, hasToken, getReportingPeriodLabel]);

    const customCardSubtitle = customDateRange?.start && customDateRange?.end
        ? `${formatDateLabel(customDateRange.start)} → ${formatDateLabel(customDateRange.end)}`
        : 'Tap to pick a date range';

    // Monthly trend chart data (unchanged — uses real API data)
    const monthlyTrendData = useMemo(() => {
        const trend = apiReport?.emissions?.trend;
        if (trend && Array.isArray(trend) && trend.length > 0) {
            const fmtMonth = (m) => {
                if (!m) return '';
                const [y, mo] = String(m).split('-');
                const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
                return months[parseInt(mo, 10) - 1] + ' ' + (y || '');
            };
            return {
                labels: trend.map((t) => t.label || fmtMonth(t.month)),
                datasets: [{ label: 'Emissions (tCO₂e)', data: trend.map((t) => t.totalTonnes ?? kgToTonnes((t.scope1||0)+(t.scope2||0))), backgroundColor: 'rgba(20,184,166,0.5)', borderColor: '#14B8A6' }],
            };
        }
        const monthly = getMonthlyData();
        return {
            labels: monthly.labels,
            datasets: [{ label: 'Emissions (tCO₂e)', data: monthly.labels.map((_, i) => (monthly.scope1[i]||0)+(monthly.scope2[i]||0)), backgroundColor: 'rgba(20,184,166,0.5)', borderColor: '#14B8A6' }],
        };
    }, [apiReport, getMonthlyData]);

    const getChartDataUrl = (containerId) => {
        const el = document.getElementById(containerId);
        const canvas = el?.querySelector('canvas');
        if (!canvas) return null;
        try { return canvas.toDataURL('image/png'); } catch { return null; }
    };

    const handleDownloadPDF = async () => {
        const reportEl = document.querySelector('.report-page');
        if (!reportEl) return;
        setPdfGenerating(true);

        // Snapshot live chart canvases before cloning
        const chartIds = ['pathwayChartContainer','monthlyTrendChartContainer','baselinePieContainer','sourcesBarContainer','bauChartContainer','residualBarContainer'];
        const chartImages = {};
        chartIds.forEach((id) => { chartImages[id] = getChartDataUrl(id); });

        const clone = reportEl.cloneNode(true);

        // Swap canvas elements with static images inside the clone
        chartIds.forEach((id) => {
            const dataUrl = chartImages[id];
            if (!dataUrl) return;
            const container = clone.querySelector(`#${id}`);
            const canvas = container?.querySelector('canvas');
            if (!container || !canvas) return;
            const img = document.createElement('img');
            img.src = dataUrl; img.alt = ''; img.style.cssText = 'width:100%;height:auto;display:block;';
            container.replaceChild(img, canvas);
        });

        // Strip UI-only elements from the clone
        clone.querySelectorAll('.no-print').forEach((el) => el.remove());

        const pages = clone.querySelectorAll('.report-print-page');
        if (pages.length === 0) { showToast('No pages to export.'); setPdfGenerating(false); return; }

        // A4 dimensions
        const PAGE_W_MM = 210;
        const PAGE_H_MM = 297;
        const SCALE = 2;              // retina-quality rendering
        const CAPTURE_PX_W = 794;     // ~A4 at 96 dpi, matches typical browser width

        // Off-screen rendering container — fixed width so every page renders identically
        const wrapper = document.createElement('div');
        wrapper.style.cssText = `position:fixed;left:-9999px;top:0;width:${CAPTURE_PX_W}px;background:#fff;z-index:-1;overflow:visible;`;
        wrapper.appendChild(clone);
        document.body.appendChild(wrapper);

        try {
            const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

            for (let i = 0; i < pages.length; i++) {
                const pageEl = pages[i];
                const isCover = pageEl.classList.contains('report-cover-page');

                // Every section except the first gets its own fresh PDF page
                if (i > 0) pdf.addPage();

                if (isCover) {
                    // Cover: force exact A4 proportions, fill full page
                    const A4_H_PX = Math.round(CAPTURE_PX_W * (PAGE_H_MM / PAGE_W_MM));
                    pageEl.style.cssText += `width:${CAPTURE_PX_W}px;min-height:${A4_H_PX}px;box-sizing:border-box;`;
                    const canvas = await html2canvas(pageEl, {
                        scale: SCALE, useCORS: true, logging: false, backgroundColor: null,
                        width: CAPTURE_PX_W, windowWidth: CAPTURE_PX_W,
                    });
                    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, PAGE_W_MM, PAGE_H_MM, undefined, 'FAST');
                    continue;
                }

                // Content pages: render at natural height, then scale to fit A4
                pageEl.style.cssText += `width:${CAPTURE_PX_W}px;`;
                const canvas = await html2canvas(pageEl, {
                    scale: SCALE, useCORS: true, logging: false, backgroundColor: '#ffffff',
                    width: CAPTURE_PX_W, windowWidth: CAPTURE_PX_W,
                    // Do NOT set a fixed height — let the section render at its natural content height
                });

                const naturalW = canvas.width;   // CAPTURE_PX_W * SCALE
                const naturalH = canvas.height;  // natural content height * SCALE

                // Scale to fill A4 width
                let imgW = PAGE_W_MM;
                let imgH = naturalH * (PAGE_W_MM / naturalW);

                // If section is taller than an A4 page, scale down further so nothing is clipped
                if (imgH > PAGE_H_MM) {
                    imgW = PAGE_W_MM * (PAGE_H_MM / imgH);
                    imgH = PAGE_H_MM;
                }

                // Place flush to the top-left corner — short sections will have whitespace
                // at the bottom, which is normal for a paged report
                pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, imgW, imgH, undefined, 'FAST');
            }

            pdf.save('URIMPACT_Decarbonization_Report.pdf');
            showToast('PDF downloaded successfully.');
        } catch (err) {
            console.error('PDF export failed', err);
            showToast('PDF export failed. Try again or use Print to PDF.');
        } finally {
            if (wrapper.parentNode) document.body.removeChild(wrapper);
            setPdfGenerating(false);
        }
    };

    // ─── Gate: require config ─────────────────────────────────────────────────
    if (!decarbConfig) {
        return (
            <div className="reports-content">
                <div className="page-header"><h1>Reports</h1><p>Generate comprehensive emission reports for compliance and analysis</p></div>
                <div className="report-gate card">
                    <div className="report-gate-icon"><i className="fas fa-lock"></i></div>
                    <h2>Reports require Inputs &amp; Constraints</h2>
                    <p>To access Reports, please complete the <strong>Inputs &amp; Constraints</strong> form in the Decarbonization section. Your target year and ambition level will be used to generate the Decarbonization Report.</p>
                    <Link to="/decarbonization" className="btn btn-primary"><i className="fas fa-leaf"></i> Go to Decarbonization</Link>
                </div>
            </div>
        );
    }

    // ─── Derived chart data (from outputs — single source of truth) ───────────
    const pieData = outputs ? {
        labels: outputs.breakdown.map((d) => d.name),
        datasets: [{ data: outputs.breakdown.map((d) => d.tco2e), backgroundColor: CHART_COLORS.slice(0, outputs.breakdown.length), borderWidth: 1 }],
    } : null;

    const horizontalBarData = outputs ? {
        labels: [...outputs.breakdown].sort((a, b) => b.tco2e - a.tco2e).map((d) => d.name),
        datasets: [{ label: 'tCO₂e', data: [...outputs.breakdown].sort((a, b) => b.tco2e - a.tco2e).map((d) => d.tco2e), backgroundColor: '#14B8A6', borderRadius: 4 }],
    } : null;

    const pathwayLineData = outputs ? {
        labels: outputs.series.intervention.years.map(String),
        datasets: [{
            label: 'Reduction Pathway',
            data: outputs.series.intervention.emissions,
            borderColor: '#14B8A6', backgroundColor: 'rgba(20,184,166,0.15)', tension: 0.1, fill: true,
        }],
    } : null;

    const bauLineData = outputs?.bau?.enabled ? {
        labels: outputs.bau.series_years.map(String),
        datasets: [
            { label: 'Business as Usual', data: outputs.bau.series_emissions, borderColor: '#1E293B', backgroundColor: 'rgba(30,41,59,0.1)', tension: 0.35, fill: true },
            { label: 'Reduction Pathway', data: outputs.series.intervention.emissions, borderColor: '#14B8A6', backgroundColor: 'rgba(20,184,166,0.15)', tension: 0.1, fill: true },
        ],
    } : null;

    // S6 stacked bar — per spec §4 S6:
    //   Segment A (Eliminated) = baseline_total − target_emissions  (the entire reduction achieved)
    //   Segment B (Structural Residual) = residual_ceiling_tco2e  (the hard-to-abate floor)
    //   Both segments shown together so they sum to baseline (for base_year) or target (for target_year)
    const residualBarData = outputs ? {
        labels: [String(outputs.period.base_year), String(outputs.period.target_year)],
        datasets: [
            {
                label: 'Eliminated',
                // base_year: full reduction potential shown; target_year: same eliminated band
                data: [outputs.residual.eliminated_tco2e, outputs.residual.eliminated_tco2e],
                backgroundColor: '#14B8A6',
                stack: 'a',
            },
            {
                label: 'Structural Residual Ceiling',
                // base_year: residual floor anchored to baseline; target_year: residual ceiling
                data: [outputs.residual.residual_ceiling_tco2e, outputs.residual.residual_ceiling_tco2e],
                backgroundColor: '#1E293B',
                stack: 'a',
            },
        ],
    } : null;

    const narrText = (slot) => {
        if (narrativesLoading) return 'Generating AI narrative…';
        return narratives[slot] || '';
    };

    const peerComparisonPercent = Math.min(60, Math.round(50 * (1 + totalTonnes / 2000)));

    // ─── JSX ─────────────────────────────────────────────────────────────────
    return (
        <div className="reports-content">
            <div className="page-header">
                <h1>Reports</h1>
                <p>Generate comprehensive emission reports for compliance and analysis</p>
            </div>

            {/* Report controls */}
            <div className="dashboard-content report-page">
                <section className="report-actions no-print">
                    <div className="report-option-cards">
                        <div
                            className={`report-card ${reportRange === 'annual' && !customDateRange ? 'active' : ''}`}
                            onClick={() => { setReportRange('annual'); setCustomDateRange(null); showToast('Annual Report selected.'); }}
                            role="button" tabIndex={0}
                            onKeyDown={(e) => e.key === 'Enter' && (setReportRange('annual'), setCustomDateRange(null))}
                        >
                            <div className="report-card-icon calendar"><i className="fas fa-calendar"></i></div>
                            <div><span>Annual Report</span><p>FY {new Date().getFullYear()} inventory</p></div>
                        </div>
                        <div
                            className={`report-card ${reportRange === 'monthly' ? 'active' : ''}`}
                            onClick={() => { setReportRange('monthly'); setCustomDateRange(null); showToast('Monthly Summary selected.'); }}
                            role="button" tabIndex={0}
                            onKeyDown={(e) => e.key === 'Enter' && (setReportRange('monthly'), setCustomDateRange(null))}
                        >
                            <div className="report-card-icon month"><i className="fas fa-chart-line"></i></div>
                            <div><span>Monthly Summary</span><p>Latest month snapshot</p></div>
                        </div>
                        <div
                            className={`report-card custom-card ${reportRange === 'custom' && customDateRange ? 'active' : ''}`}
                            onClick={() => { setCustomModalOpen(true); setReportRange('custom'); if (!customStart || !customEnd) { const today = new Date(); setCustomEnd(today.toISOString().slice(0,10)); setCustomStart(new Date(today.getTime()-29*24*60*60*1000).toISOString().slice(0,10)); } }}
                            role="button" tabIndex={0}
                            onKeyDown={(e) => e.key === 'Enter' && setCustomModalOpen(true)}
                        >
                            <div className="report-card-icon sliders"><i className="fas fa-sliders-h"></i></div>
                            <div><span>Assign custom dates</span><p>{customCardSubtitle}</p></div>
            </div>
                    </div>
                    <div className="report-actions-cta">
                        {narrativesLoading && <span className="narrative-status no-print" style={{fontSize:'0.82rem',color:'#64748B',marginRight:'0.75rem'}}><i className="fas fa-circle-notch fa-spin"></i> Generating AI narrative…</span>}
                        <button type="button" className="btn btn-primary pdf-btn" onClick={handleDownloadPDF} disabled={pdfGenerating}>
                            <i className="fas fa-file-pdf"></i> {pdfGenerating ? 'Generating PDF…' : 'Download PDF'}
                        </button>
                        <small>Exports directly as PDF via URIMPACT (urimpact.sa)</small>
                    </div>
                </section>

                {apiLoading ? (
                    <div className="report-loading">Loading report data…</div>
                ) : (
                    <>
                        {/* ── S0: Cover ───────────────────────────────────────────────────── */}
                        <div className="report-print-page report-cover-page">
                            <div className="report-cover-bg" aria-hidden="true" />
                            <div className="report-cover-center">
                                <img src="/logo.svg" alt="URIMPACT" className="report-cover-brand-logo" />
                                <h1 className="report-cover-title">Decarbonization Report</h1>
                                <p className="report-cover-org">{outputs?.org?.name ?? 'Your Organization'}</p>
                                <p className="report-cover-subtitle">Operational Emissions — {baseYear} Baseline &amp; Pathway to {outputs?.period?.target_year ?? '—'}</p>
                                <p className="report-cover-period">{reportPeriodLabel}</p>
                                <p className="report-cover-period" style={{marginTop:'0.25rem',fontSize:'0.85em'}}>Ambition Tier: {outputs?.tier?.label ?? '—'} | Engine v{ENGINE_VERSION}</p>
                            </div>
                            <div className="report-page-footer report-cover-footer">{getPageNum('S0_cover')} of {totalPages} | Generated by URIMPACT Platform</div>
                        </div>

                        {/* ── S1: Executive Snapshot ──────────────────────────────────────── */}
                        <div className="report-print-page">
                            <section className="card report-section">
                                <div className="section-title">Executive Snapshot — {baseYear} Baseline</div>
                                <div className="metrics-grid metrics-inline">
                                    <div className="card metric-card">
                                        <span className="metric-label">Baseline Emissions</span>
                                        <span className="metric-value">{fmt(outputs?.totals?.baseline_total)} tCO₂e</span>
                                        <span className="metric-subtitle">Total operational emissions ({baseYear})</span>
                                    </div>
                                    <div className="card metric-card metric-positive">
                                        <span className="metric-label">Target-Year Emissions</span>
                                        <span className="metric-value">{fmt(outputs?.pathway?.target_emissions)} tCO₂e</span>
                                        <span className="metric-subtitle">{fmtPct(outputs?.pathway?.r_total_pct ?? 0)} reduction by {outputs?.period?.target_year}</span>
                                    </div>
                                    <div className="card metric-card">
                                        <span className="metric-label">Annual Reduction Required</span>
                                        <span className="metric-value">{fmt(outputs?.pathway?.annual_reduction_tco2e)} tCO₂e/yr</span>
                                        <span className="metric-subtitle">{fmtPct(outputs?.pathway?.annual_reduction_pct_of_baseline ?? 0)} of baseline annually</span>
                                    </div>
                                    <div className="card metric-card">
                                        <span className="metric-label">Structural Residual Ceiling</span>
                                        <span className="metric-value">{fmt(outputs?.residual?.residual_ceiling_tco2e)} tCO₂e</span>
                                        <span className="metric-subtitle">Removal obligation: {fmt(outputs?.residual?.removal_requirement_tco2e_per_year)} tCO₂e/yr</span>
                                    </div>
                                    <div className="card metric-card">
                                        <span className="metric-label">Intensity per Employee</span>
                                        <span className="metric-value">{intensity.toFixed(2)} tCO₂e</span>
                                        <span className="metric-subtitle">{peerComparisonPercent}% below regional peer average</span>
                                    </div>
                                    {outputs?.trees?.enabled && (
                                        <div className="card metric-card">
                                            <span className="metric-label">Tree Equivalency (illustrative)</span>
                                            <span className="metric-value">{fmt(outputs.trees.trees_per_year)} trees/yr</span>
                                            <span className="metric-subtitle">At {outputs.trees.sequestration_rate} tCO₂e/tree/yr</span>
                                        </div>
                                    )}
                                </div>
                                {narrText('exec.narrative') && (
                                    <p className="body-text insight-text"><strong>Narrative:</strong> {narrText('exec.narrative')}</p>
                                )}
                            </section>
                            <div className="report-page-footer">{getPageNum('S1_exec')} of {totalPages} | Generated by URIMPACT Platform</div>
                        </div>

                        {/* ── S2 + S3: Baseline Profile + Source Breakdown ────────────────── */}
                        <div className="report-print-page">
                            <section className="card report-section">
                                <div className="section-title">S2 — Baseline Emissions Profile</div>
                                <p className="body-text lead">Emissions composition by source category</p>
                                <div style={{ display:'flex', gap:'2rem', flexWrap:'wrap', alignItems:'flex-start' }}>
                                    <div id="baselinePieContainer" style={{ flex:'0 0 260px', height:260 }}>
                                        {pieData && (
                                            <Pie data={pieData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { font: { size: 11 } } }, tooltip: { callbacks: { label: (ctx) => ` ${ctx.label}: ${fmt(ctx.raw)} tCO₂e` } } } }} />
                                        )}
                                    </div>
                                    <div style={{ flex:'1', minWidth:'180px' }}>
                                        <table className="report-table" style={{ marginTop:0 }}>
                                            <thead><tr><th>Source</th><th>Scope</th><th>tCO₂e</th><th>%</th></tr></thead>
                                            <tbody>
                                                {outputs?.breakdown?.map((d) => (
                                                    <tr key={d.name}><td>{d.name}</td><td>{d.scope}</td><td>{fmt(d.tco2e)}</td><td>{d.pct_of_total.toFixed(1)}%</td></tr>
                                                ))}
                                                <tr className="total-row"><td>Total</td><td>—</td><td>{fmt(outputs?.totals?.baseline_total)}</td><td>100%</td></tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                                {narrText('baseline.caption') && (
                                    <p className="body-text" style={{marginTop:'0.75rem'}}>{narrText('baseline.caption')}</p>
                                )}
                            </section>

                            <section className="card report-section">
                                <div className="section-title">S3 — Source Comparison (Ranked)</div>
                                <div id="sourcesBarContainer" className="chart-container report-chart" style={{ maxHeight:200 }}>
                                    {horizontalBarData && (
                                        <Bar data={horizontalBarData} options={{ indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true, grid: { color: '#F1F5F9' } }, y: { grid: { display: false } } } }} />
                                    )}
                                </div>
                                {narrText('sources.caption') && (
                                    <p className="body-text">{narrText('sources.caption')}</p>
                                )}
                            </section>
                            <div className="report-page-footer">{getPageNum('S2S3_baseline')} of {totalPages} | Generated by URIMPACT Platform</div>
                        </div>

                        {/* ── Monthly Trend (real data — not part of scenario model, page 4b) ── */}
                        <div className="report-print-page">
                            <section className="card report-section">
                                <div className="section-title">Monthly Emissions Trend</div>
                                <p className="body-text lead">Historical trend from uploaded receipts and manual entries</p>
                                <div id="monthlyTrendChartContainer" className="chart-container report-chart">
                                    <Bar data={monthlyTrendData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } }, scales: { y: { beginAtZero: true, grid: { color: '#F1F5F9' } }, x: { grid: { display: false } } } }} />
                                </div>
                                <p className="body-text"><strong>Note:</strong> This chart reflects actual recorded emissions data for the reporting period. It is independent of the pathway model.</p>
                            </section>
                            <div className="report-page-footer">{getPageNum('S2S3_baseline')} of {totalPages} (continued) | Generated by URIMPACT Platform</div>
                </div>

                        {/* ── S4: Decarbonisation Pathway ─────────────────────────────────── */}
                        <div className="report-print-page">
                            <section className="card report-section">
                                <div className="section-title">S4 — Decarbonisation Pathway</div>
                                <p className="body-text lead">{outputs?.tier?.label} — {fmt(outputs?.totals?.baseline_total)} → {fmt(outputs?.pathway?.target_emissions)} tCO₂e by {outputs?.period?.target_year}</p>
                                <div className="pathway-overview-box">
                                    <p className="body-text"><strong>Tier:</strong> {outputs?.tier?.label} | <strong>R_total:</strong> {fmtPct(outputs?.pathway?.r_total_pct ?? 0)} | <strong>LAR_req:</strong> {fmt(outputs?.pathway?.annual_reduction_tco2e)} tCO₂e/yr ({fmtPct(outputs?.pathway?.annual_reduction_pct_of_baseline ?? 0)} of baseline)</p>
                                    <p className="body-text"><strong>Structural Residual Ceiling:</strong> {fmt(outputs?.residual?.residual_ceiling_tco2e)} tCO₂e ({fmtPct(outputs?.residual?.structural_residual_pct_display ?? 0)} of baseline) | <strong>Removal obligation:</strong> {fmt(outputs?.residual?.removal_requirement_tco2e_per_year)} tCO₂e/yr (one-to-one neutralisation)</p>
                </div>
                                <div id="pathwayChartContainer" className="chart-container report-chart">
                                    {pathwayLineData && (
                                        <Line data={pathwayLineData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } }, scales: { y: { beginAtZero: true, grid: { color: '#F1F5F9' } }, x: { grid: { display: false } } } }} />
                                    )}
                            </div>
                                {narrText('pathway.caption') && (
                                    <p className="body-text">{narrText('pathway.caption')}</p>
                                )}
                            </section>
                            <div className="report-page-footer">{getPageNum('S4_pathway')} of {totalPages} | Generated by URIMPACT Platform</div>
                        </div>

                        {/* ── S5: BAU vs Intervention (conditional) ────────────────────────── */}
                        {outputs?.bau?.enabled && (
                            <div className="report-print-page">
                                <section className="card report-section">
                                    <div className="section-title">S5 — BAU vs. Reduction Pathway</div>
                                    <p className="body-text lead">BAU comparator at 0% growth vs. intervention target: {fmt(outputs.bau.bau_target_year_emissions)} → {fmt(outputs.pathway.target_emissions)} tCO₂e by {outputs.period.target_year}</p>
                                    <div id="bauChartContainer" className="chart-container report-chart">
                                        {bauLineData && (
                                            <Line data={bauLineData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } }, scales: { y: { beginAtZero: true, grid: { color: '#F1F5F9' } }, x: { grid: { display: false } } } }} />
                                        )}
                                    </div>
                                    {narrText('bau.caption') && (
                                        <p className="body-text">{narrText('bau.caption')}</p>
                                    )}
                                    <p className="body-text body-text-small"><strong>Note:</strong> BAU is a comparator scenario only. It does not affect pathway or residual calculations.</p>
                                </section>
                                <div className="report-page-footer">{getPageNum('S5_bau')} of {totalPages} | Generated by URIMPACT Platform</div>
                            </div>
                        )}

                        {/* ── S6: Residual Emissions ───────────────────────────────────────── */}
                        <div className="report-print-page">
                            <section className="card report-section">
                                <div className="section-title">S6 — Residual Emissions &amp; Structural Ceiling</div>
                                <p className="body-text lead">Structural residual ceiling: {fmt(outputs?.residual?.residual_ceiling_tco2e)} tCO₂e ({fmtPct(outputs?.residual?.structural_residual_pct_display ?? 0)} of baseline) — policy-defined for {outputs?.tier?.label}</p>
                                <div id="residualBarContainer" className="chart-container report-chart" style={{ maxHeight:220 }}>
                                    {residualBarData && (
                                        <Bar data={residualBarData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } }, scales: { x: { stacked: true, grid: { display: false } }, y: { stacked: true, beginAtZero: true, grid: { color: '#F1F5F9' } } } }} />
                                    )}
                                </div>
                                <div className="pathway-overview-box">
                                    <table className="report-table calculation-table">
                                        <tbody>
                                            <tr><td>Baseline ({outputs?.period?.base_year})</td><td>{fmt(outputs?.totals?.baseline_total)} tCO₂e</td></tr>
                                            <tr><td>Target-Year Emissions ({outputs?.period?.target_year})</td><td>{fmt(outputs?.pathway?.target_emissions)} tCO₂e</td></tr>
                                            <tr><td>Eliminated ({fmtPct(outputs?.pathway?.r_total_pct ?? 0)})</td><td>{fmt((outputs?.totals?.baseline_total ?? 0) - (outputs?.pathway?.target_emissions ?? 0))} tCO₂e</td></tr>
                                            <tr><td>Structural Residual Ceiling</td><td>{fmt(outputs?.residual?.residual_ceiling_tco2e)} tCO₂e</td></tr>
                                            <tr><td>Removal Obligation (= Residual Ceiling)</td><td>{fmt(outputs?.residual?.removal_requirement_tco2e_per_year)} tCO₂e/yr</td></tr>
                                        </tbody>
                                    </table>
                            </div>
                                {narrText('residual.caption') && (
                                    <p className="body-text">{narrText('residual.caption')}</p>
                                )}
                            </section>
                            <div className="report-page-footer">{getPageNum('S6_residual')} of {totalPages} | Generated by URIMPACT Platform</div>
                        </div>

                        {/* ── S7: Tree Equivalency (conditional) ──────────────────────────── */}
                        {outputs?.trees?.enabled && (
                            <div className="report-print-page">
                                <section className="card report-section">
                                    <div className="section-title">S7 — Removal Obligation &amp; Tree Equivalency (Illustrative)</div>
                                    <p className="body-text lead">Removal obligation: {fmt(outputs.residual.removal_requirement_tco2e_per_year)} tCO₂e/yr — translates to {fmt(outputs.trees.trees_per_year)} trees/yr at {outputs.trees.sequestration_rate * 1000} kg CO₂e/tree/yr</p>
                                    <div className="removal-calculation-box">
                                        <div className="section-title sub">Removal Calculation</div>
                                        <table className="report-table calculation-table">
                                            <tbody>
                                                <tr><td>Baseline Emissions ({outputs.period.base_year})</td><td>{fmt(outputs.totals.baseline_total)} tCO₂e</td></tr>
                                                <tr><td>Structural Residual ({fmtPct(outputs.residual.structural_residual_pct_display)})</td><td>{fmt(outputs.residual.residual_ceiling_tco2e)} tCO₂e</td></tr>
                                                <tr><td>Annual Removal Obligation</td><td>{fmt(outputs.residual.removal_requirement_tco2e_per_year)} tCO₂e/yr</td></tr>
                                                <tr><td>Sequestration Rate (default)</td><td>{outputs.trees.sequestration_rate} tCO₂e/tree/yr</td></tr>
                                                <tr><td>Trees Required Annually</td><td>{fmt(outputs.trees.trees_per_year)} trees</td></tr>
                                                <tr><td>Cumulative ({outputs.period.base_year + 1}–{outputs.period.target_year})</td><td>{fmt(outputs.trees.trees_cumulative)} trees</td></tr>
                                            </tbody>
                                        </table>
                                    </div>
                                    <div className="tree-highlight-box">
                                        <span className="tree-highlight-number">{fmt(outputs.trees.trees_per_year)}</span>
                                        <span className="tree-highlight-label">Trees Required Annually (Illustrative)</span>
                                        <span className="tree-highlight-desc">Based on default sequestration rate of {outputs.trees.sequestration_rate * 1000} kg CO₂e/tree/year. This is illustrative; actual removal capacity depends on verified project data.</span>
                                    </div>
                                    {narrText('removals.caption') && (
                                        <p className="body-text">{narrText('removals.caption')}</p>
                                    )}
                                </section>
                                <div className="report-page-footer">{getPageNum('S7_trees')} of {totalPages} | Generated by URIMPACT Platform</div>
                            </div>
                        )}

                        {/* ── S8: Strategic Interpretation ────────────────────────────────── */}
                        <div className="report-print-page">
                            <section className="card report-section">
                                <div className="section-title">S8 — Strategic Interpretation</div>
                                {narrText('strategy.text') ? (
                                    <p className="body-text">{narrText('strategy.text')}</p>
                                ) : (
                                    <p className="body-text">Priority levers, governance implications, and planning considerations for {outputs?.org?.name} are derived from the dominant emission sources and required annual pace.</p>
                                )}
                                <div className="methodology-list" style={{marginTop:'1rem'}}>
                                    <p className="body-text"><strong>Top Sources:</strong> {outputs?.breakdown?.slice(0,2).map(d => `${d.name} (${d.pct_of_total.toFixed(1)}%)`).join(', ')}</p>
                                    <p className="body-text"><strong>Annual Pace:</strong> {fmt(outputs?.pathway?.annual_reduction_tco2e)} tCO₂e/yr ({fmtPct(outputs?.pathway?.annual_reduction_pct_of_baseline ?? 0)} of baseline)</p>
                                    <p className="body-text"><strong>Boundary:</strong> This model covers the operational emissions included in the current inventory. Financial projections and engineering feasibility are excluded by design.</p>
                            </div>
                            </section>
                            <div className="report-page-footer">{getPageNum('S8_strategy')} of {totalPages} | Generated by URIMPACT Platform</div>
                        </div>

                        {/* ── S9: Implementation Roadmap (AI-generated narrative) ───────────── */}
                        <div className="report-print-page">
                            <section className="card report-section">
                                <div className="section-title">S9 — Implementation Roadmap</div>
                                {narrText('roadmap.caption') ? (
                                    <div className="body-text roadmap-narrative">
                                        {narrText('roadmap.caption').split(/\n\n+/).filter(Boolean).map((para, i) => (
                                            <p key={i} className="body-text" style={{ marginBottom: '0.75rem' }}>{para}</p>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="body-text" style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                        Roadmap narrative will appear here once generated. Ensure you are signed in and have saved a decarbonisation configuration.
                                    </p>
                                )}
                            </section>
                            <div className="report-page-footer">{getPageNum('S9_roadmap')} of {totalPages} | Generated by URIMPACT Platform</div>
                        </div>

                        {/* ── S10: Assumptions & Limitations ──────────────────────────────── */}
                        <div className="report-print-page">
                            <section className="card report-section">
                                <div className="section-title">S10 — Assumptions &amp; Limitations</div>
                                <p className="body-text lead">Audit-safe disclosure of modelling assumptions</p>
                                {narrText('assumptions.bullets') ? (
                                    <div className="body-text">
                                        {narrText('assumptions.bullets').split('\n').filter(Boolean).map((line, i) => (
                                            <p key={i} className="body-text" style={{marginBottom:'0.35rem'}}>{line}</p>
                                        ))}
                                    </div>
                                ) : (
                                    <ol className="body-text assumptions-list">
                                        <li>The model is based on absolute emissions reduction, not intensity-based metrics.</li>
                                        <li>StructuralResidual% is a policy-defined governance parameter tied to ambition tier selection — not an empirical measurement of abatement capacity.</li>
                                        <li>The annual removal obligation equals the structural residual ceiling (one-to-one neutralisation principle).</li>
                                        <li>The linear pathway is a planning simplification, not a performance guarantee.</li>
                                        <li>The emissions boundary is limited to the sources and categories included in this model. Financial projections and engineering feasibility are excluded by design.</li>
                                        <li>Tier mapping is policy-defined and versioned. Policy version: {POLICY_VERSION}.</li>
                                        {outputs?.bau?.enabled && <li>BAU scenario is a comparator only; it does not affect pathway or residual calculations.</li>}
                                        {outputs?.trees?.enabled && <li>Tree equivalency is illustrative and uses the default sequestration rate (0.025 tCO₂e/tree/yr). Actual removal capacity requires third-party verification.</li>}
                                        <li>No third-party verification is included unless explicitly stated.</li>
                                    </ol>
                                )}
                            </section>
                            <div className="report-page-footer">{getPageNum('S10_assumptions')} of {totalPages} | Generated by URIMPACT Platform</div>
                        </div>

                        {/* ── S11: Appendix — Audit Traceability ──────────────────────────── */}
                        <div className="report-print-page">
                            <section className="card report-section">
                                <div className="section-title">S11 — Appendix: Audit Traceability &amp; Data Sources</div>
                                <p className="body-text lead">Run Manifest and full variable audit trail</p>
                                <div className="section-title sub">Audit Traceability Table</div>
                                <table className="report-table calculation-table">
                                    <thead><tr><th>Variable</th><th>Source</th><th>Formula</th><th>Value</th></tr></thead>
                                    <tbody>
                                        <tr><td>E (Baseline)</td><td>Client data</td><td>—</td><td>{fmt(outputs?.totals?.baseline_total)} tCO₂e</td></tr>
                                        <tr><td>Operational segment A</td><td>Client data</td><td>—</td><td>{fmt(outputs?.totals?.scope1_total)} tCO₂e</td></tr>
                                        <tr><td>Operational segment B</td><td>Client data</td><td>—</td><td>{fmt(outputs?.totals?.scope2_total)} tCO₂e</td></tr>
                                        <tr><td>Base Year</td><td>Client config</td><td>—</td><td>{outputs?.period?.base_year}</td></tr>
                                        <tr><td>Target Year</td><td>Client config</td><td>—</td><td>{outputs?.period?.target_year}</td></tr>
                                        <tr><td>n (Time Horizon)</td><td>Calculated</td><td>Target − Base</td><td>{outputs?.pathway?.years_to_target} years</td></tr>
                                        <tr><td>Ambition Tier</td><td>Policy ({POLICY_VERSION})</td><td>—</td><td>{outputs?.tier?.label}</td></tr>
                                        <tr><td>R_total</td><td>Policy</td><td>—</td><td>{fmtPct(outputs?.pathway?.r_total_pct ?? 0)}</td></tr>
                                        <tr><td>StructuralResidual%</td><td>Policy</td><td>—</td><td>{fmtPct(outputs?.residual?.structural_residual_pct_display ?? 0)}</td></tr>
                                        <tr><td>E_target</td><td>Calculated</td><td>E × (1 − R_total)</td><td>{fmt(outputs?.pathway?.target_emissions)} tCO₂e</td></tr>
                                        <tr><td>LAR_req</td><td>Calculated</td><td>(E − E_target) / n</td><td>{fmt(outputs?.pathway?.annual_reduction_tco2e)} tCO₂e/yr</td></tr>
                                        <tr><td>E_residual_ceiling</td><td>Calculated</td><td>E × StructuralResidual%</td><td>{fmt(outputs?.residual?.residual_ceiling_tco2e)} tCO₂e</td></tr>
                                        <tr><td>Removal_req</td><td>Calculated</td><td>= E_residual_ceiling</td><td>{fmt(outputs?.residual?.removal_requirement_tco2e_per_year)} tCO₂e/yr</td></tr>
                                        {outputs?.trees?.enabled && (
                                            <>
                                                <tr><td>Sequestration Rate</td><td>Default (0.025)</td><td>—</td><td>{outputs.trees.sequestration_rate} tCO₂e/tree/yr</td></tr>
                                                <tr><td>Trees Required (Annual)</td><td>Calculated</td><td>Removal_req / seq_rate</td><td>{fmt(outputs.trees.trees_per_year)} trees/yr</td></tr>
                                            </>
                                        )}
                                        {outputs?.bau?.enabled && (
                                            <tr><td>BAU Growth Rate</td><td>Default (0%)</td><td>—</td><td>0.0%</td></tr>
                                        )}
                                    </tbody>
                                </table>

                                <div className="section-title sub" style={{marginTop:'1.25rem'}}>Emission Factors (Reference)</div>
                                <table className="report-table calculation-table appendix-factors">
                                    <tbody>
                                        <tr><td>Diesel</td><td>IPCC 2006 Guidelines (2019 Refinement)</td><td>2.68 kgCO₂e/L</td></tr>
                                        <tr><td>Electricity</td><td>Regional grid average, IEA</td><td>0.51 kgCO₂e/kWh</td></tr>
                                        <tr><td>Natural Gas</td><td>IPCC 2006 Guidelines</td><td>2.03 kgCO₂e/m³</td></tr>
                                    </tbody>
                                </table>
                            </section>
                            <div className="report-page-footer">{getPageNum('S11_appendix')} of {totalPages} | Generated by URIMPACT Platform</div>
                        </div>
                    </>
                )}

                <p className="report-footer-note no-print">Prepared for {outputs?.org?.name ?? 'demonstration purposes'} • URIMPACT — Engine v{ENGINE_VERSION}</p>
            </div>

            {toast && <div className="report-toast">{toast}</div>}

            {customModalOpen && (
                <div className="modal-overlay custom-dates" onClick={() => setCustomModalOpen(false)}>
                    <div className="custom-modal" onClick={(e) => e.stopPropagation()}>
                        <h3>Assign custom dates</h3>
                        <form onSubmit={(e) => { e.preventDefault(); if (!customStart || !customEnd) { showToast('Please select both dates.'); return; } if (new Date(customStart) > new Date(customEnd)) { showToast('End date must be after start date.'); return; } setCustomDateRange({ start: customStart, end: customEnd }); setCustomModalOpen(false); showToast('Custom range saved.'); }}>
                            <div className="form-group full-width">
                                <label>Start date</label>
                                <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} required />
                            </div>
                            <div className="form-group full-width">
                                <label>End date</label>
                                <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} required />
                            </div>
                            <div className="modal-actions">
                                <button type="button" className="btn btn-outline" onClick={() => setCustomModalOpen(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary">Apply range</button>
                        </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Reports;

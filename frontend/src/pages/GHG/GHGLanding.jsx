import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
    categoriesForScope,
    SCOPE3_DOWNSTREAM,
    SCOPE3_UPSTREAM,
    SCOPE1_CATEGORIES,
    SCOPE2_CATEGORIES,
    titleKeyForCategory,
} from './ghgCategories.js';
import GHGAnalytics from './GHGAnalytics.jsx';
import GhgCategoryIcon from './GhgCategoryIcon.jsx';
import { hasCustomCategoryIcon } from './ghgCategoryIcons.js';
import './GHG.css';

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 12 }, (_, i) => CURRENT_YEAR - i);

function formatTonnes(n) {
    if (n == null || Number.isNaN(n)) return '—';
    return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(n);
}

/** Color mapping for scope dots and progress bars */
const SCOPE_COLORS = {
    1: '#1A9A8F', // teal-dark
    2: '#2980B9', // blue
    3: '#E67E22', // orange
};

export default function GHGLanding() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [scopeTab, setScopeTab] = useState(1); // 1, 2, 3, or 'analytics'
    const [year, setYear] = useState(CURRENT_YEAR);

    const categories = useMemo(() => categoriesForScope(scopeTab), [scopeTab]);

    /* ── Compute scope totals from demoTonnes ── */
    const scopeTotals = useMemo(() => {
        const s1 = SCOPE1_CATEGORIES.reduce((sum, c) => sum + (c.demoTonnes || 0), 0);
        const s2 = SCOPE2_CATEGORIES.reduce((sum, c) => sum + (c.demoTonnes || 0), 0);
        const s3 = [...SCOPE3_UPSTREAM, ...SCOPE3_DOWNSTREAM].reduce(
            (sum, c) => sum + (c.demoTonnes || 0),
            0,
        );
        const total = s1 + s2 + s3;

        // Completeness: % of categories that have non-zero demoTonnes
        const allCats = [...SCOPE1_CATEGORIES, ...SCOPE2_CATEGORIES, ...SCOPE3_UPSTREAM, ...SCOPE3_DOWNSTREAM];
        const filled = allCats.filter((c) => c.demoTonnes > 0).length;
        const completeness = allCats.length > 0 ? Math.round((filled / allCats.length) * 100) : 0;

        return { s1, s2, s3, total, completeness };
    }, []);

    /** The scope total for the currently active tab */
    const currentScopeTotal = useMemo(() => {
        if (scopeTab === 1) return scopeTotals.s1;
        if (scopeTab === 2) return scopeTotals.s2;
        return scopeTotals.s3;
    }, [scopeTab, scopeTotals]);

    const heading =
        scopeTab === 1
            ? t('ghg.scope1Heading')
            : scopeTab === 2
              ? t('ghg.scope2Heading')
              : t('ghg.scope3Heading');

    const subtitle =
        scopeTab === 1
            ? t('ghg.scope1Sub')
            : scopeTab === 2
              ? t('ghg.scope2Sub')
              : t('ghg.scope3Sub');

    const openCategory = (slug) => {
        navigate(`/data-input/scope/${scopeTab}/category/${slug}`);
    };

    /** Render a single category card with progress bar */
    const renderCard = (cat, scopeNum) => {
        const pct = currentScopeTotal > 0
            ? Math.round((cat.demoTonnes / currentScopeTotal) * 100)
            : 0;
        return (
            <button
                key={cat.slug}
                type="button"
                className="ghg-category-card"
                onClick={() => openCategory(cat.slug)}
            >
                <span className="ghg-card-arrow" aria-hidden>
                    <i className="fas fa-chevron-right" />
                </span>
                <span className="ghg-card-icon" aria-hidden>
                    {hasCustomCategoryIcon(cat.slug) ? (
                        <GhgCategoryIcon slug={cat.slug} className="ghg-card-icon-svg" />
                    ) : (
                        <i className={`fas ${cat.icon}`} />
                    )}
                </span>
                <span className="ghg-card-title">{t(titleKeyForCategory(cat.slug))}</span>
                <span className="ghg-card-value">
                    {formatTonnes(cat.demoTonnes)} {t('ghg.tco2e')}
                </span>
                <div className="ghg-card-progress">
                    <div className="ghg-card-progress-fill" style={{ width: `${pct}%` }} />
                </div>
                <span className="ghg-card-pct">
                    {pct}% {t('ghg.ofScope', { n: scopeNum })}
                </span>
            </button>
        );
    };

    return (
        <div className="ghg-landing">
            <nav className="ghg-breadcrumb" aria-label={t('ghg.breadcrumbAria')}>
                <span className="ghg-breadcrumb-current">{t('sidebar.ghg')}</span>
                <span className="ghg-breadcrumb-sep" aria-hidden>
                    /
                </span>
                <span>{t('ghg.scopeTab', { n: scopeTab })}</span>
            </nav>

            {/* ── Summary stats bar ── */}
            <div className="ghg-summary-bar">
                <div className="ghg-summary-pill">
                    <span className="ghg-summary-dot" style={{ background: '#0f172a' }} />
                    <span className="ghg-summary-pill-label">{t('ghg.totalGHG')}</span>
                    <span className="ghg-summary-pill-value">{formatTonnes(scopeTotals.total)} {t('ghg.tco2e')}</span>
                </div>
                <div className="ghg-summary-pill">
                    <span className="ghg-summary-dot" style={{ background: SCOPE_COLORS[1] }} />
                    <span className="ghg-summary-pill-label">{t('ghg.scopeTab', { n: 1 })}</span>
                    <span className="ghg-summary-pill-value">{formatTonnes(scopeTotals.s1)}</span>
                </div>
                <div className="ghg-summary-pill">
                    <span className="ghg-summary-dot" style={{ background: SCOPE_COLORS[2] }} />
                    <span className="ghg-summary-pill-label">{t('ghg.scopeTab', { n: 2 })}</span>
                    <span className="ghg-summary-pill-value">{formatTonnes(scopeTotals.s2)}</span>
                </div>
                <div className="ghg-summary-pill">
                    <span className="ghg-summary-dot" style={{ background: SCOPE_COLORS[3] }} />
                    <span className="ghg-summary-pill-label">{t('ghg.scopeTab', { n: 3 })}</span>
                    <span className="ghg-summary-pill-value">{formatTonnes(scopeTotals.s3)}</span>
                </div>
                <div className="ghg-summary-pill">
                    <span className="ghg-summary-dot" style={{ background: '#22c55e' }} />
                    <span className="ghg-summary-pill-label">{t('ghg.completeness')}</span>
                    <span className="ghg-summary-pill-value">{scopeTotals.completeness}%</span>
                </div>
            </div>

            <div className="ghg-scope-tabs" role="tablist" aria-label={t('ghg.scopeTabsAria')}>
                {[1, 2, 3].map((n) => (
                    <button
                        key={n}
                        type="button"
                        role="tab"
                        aria-selected={scopeTab === n}
                        className={`ghg-scope-tab ${scopeTab === n ? 'active' : ''}`}
                        onClick={() => setScopeTab(n)}
                    >
                        {t('ghg.scopeTab', { n })}
                    </button>
                ))}
                <button
                    type="button"
                    role="tab"
                    aria-selected={scopeTab === 'analytics'}
                    className={`ghg-scope-tab ${scopeTab === 'analytics' ? 'active' : ''}`}
                    onClick={() => setScopeTab('analytics')}
                    style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>
                    Analytics
                </button>
            </div>

            {scopeTab === 'analytics' ? (
                <GHGAnalytics />
            ) : (
                <>
                    {(scopeTab === 1 || scopeTab === 2) ? (
                        <>
                            <h2 className="ghg-section-title">{heading}</h2>
                            <p className="ghg-section-sub">{subtitle}</p>
                        </>
                    ) : (
                        <header className="ghg-section-head">
                            <div className="ghg-section-head-text">
                                <h2 className="ghg-section-title">{heading}</h2>
                                <p className="ghg-section-sub">
                                    {subtitle}
                                    <button
                                        type="button"
                                        className="ghg-info-btn"
                                        title={t('ghg.scopeInfoTitle', { n: scopeTab })}
                                        aria-label={t('ghg.scopeInfoTitle', { n: scopeTab })}
                                    >
                                        <i className="fas fa-circle-info" aria-hidden />
                                    </button>
                                </p>
                            </div>
                            <div className="ghg-year-wrap">
                                <label htmlFor="ghg-year-select" className="ghg-year-label">
                                    {t('ghg.year')}
                                </label>
                                <select
                                    id="ghg-year-select"
                                    className="ghg-year-select"
                                    value={year}
                                    onChange={(e) => setYear(Number(e.target.value))}
                                >
                                    {YEAR_OPTIONS.map((y) => (
                                        <option key={y} value={y}>
                                            {t('ghg.yearOption', { year: y })}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </header>
                    )}

                    {scopeTab === 3 && (
                        <p className="ghg-hint">{t('ghg.scope3Hint')}</p>
                    )}

                    {scopeTab === 3 ? (
                        <>
                            <h3 className="ghg-subsection-title">{t('ghg.scope3Upstream')}</h3>
                            <div className="ghg-card-grid">
                                {SCOPE3_UPSTREAM.map((cat) => renderCard(cat, 3))}
                            </div>
                            <h3 className="ghg-subsection-title ghg-subsection-title--spaced">{t('ghg.scope3Downstream')}</h3>
                            <div className="ghg-card-grid">
                                {SCOPE3_DOWNSTREAM.map((cat) => renderCard(cat, 3))}
                            </div>
                        </>
                    ) : (
                        <div className="ghg-card-grid">
                            {categories.map((cat) => renderCard(cat, scopeTab))}
                        </div>
                    )}

                    {scopeTab === 1 && (
                        <p className="ghg-footnote">{t('ghg.demoTotalsFootnote', { year })}</p>
                    )}
                </>
            )}
        </div>
    );
}

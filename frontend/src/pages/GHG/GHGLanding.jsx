import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
    categoriesForScope,
    SCOPE3_DOWNSTREAM,
    SCOPE3_UPSTREAM,
    titleKeyForCategory,
} from './ghgCategories.js';
import './GHG.css';

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 12 }, (_, i) => CURRENT_YEAR - i);

function formatTonnes(n) {
    if (n == null || Number.isNaN(n)) return '—';
    return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(n);
}

export default function GHGLanding() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [scopeTab, setScopeTab] = useState(1);
    const [year, setYear] = useState(CURRENT_YEAR);

    const categories = useMemo(() => categoriesForScope(scopeTab), [scopeTab]);

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

    return (
        <div className="ghg-landing">
            <nav className="ghg-breadcrumb" aria-label={t('ghg.breadcrumbAria')}>
                <span className="ghg-breadcrumb-current">{t('sidebar.ghg')}</span>
                <span className="ghg-breadcrumb-sep" aria-hidden>
                    /
                </span>
                <span>{t('ghg.scopeTab', { n: scopeTab })}</span>
            </nav>

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
            </div>

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

            {scopeTab === 3 && (
                <p className="ghg-hint">{t('ghg.scope3Hint')}</p>
            )}

            {scopeTab === 3 ? (
                <>
                    <h3 className="ghg-subsection-title">{t('ghg.scope3Upstream')}</h3>
                    <div className="ghg-card-grid">
                        {SCOPE3_UPSTREAM.map((cat) => (
                            <button
                                key={cat.slug}
                                type="button"
                                className="ghg-category-card"
                                onClick={() => openCategory(cat.slug)}
                            >
                                <span className="ghg-card-icon" aria-hidden>
                                    <i className={`fas ${cat.icon}`} />
                                </span>
                                <span className="ghg-card-title">{t(titleKeyForCategory(cat.slug))}</span>
                                <span className="ghg-card-value">
                                    {formatTonnes(cat.demoTonnes)} {t('ghg.tco2e')}
                                </span>
                            </button>
                        ))}
                    </div>
                    <h3 className="ghg-subsection-title ghg-subsection-title--spaced">{t('ghg.scope3Downstream')}</h3>
                    <div className="ghg-card-grid">
                        {SCOPE3_DOWNSTREAM.map((cat) => (
                            <button
                                key={cat.slug}
                                type="button"
                                className="ghg-category-card"
                                onClick={() => openCategory(cat.slug)}
                            >
                                <span className="ghg-card-icon" aria-hidden>
                                    <i className={`fas ${cat.icon}`} />
                                </span>
                                <span className="ghg-card-title">{t(titleKeyForCategory(cat.slug))}</span>
                                <span className="ghg-card-value">
                                    {formatTonnes(cat.demoTonnes)} {t('ghg.tco2e')}
                                </span>
                            </button>
                        ))}
                    </div>
                </>
            ) : (
                <div className="ghg-card-grid">
                    {categories.map((cat) => (
                        <button
                            key={cat.slug}
                            type="button"
                            className="ghg-category-card"
                            onClick={() => openCategory(cat.slug)}
                        >
                            <span className="ghg-card-icon" aria-hidden>
                                <i className={`fas ${cat.icon}`} />
                            </span>
                            <span className="ghg-card-title">{t(titleKeyForCategory(cat.slug))}</span>
                            <span className="ghg-card-value">
                                {formatTonnes(cat.demoTonnes)} {t('ghg.tco2e')}
                            </span>
                        </button>
                    ))}
                </div>
            )}

            {scopeTab === 1 && (
                <p className="ghg-footnote">{t('ghg.demoTotalsFootnote', { year })}</p>
            )}
        </div>
    );
}

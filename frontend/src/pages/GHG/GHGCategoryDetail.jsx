import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    getAuthToken,
    getGhgCategoryEntries,
    submitGhgCategoryForm,
    downloadStationaryCombustionTemplate,
    previewStationaryCombustionBulk,
    confirmStationaryCombustionBulk,
    getStationaryCombustionLookupOptions,
    deleteEmission,
    deleteEmissionsBulk,
    aiExtractReceipt,
    aiConfirmReceipt,
} from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { readSitesForOrganization } from '../../utils/dataInputSitesStorage.js';
import { findCategory, titleKeyForCategory } from './ghgCategories.js';
import { STATIONARY_TEMPLATE_COLUMNS, STATIONARY_TEMPLATE_UNITS, STATIONARY_FUEL_SELECT_PRESETS } from './stationaryCombustionConfig.js';
import './GHG.css';

function formatTonnes(n) {
    if (n == null || Number.isNaN(n)) return '—';
    return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(n);
}

function formatDate(iso, locale) {
    if (!iso) return '—';
    try {
        return new Date(iso).toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
        return '—';
    }
}

function userLabel(u) {
    if (!u) return '—';
    const n = `${u.firstName || ''} ${u.lastName || ''}`.trim();
    return n || u.email || '—';
}

export default function GHGCategoryDetail() {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const { user } = useAuth();
    const { scopeNum, slug } = useParams();
    const scope = parseInt(scopeNum, 10) || 1;
    const hasApi = scope === 1 || scope === 2;

    const [mainTab, setMainTab] = useState('add');
    /** null = pick method (choice cards); then 'form' | 'bulk' | 'ai' */
    const [addStep, setAddStep] = useState(null);

    const [entries, setEntries] = useState([]);
    const [listLoading, setListLoading] = useState(false);
    const [listError, setListError] = useState('');

    const [activityType, setActivityType] = useState('diesel');
    const [activityAmount, setActivityAmount] = useState('');
    const [activityUnit, setActivityUnit] = useState('L');
    const [region, setRegion] = useState('AE');
    const [billingPeriodStart, setBillingPeriodStart] = useState('');
    const [billingPeriodEnd, setBillingPeriodEnd] = useState('');
    const [notes, setNotes] = useState('');
    const [siteName, setSiteName] = useState('');

    const [stAsset, setStAsset] = useState('');
    /** Matches `<select>` option value; `'__other__'` shows the custom fuel text area. */
    const [stFuelSelectKey, setStFuelSelectKey] = useState('Diesel');
    const [stFuelUsed, setStFuelUsed] = useState('Diesel');
    const [stFacility, setStFacility] = useState('');
    const [stFuelUnit, setStFuelUnit] = useState('Litre');
    const [stDate, setStDate] = useState('');

    const [bulkFile, setBulkFile] = useState(null);
    const [bulkUploading, setBulkUploading] = useState(false);
    /** @type {{ type: 'ok' | 'err'; text: string } | null} */
    const [bulkFeedback, setBulkFeedback] = useState(null);
    /** 'file' | 'review' */
    const [bulkStep, setBulkStep] = useState('file');
    /** @type {Array<{ clientId: string; excelRow: number; status: string; errors: string[]; input: Record<string, unknown>; mappedPreview?: Record<string, unknown> }>} */
    const [bulkReviewRows, setBulkReviewRows] = useState([]);

    /** Stationary manual form: edit fields first, then review before API submit */
    const [stManualPhase, setStManualPhase] = useState('edit');

    const [lookupFacilities, setLookupFacilities] = useState([]);
    const [lookupAssets, setLookupAssets] = useState([]);
    const [lookupPastActivityTypes, setLookupPastActivityTypes] = useState([]);

    const [submitting, setSubmitting] = useState(false);
    /** @type {{ type: 'ok' | 'err'; text: string } | null} */
    const [submitFeedback, setSubmitFeedback] = useState(null);
    const [lastSaved, setLastSaved] = useState(null);

    const [viewSearch, setViewSearch] = useState('');
    const [selectedIds, setSelectedIds] = useState([]);
    const [deleting, setDeleting] = useState(false);
    const [deleteFeedback, setDeleteFeedback] = useState(null);

    /* ── AI receipt extraction state ── */
    const [aiFile, setAiFile] = useState(null);
    /** 'upload' | 'extracting' | 'review' | 'confirming' | 'done' */
    const [aiStep, setAiStep] = useState('upload');
    const [aiExtracted, setAiExtracted] = useState(null);
    /** Editable copy of extracted data for review */
    const [aiEdited, setAiEdited] = useState({});
    /** @type {{ type: 'ok' | 'err'; text: string } | null} */
    const [aiFeedback, setAiFeedback] = useState(null);

    const meta = useMemo(() => findCategory(scope, slug), [scope, slug]);
    const titleKey = slug ? titleKeyForCategory(slug) : 'ghg.unknownCategory';
    const demoTonnes = meta?.demoTonnes ?? null;
    const isStationaryCombustion = Boolean(slug === 'stationary-combustion' && scope === 1);

    const stationaryExtraPastFuels = useMemo(() => {
        const presetLower = new Set(STATIONARY_FUEL_SELECT_PRESETS.map((p) => p.value.toLowerCase()));
        const seen = new Set();
        const out = [];
        for (const raw of lookupPastActivityTypes) {
            const s = String(raw).trim();
            if (!s) continue;
            const key = s.toLowerCase();
            if (presetLower.has(key)) continue;
            if (seen.has(key)) continue;
            seen.add(key);
            out.push(s);
        }
        return out.sort((a, b) => a.localeCompare(b));
    }, [lookupPastActivityTypes]);

    useEffect(() => {
        if (!isStationaryCombustion || !hasApi || !getAuthToken()) return;
        let cancelled = false;
        getStationaryCombustionLookupOptions()
            .then((opts) => {
                if (cancelled) return;
                const localNames = (user?.organizationId ? readSitesForOrganization(user.organizationId) : [])
                    .map((s) => (typeof s.name === 'string' ? s.name.trim() : ''))
                    .filter(Boolean);
                const fac = new Set([...(opts.facilities || []), ...localNames]);
                setLookupFacilities([...fac].sort((a, b) => a.localeCompare(b)));
                setLookupAssets([...(opts.assets || [])].sort((a, b) => a.localeCompare(b)));
                setLookupPastActivityTypes(
                    Array.isArray(opts.pastActivityTypes) ? opts.pastActivityTypes : []
                );
            })
            .catch(() => {
                if (cancelled) return;
                const localNames = (user?.organizationId ? readSitesForOrganization(user.organizationId) : [])
                    .map((s) => (typeof s.name === 'string' ? s.name.trim() : ''))
                    .filter(Boolean);
                setLookupFacilities([...new Set(localNames)].sort((a, b) => a.localeCompare(b)));
                setLookupAssets([]);
                setLookupPastActivityTypes([]);
            });
        return () => {
            cancelled = true;
        };
    }, [isStationaryCombustion, hasApi, user?.organizationId]);

    const loadEntries = useCallback(async () => {
        if (!hasApi || !slug) return;
        if (!getAuthToken()) {
            setEntries([]);
            return;
        }
        setListLoading(true);
        setListError('');
        try {
            const { data } = await getGhgCategoryEntries(scope, slug, { limit: '100' });
            setEntries(Array.isArray(data) ? data : []);
        } catch (e) {
            setListError(e?.message || t('ghg.loadError'));
            setEntries([]);
        } finally {
            setListLoading(false);
        }
    }, [hasApi, scope, slug, t]);

    useEffect(() => {
        if (mainTab === 'view' && hasApi) {
            loadEntries();
        }
        setSelectedIds([]);
        setViewSearch('');
        setDeleteFeedback(null);
    }, [mainTab, hasApi, loadEntries]);

    useEffect(() => {
        setAddStep(null);
        if (slug === 'stationary-combustion' && scope === 1) {
            setStFuelSelectKey('Diesel');
            setStFuelUsed('Diesel');
        }
    }, [slug, scopeNum, scope]);

    useEffect(() => {
        if (addStep !== 'form') setStManualPhase('edit');
    }, [addStep]);

    useEffect(() => {
        if (addStep !== 'bulk') {
            setBulkStep('file');
            setBulkReviewRows([]);
            setBulkFile(null);
        }
    }, [addStep]);

    const liveTotalTonnes = useMemo(() => {
        if (!entries.length) return null;
        const kg = entries.reduce((s, e) => s + (Number(e.co2e) || 0), 0);
        return kg / 1000;
    }, [entries]);

    const filteredEntries = useMemo(() => {
        if (!viewSearch.trim()) return entries;
        const q = viewSearch.toLowerCase();
        return entries.filter((e) => {
            const fields = [
                e.id,
                e.siteName,
                e.category,
                e.activityType,
                e.activityUnit,
                e.notes,
                e.ghgCategorySlug,
                e.dataEntryChannel,
                userLabel(e.user),
            ];
            return fields.some((f) => f && String(f).toLowerCase().includes(q));
        });
    }, [entries, viewSearch]);

    const allFilteredSelected = filteredEntries.length > 0 && filteredEntries.every((e) => selectedIds.includes(e.id));

    const toggleSelectAll = () => {
        if (allFilteredSelected) {
            const ids = new Set(filteredEntries.map((e) => e.id));
            setSelectedIds((prev) => prev.filter((id) => !ids.has(id)));
        } else {
            const ids = filteredEntries.map((e) => e.id).filter(Boolean);
            setSelectedIds((prev) => Array.from(new Set([...prev, ...ids])));
        }
    };

    const toggleSelect = (id) => {
        setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
    };

    const handleDeleteSelected = async () => {
        if (!selectedIds.length) return;
        setDeleting(true);
        setDeleteFeedback(null);
        try {
            if (selectedIds.length === 1) {
                await deleteEmission(selectedIds[0]);
            } else {
                await deleteEmissionsBulk(selectedIds);
            }
            setSelectedIds([]);
            await loadEntries();
            setDeleteFeedback({ type: 'ok', text: t('ghg.view.deleteSuccess', { count: selectedIds.length }) });
        } catch (err) {
            setDeleteFeedback({ type: 'err', text: err?.message || t('ghg.view.deleteFailed') });
        } finally {
            setDeleting(false);
        }
    };

    const handleDownloadStationaryTemplate = async () => {
        setBulkFeedback(null);
        try {
            await downloadStationaryCombustionTemplate();
            setBulkFeedback({ type: 'ok', text: t('ghg.stationary.templateDownloaded') });
        } catch (err) {
            setBulkFeedback({ type: 'err', text: err?.message || t('ghg.stationary.templateDownloadError') });
        }
    };

    const updateBulkRowInput = (clientId, field, rawValue) => {
        setBulkReviewRows((prev) =>
            prev.map((row) => {
                if (row.clientId !== clientId) return row;
                const next = { ...row, input: { ...row.input, [field]: rawValue }, status: 'edited', errors: [] };
                return next;
            })
        );
    };

    const handleBulkPreviewFile = async () => {
        if (!bulkFile) return;
        setBulkUploading(true);
        setBulkFeedback(null);
        try {
            const data = await previewStationaryCombustionBulk(bulkFile);
            const rows = Array.isArray(data.rows) ? data.rows : [];
            setBulkReviewRows(
                rows.map((r) => ({
                    clientId: `b-${r.excelRow}-${Math.random().toString(36).slice(2, 9)}`,
                    excelRow: r.excelRow,
                    status: r.status,
                    errors: Array.isArray(r.errors) ? r.errors : [],
                    input: { ...(r.input || {}) },
                    mappedPreview: r.mappedPreview,
                }))
            );
            setBulkStep('review');
            setBulkFeedback({
                type: 'ok',
                text: t('ghg.stationary.bulkPreviewReady', {
                    total: data.summary?.total ?? rows.length,
                    valid: data.summary?.validCount ?? 0,
                    invalid: data.summary?.invalidCount ?? 0,
                }),
            });
        } catch (err) {
            setBulkFeedback({ type: 'err', text: err?.message || t('ghg.stationary.bulkError') });
        } finally {
            setBulkUploading(false);
        }
    };

    const handleBulkConfirmImport = async () => {
        if (!bulkReviewRows.length) return;
        setBulkUploading(true);
        setBulkFeedback(null);
        try {
            const rows = bulkReviewRows.map((r) => {
                const q = parseFloat(String(r.input.fuelUsedQuantity).replace(',', '.'));
                return {
                    asset: String(r.input.asset ?? '').trim(),
                    fuelUsed: String(r.input.fuelUsed ?? '').trim(),
                    fuelUsedQuantity: Number.isFinite(q) && q > 0 ? q : r.input.fuelUsedQuantity,
                    fuelUsedUnit: String(r.input.fuelUsedUnit ?? '').trim(),
                    facility: String(r.input.facility ?? '').trim(),
                    dateOfTransaction: r.input.dateOfTransaction,
                    notes: r.input.notes ? String(r.input.notes).trim() : undefined,
                    excelRow: r.excelRow,
                };
            });
            const data = await confirmStationaryCombustionBulk(rows);
            const created = data.createdCount ?? 0;
            const failed = data.failedCount ?? 0;
            const rowErrors = Array.isArray(data.rowErrors) ? data.rowErrors.filter(Boolean) : [];
            const summary =
                failed > 0
                    ? t('ghg.stationary.bulkPartial', { created, failed })
                    : t('ghg.stationary.bulkOk', { created });
            const detail = rowErrors.length ? `\n${rowErrors.join('\n')}` : '';
            setBulkFeedback({
                type: failed > 0 ? 'err' : 'ok',
                text: `${summary}${detail}`,
            });
            setBulkStep('file');
            setBulkReviewRows([]);
            setBulkFile(null);
            await loadEntries();
            if (created > 0) {
                navigate('/', {
                    replace: false,
                    state: { fromSubmit: true, submitMessage: t('ghg.stationary.dashboardAfterBulk') },
                });
            }
        } catch (err) {
            setBulkFeedback({ type: 'err', text: err?.message || t('ghg.stationary.bulkError') });
        } finally {
            setBulkUploading(false);
        }
    };

    const validateStationaryManual = () => {
        const amount = parseFloat(String(activityAmount).replace(',', '.'));
        if (!Number.isFinite(amount) || amount <= 0) {
            setSubmitFeedback({ type: 'err', text: t('ghg.form.invalidAmount') });
            return false;
        }
        if (!stAsset.trim() && !stFacility.trim()) {
            setSubmitFeedback({ type: 'err', text: t('ghg.stationary.assetOrFacilityRequired') });
            return false;
        }
        if (!stFuelUsed.trim()) {
            setSubmitFeedback({ type: 'err', text: t('ghg.stationary.fuelUsedRequired') });
            return false;
        }
        if (!stDate) {
            setSubmitFeedback({ type: 'err', text: t('ghg.stationary.dateRequired') });
            return false;
        }
        return true;
    };

    const handleSubmitForm = async (e) => {
        e.preventDefault();
        if (!hasApi || !slug) return;

        if (isStationaryCombustion && stManualPhase === 'edit') {
            setSubmitFeedback(null);
            if (!validateStationaryManual()) return;
            setStManualPhase('review');
            return;
        }

        setSubmitting(true);
        setSubmitFeedback(null);
        try {
            const amount = parseFloat(String(activityAmount).replace(',', '.'));
            if (!Number.isFinite(amount) || amount <= 0) {
                setSubmitFeedback({ type: 'err', text: t('ghg.form.invalidAmount') });
                setSubmitting(false);
                return;
            }

            let payload;
            if (isStationaryCombustion) {
                if (!validateStationaryManual()) {
                    setSubmitting(false);
                    return;
                }
                payload = {
                    asset: stAsset.trim(),
                    fuelUsed: stFuelUsed.trim(),
                    fuelUsedQuantity: amount,
                    fuelUsedUnit: stFuelUnit,
                    facility: stFacility.trim(),
                    dateOfTransaction: stDate,
                    notes: notes.trim() || undefined,
                    dataEntryChannel: 'FORM',
                };
            } else {
                payload = {
                    activityType: activityType.trim(),
                    activityAmount: amount,
                    activityUnit: activityUnit.trim(),
                    region: region.trim() || 'AE',
                    dataEntryChannel: 'FORM',
                };
                if (billingPeriodStart) payload.billingPeriodStart = new Date(billingPeriodStart).toISOString();
                if (billingPeriodEnd) payload.billingPeriodEnd = new Date(billingPeriodEnd).toISOString();
                if (notes.trim()) payload.notes = notes.trim();
                if (siteName.trim()) payload.siteName = siteName.trim();
            }

            const created = await submitGhgCategoryForm(scope, slug, payload);
            setLastSaved(created);
            setSubmitFeedback({ type: 'ok', text: t('ghg.form.submitSuccess') });
            setStManualPhase('edit');
            await loadEntries();
            if (isStationaryCombustion) {
                navigate('/', {
                    replace: false,
                    state: { fromSubmit: true, submitMessage: t('ghg.stationary.dashboardAfterManual') },
                });
            }
        } catch (err) {
            setSubmitFeedback({ type: 'err', text: err?.message || t('ghg.form.submitError') });
        } finally {
            setSubmitting(false);
        }
    };

    if (!slug || !meta) {
        return (
            <div className="ghg-detail ghg-detail--empty">
                <p>{t('ghg.categoryNotFound')}</p>
                <Link to="/data-input" className="ghg-link-back">
                    {t('ghg.backToGhg')}
                </Link>
            </div>
        );
    }

    return (
        <div className="ghg-detail">
            <button type="button" className="ghg-back-row" onClick={() => navigate('/data-input')}>
                <i className="fas fa-arrow-left" aria-hidden />
                <span>{t('ghg.backToCategories')}</span>
            </button>

            <h1 className="ghg-sr-only">
                {t(titleKey)} — {t('ghg.scopeTab', { n: scope })}
            </h1>

            <nav className="ghg-breadcrumb ghg-breadcrumb--detail" aria-label={t('ghg.breadcrumbAria')}>
                <span>{t('sidebar.ghg')}</span>
                <span className="ghg-breadcrumb-sep ghg-breadcrumb-sep--gt" aria-hidden="true">
                    &gt;
                </span>
                <span>{t('ghg.scopeTab', { n: scope })}</span>
                <span className="ghg-breadcrumb-sep ghg-breadcrumb-sep--gt" aria-hidden="true">
                    &gt;
                </span>
                <span className="ghg-breadcrumb-current">{t(titleKey)}</span>
            </nav>

            <p className="ghg-detail-meta ghg-detail-meta--below-crumb">
                {hasApi ? (
                    <>
                        {t('ghg.categoryTotalLive')}:{' '}
                        <strong>{liveTotalTonnes != null ? formatTonnes(liveTotalTonnes) : formatTonnes(0)}</strong>{' '}
                        {t('ghg.tco2e')}
                        <span className="ghg-detail-meta-muted">
                            {' '}
                            ({t('ghg.demoReference')}: {formatTonnes(demoTonnes)} {t('ghg.tco2e')})
                        </span>
                    </>
                ) : (
                    <>
                        {t('ghg.inventoryPreview')}: <strong>{formatTonnes(demoTonnes)}</strong> {t('ghg.tco2e')}
                    </>
                )}
            </p>

            {!hasApi && (
                <div className="ghg-panel ghg-panel--notice" role="status">
                    <p>{t('ghg.scope3NoApi')}</p>
                </div>
            )}

            <div className="ghg-detail-tabs" role="tablist">
                <button
                    type="button"
                    role="tab"
                    aria-selected={mainTab === 'add'}
                    className={`ghg-detail-tab ${mainTab === 'add' ? 'active' : ''}`}
                    onClick={() => setMainTab('add')}
                >
                    {t('ghg.tabAddData')}
                </button>
                <button
                    type="button"
                    role="tab"
                    aria-selected={mainTab === 'view'}
                    className={`ghg-detail-tab ${mainTab === 'view' ? 'active' : ''}`}
                    onClick={() => {
                        setAddStep(null);
                        setMainTab('view');
                    }}
                >
                    {t('ghg.tabViewData')}
                </button>
            </div>

            {mainTab === 'add' && (
                <>
                    {!addStep && (
                        <section className="ghg-add-choice" aria-labelledby="ghg-add-method-heading">
                            <h2 id="ghg-add-method-heading" className="ghg-add-heading">
                                {t('ghg.addMethodHeading')}
                            </h2>
                            <p className="ghg-add-sub">{t('ghg.addMethodSub')}</p>
                            <div className="ghg-choice-grid">
                                {[
                                    { id: 'form', icon: 'fa-file-pen' },
                                    { id: 'bulk', icon: 'fa-cloud-arrow-up' },
                                    { id: 'ai', icon: 'fa-wand-magic-sparkles' },
                                ].map((m) => (
                                    <article key={m.id} className="ghg-choice-card">
                                        <div className="ghg-choice-card__icon-wrap" aria-hidden="true">
                                            <i className={`fas ${m.icon}`} />
                                        </div>
                                        <h3 className="ghg-choice-card__title">{t(`ghg.method.${m.id}`)}</h3>
                                        <p className="ghg-choice-card__desc">{t(`ghg.method.desc.${m.id}`)}</p>
                                        <button
                                            type="button"
                                            className="ghg-choice-card__start"
                                            onClick={() => setAddStep(m.id)}
                                        >
                                            {t('ghg.method.start')}
                                        </button>
                                    </article>
                                ))}
                            </div>
                        </section>
                    )}

                    {addStep === 'form' && hasApi && (
                        <div className="ghg-method-workspace">
                            <button type="button" className="ghg-back-to-methods" onClick={() => setAddStep(null)}>
                                <i className="fas fa-arrow-left" aria-hidden />
                                <span>{t('ghg.backToMethods')}</span>
                            </button>
                            <form className="ghg-panel ghg-panel-split" onSubmit={handleSubmitForm}>
                                <div className="ghg-panel-col">
                                    <h3 className="ghg-panel-title">{t('ghg.form.questionnaire')}</h3>
                                    {isStationaryCombustion ? (
                                        <p className="ghg-form-hint">{t('ghg.stationary.formIntro')}</p>
                                    ) : (
                                        <p className="ghg-form-hint">{t('ghg.form.climatiqHint')}</p>
                                    )}
                                    {isStationaryCombustion && stManualPhase === 'review' && (
                                        <div className="ghg-review-banner" role="status">
                                            <p>{t('ghg.stationary.reviewBannerManual')}</p>
                                        </div>
                                    )}
                                    {isStationaryCombustion ? (
                                        <>
                                            <div className="ghg-field">
                                                <label htmlFor="ghg-st-asset">{t('ghg.stationary.asset')}</label>
                                                <input
                                                    id="ghg-st-asset"
                                                    list="ghg-stationary-asset-datalist"
                                                    value={stAsset}
                                                    onChange={(ev) => setStAsset(ev.target.value)}
                                                    autoComplete="off"
                                                    placeholder={t('ghg.stationary.assetPlaceholder')}
                                                />
                                                <p className="ghg-form-hint ghg-form-hint--tight">{t('ghg.stationary.assetPickHint')}</p>
                                            </div>
                                            <div className="ghg-field">
                                                <label htmlFor="ghg-st-facility">{t('ghg.stationary.facility')}</label>
                                                <input
                                                    id="ghg-st-facility"
                                                    list="ghg-stationary-facility-datalist"
                                                    value={stFacility}
                                                    onChange={(ev) => setStFacility(ev.target.value)}
                                                    autoComplete="off"
                                                    placeholder={t('ghg.stationary.facilityPlaceholder')}
                                                />
                                                <p className="ghg-form-hint ghg-form-hint--tight">{t('ghg.stationary.facilityPickHint')}</p>
                                            </div>
                                            <p className="ghg-form-hint ghg-form-hint--between-fields">
                                                {t('ghg.stationary.assetOrFacilityRule')}
                                            </p>
                                            <div className="ghg-field">
                                                <label htmlFor="ghg-st-fuel-select">{t('ghg.stationary.fuelUsed')}</label>
                                                <select
                                                    id="ghg-st-fuel-select"
                                                    value={stFuelSelectKey}
                                                    onChange={(ev) => {
                                                        const v = ev.target.value;
                                                        if (v === '__other__') {
                                                            setStFuelSelectKey('__other__');
                                                            setStFuelUsed('');
                                                        } else {
                                                            setStFuelSelectKey(v);
                                                            setStFuelUsed(v);
                                                        }
                                                    }}
                                                >
                                                    {STATIONARY_FUEL_SELECT_PRESETS.map((p) => (
                                                        <option key={p.value} value={p.value}>
                                                            {t(p.labelKey)}
                                                        </option>
                                                    ))}
                                                    {stationaryExtraPastFuels.length > 0 && (
                                                        <optgroup label={t('ghg.stationary.fuelOptionGroupPast')}>
                                                            {stationaryExtraPastFuels.map((name) => (
                                                                <option key={name} value={name}>
                                                                    {name}
                                                                </option>
                                                            ))}
                                                        </optgroup>
                                                    )}
                                                    <option value="__other__">{t('ghg.stationary.fuelOptionOther')}</option>
                                                </select>
                                                <p className="ghg-form-hint ghg-form-hint--tight">
                                                    {t('ghg.stationary.fuelSelectHint')}
                                                </p>
                                                {stFuelSelectKey === '__other__' && (
                                                    <textarea
                                                        id="ghg-st-fuel-custom"
                                                        className="ghg-field-fuel-custom"
                                                        rows={3}
                                                        value={stFuelUsed}
                                                        onChange={(ev) => setStFuelUsed(ev.target.value)}
                                                        placeholder={t('ghg.stationary.fuelUsedPlaceholder')}
                                                        aria-label={t('ghg.stationary.fuelCustomAria')}
                                                    />
                                                )}
                                            </div>
                                            <div className="ghg-field-row">
                                                <div className="ghg-field">
                                                    <label htmlFor="ghg-amount">{t('ghg.stationary.fuelUsedQuantity')}</label>
                                                    <input
                                                        id="ghg-amount"
                                                        type="text"
                                                        inputMode="decimal"
                                                        value={activityAmount}
                                                        onChange={(ev) => setActivityAmount(ev.target.value)}
                                                    />
                                                </div>
                                                <div className="ghg-field">
                                                    <label htmlFor="ghg-unit">{t('ghg.stationary.fuelUsedUnit')}</label>
                                                    <select
                                                        id="ghg-unit"
                                                        value={stFuelUnit}
                                                        onChange={(ev) => setStFuelUnit(ev.target.value)}
                                                    >
                                                        {STATIONARY_TEMPLATE_UNITS.map((u) => (
                                                            <option key={u} value={u}>
                                                                {u}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>
                                            </div>
                                            <div className="ghg-field">
                                                <label htmlFor="ghg-st-date">{t('ghg.stationary.dateOfTransaction')}</label>
                                                <input
                                                    id="ghg-st-date"
                                                    type="date"
                                                    value={stDate}
                                                    onChange={(ev) => setStDate(ev.target.value)}
                                                    required
                                                />
                                            </div>
                                            <div className="ghg-field">
                                                <label htmlFor="ghg-notes">{t('ghg.form.notes')}</label>
                                                <textarea
                                                    id="ghg-notes"
                                                    rows={2}
                                                    value={notes}
                                                    onChange={(ev) => setNotes(ev.target.value)}
                                                />
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <div className="ghg-field">
                                                <label htmlFor="ghg-activity-type">{t('ghg.form.activityType')}</label>
                                                <input
                                                    id="ghg-activity-type"
                                                    value={activityType}
                                                    onChange={(ev) => setActivityType(ev.target.value)}
                                                    autoComplete="off"
                                                />
                                            </div>
                                            <div className="ghg-field-row">
                                                <div className="ghg-field">
                                                    <label htmlFor="ghg-amount">{t('ghg.form.activityAmount')}</label>
                                                    <input
                                                        id="ghg-amount"
                                                        type="text"
                                                        inputMode="decimal"
                                                        value={activityAmount}
                                                        onChange={(ev) => setActivityAmount(ev.target.value)}
                                                    />
                                                </div>
                                                <div className="ghg-field">
                                                    <label htmlFor="ghg-unit">{t('ghg.form.activityUnit')}</label>
                                                    <input
                                                        id="ghg-unit"
                                                        value={activityUnit}
                                                        onChange={(ev) => setActivityUnit(ev.target.value)}
                                                    />
                                                </div>
                                            </div>
                                            <div className="ghg-field">
                                                <label htmlFor="ghg-region">{t('ghg.form.region')}</label>
                                                <input
                                                    id="ghg-region"
                                                    value={region}
                                                    onChange={(ev) => setRegion(ev.target.value)}
                                                    placeholder="AE"
                                                />
                                            </div>
                                            <div className="ghg-field-row">
                                                <div className="ghg-field">
                                                    <label htmlFor="ghg-bps">{t('ghg.form.periodStart')}</label>
                                                    <input
                                                        id="ghg-bps"
                                                        type="date"
                                                        value={billingPeriodStart}
                                                        onChange={(ev) => setBillingPeriodStart(ev.target.value)}
                                                    />
                                                </div>
                                                <div className="ghg-field">
                                                    <label htmlFor="ghg-bpe">{t('ghg.form.periodEnd')}</label>
                                                    <input
                                                        id="ghg-bpe"
                                                        type="date"
                                                        value={billingPeriodEnd}
                                                        onChange={(ev) => setBillingPeriodEnd(ev.target.value)}
                                                    />
                                                </div>
                                            </div>
                                            <div className="ghg-field">
                                                <label htmlFor="ghg-site">{t('ghg.form.siteName')}</label>
                                                <input
                                                    id="ghg-site"
                                                    value={siteName}
                                                    onChange={(ev) => setSiteName(ev.target.value)}
                                                />
                                            </div>
                                            <div className="ghg-field">
                                                <label htmlFor="ghg-notes">{t('ghg.form.notes')}</label>
                                                <textarea
                                                    id="ghg-notes"
                                                    rows={2}
                                                    value={notes}
                                                    onChange={(ev) => setNotes(ev.target.value)}
                                                />
                                            </div>
                                        </>
                                    )}
                                    {submitFeedback && (
                                        <p
                                            className={
                                                submitFeedback.type === 'err' ? 'ghg-msg ghg-msg-err' : 'ghg-msg ghg-msg-ok'
                                            }
                                        >
                                            {submitFeedback.text}
                                        </p>
                                    )}
                                    <div className="ghg-form-actions ghg-form-actions--split">
                                        {isStationaryCombustion && stManualPhase === 'review' && (
                                            <button
                                                type="button"
                                                className="ghg-btn ghg-btn-secondary"
                                                disabled={submitting}
                                                onClick={() => {
                                                    setStManualPhase('edit');
                                                    setSubmitFeedback(null);
                                                }}
                                            >
                                                {t('ghg.stationary.backToEdit')}
                                            </button>
                                        )}
                                        <button type="submit" className="ghg-btn ghg-btn-primary" disabled={submitting}>
                                            {submitting
                                                ? t('ghg.form.submitting')
                                                : !isStationaryCombustion
                                                  ? t('ghg.form.submit')
                                                  : stManualPhase === 'edit'
                                                    ? t('ghg.stationary.continueToReview')
                                                    : t('ghg.stationary.submitToInventory')}
                                        </button>
                                    </div>
                                </div>
                                <div className="ghg-panel-col ghg-panel-col--accent">
                                    <h3 className="ghg-panel-title">{t('ghg.form.emissionPreview')}</h3>
                                    {lastSaved ? (
                                        <dl className="ghg-preview-dl">
                                            <dt>{t('ghg.form.previewCo2e')}</dt>
                                            <dd>
                                                {formatTonnes((lastSaved.co2e || 0) / 1000)} {t('ghg.tco2e')}
                                            </dd>
                                            <dt>{t('ghg.form.previewFactor')}</dt>
                                            <dd>{lastSaved.emissionFactor ?? '—'}</dd>
                                        </dl>
                                    ) : (
                                        <p className="ghg-placeholder-text">{t('ghg.form.previewPlaceholder')}</p>
                                    )}
                                </div>
                            </form>
                        </div>
                    )}

                    {addStep === 'form' && !hasApi && (
                        <div className="ghg-method-workspace">
                            <button type="button" className="ghg-back-to-methods" onClick={() => setAddStep(null)}>
                                <i className="fas fa-arrow-left" aria-hidden />
                                <span>{t('ghg.backToMethods')}</span>
                            </button>
                            <div className="ghg-panel">
                                <p className="ghg-placeholder-text">{t('ghg.scope3NoApi')}</p>
                            </div>
                        </div>
                    )}

                    {addStep === 'bulk' && hasApi && isStationaryCombustion && (
                        <div className="ghg-method-workspace">
                            <button type="button" className="ghg-back-to-methods" onClick={() => setAddStep(null)}>
                                <i className="fas fa-arrow-left" aria-hidden />
                                <span>{t('ghg.backToMethods')}</span>
                            </button>
                            <div className="ghg-panel">
                                <h3 className="ghg-panel-title">{t('ghg.bulk.title')}</h3>
                                {bulkStep === 'file' && (
                                    <>
                                        <p className="ghg-placeholder-text">{t('ghg.stationary.bulkIntro')}</p>
                                        <ul className="ghg-bulk-list">
                                            {STATIONARY_TEMPLATE_COLUMNS.map((col) => (
                                                <li key={col}>
                                                    <code className="ghg-code">{col}</code>
                                                </li>
                                            ))}
                                        </ul>
                                        <div className="ghg-bulk-actions">
                                            <button
                                                type="button"
                                                className="ghg-btn ghg-btn-secondary"
                                                onClick={handleDownloadStationaryTemplate}
                                            >
                                                {t('ghg.stationary.downloadTemplate')}
                                            </button>
                                        </div>
                                        <div className="ghg-field ghg-field--bulk-file">
                                            <label htmlFor="ghg-bulk-file">{t('ghg.stationary.selectFile')}</label>
                                            <input
                                                id="ghg-bulk-file"
                                                type="file"
                                                accept=".csv,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
                                                onChange={(ev) => {
                                                    const f = ev.target.files?.[0];
                                                    setBulkFile(f || null);
                                                    setBulkFeedback(null);
                                                    setBulkStep('file');
                                                    setBulkReviewRows([]);
                                                }}
                                            />
                                        </div>
                                        <div className="ghg-form-actions">
                                            <button
                                                type="button"
                                                className="ghg-btn ghg-btn-primary"
                                                disabled={!bulkFile || bulkUploading}
                                                onClick={handleBulkPreviewFile}
                                            >
                                                {bulkUploading
                                                    ? t('ghg.stationary.bulkParsing')
                                                    : t('ghg.stationary.bulkParseReview')}
                                            </button>
                                        </div>
                                    </>
                                )}
                                {bulkStep === 'review' && (
                                    <>
                                        <p className="ghg-form-hint">{t('ghg.stationary.bulkReviewIntro')}</p>
                                        <div className="ghg-bulk-preview-wrap">
                                            <table className="ghg-bulk-preview-table">
                                                <thead>
                                                    <tr>
                                                        <th>#</th>
                                                        <th>{t('ghg.stationary.asset')}</th>
                                                        <th>{t('ghg.stationary.fuelUsed')}</th>
                                                        <th>{t('ghg.stationary.fuelUsedQuantity')}</th>
                                                        <th>{t('ghg.stationary.fuelUsedUnit')}</th>
                                                        <th>{t('ghg.stationary.facility')}</th>
                                                        <th>{t('ghg.stationary.dateOfTransaction')}</th>
                                                        <th>{t('ghg.stationary.bulkColStatus')}</th>
                                                        <th>{t('ghg.stationary.bulkColMapped')}</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {bulkReviewRows.map((row) => (
                                                        <tr
                                                            key={row.clientId}
                                                            className={
                                                                row.status === 'invalid'
                                                                    ? 'ghg-bulk-preview-row ghg-bulk-preview-row--invalid'
                                                                    : 'ghg-bulk-preview-row'
                                                            }
                                                        >
                                                            <td>{row.excelRow}</td>
                                                            <td>
                                                                <input
                                                                    className="ghg-bulk-cell-input"
                                                                    list="ghg-stationary-asset-datalist"
                                                                    value={row.input.asset ?? ''}
                                                                    onChange={(ev) =>
                                                                        updateBulkRowInput(row.clientId, 'asset', ev.target.value)
                                                                    }
                                                                />
                                                            </td>
                                                            <td>
                                                                <input
                                                                    className="ghg-bulk-cell-input"
                                                                    list="ghg-stationary-fuel-datalist"
                                                                    value={row.input.fuelUsed ?? ''}
                                                                    onChange={(ev) =>
                                                                        updateBulkRowInput(row.clientId, 'fuelUsed', ev.target.value)
                                                                    }
                                                                />
                                                            </td>
                                                            <td>
                                                                <input
                                                                    className="ghg-bulk-cell-input ghg-bulk-cell-input--num"
                                                                    value={row.input.fuelUsedQuantity ?? ''}
                                                                    onChange={(ev) =>
                                                                        updateBulkRowInput(
                                                                            row.clientId,
                                                                            'fuelUsedQuantity',
                                                                            ev.target.value
                                                                        )
                                                                    }
                                                                />
                                                            </td>
                                                            <td>
                                                                <input
                                                                    className="ghg-bulk-cell-input"
                                                                    value={row.input.fuelUsedUnit ?? ''}
                                                                    onChange={(ev) =>
                                                                        updateBulkRowInput(
                                                                            row.clientId,
                                                                            'fuelUsedUnit',
                                                                            ev.target.value
                                                                        )
                                                                    }
                                                                />
                                                            </td>
                                                            <td>
                                                                <input
                                                                    className="ghg-bulk-cell-input"
                                                                    list="ghg-stationary-facility-datalist"
                                                                    value={row.input.facility ?? ''}
                                                                    onChange={(ev) =>
                                                                        updateBulkRowInput(row.clientId, 'facility', ev.target.value)
                                                                    }
                                                                />
                                                            </td>
                                                            <td>
                                                                <input
                                                                    className="ghg-bulk-cell-input"
                                                                    value={row.input.dateOfTransaction ?? ''}
                                                                    onChange={(ev) =>
                                                                        updateBulkRowInput(
                                                                            row.clientId,
                                                                            'dateOfTransaction',
                                                                            ev.target.value
                                                                        )
                                                                    }
                                                                />
                                                            </td>
                                                            <td>
                                                                <span className={`ghg-bulk-status ghg-bulk-status--${row.status}`}>
                                                                    {row.status === 'edited'
                                                                        ? t('ghg.stationary.bulkStatusEdited')
                                                                        : row.status === 'valid'
                                                                          ? t('ghg.stationary.bulkStatusValid')
                                                                          : t('ghg.stationary.bulkStatusInvalid')}
                                                                </span>
                                                                {row.errors?.length > 0 && (
                                                                    <p className="ghg-bulk-row-err">{row.errors.join(' ')}</p>
                                                                )}
                                                            </td>
                                                            <td className="ghg-bulk-mapped-cell">
                                                                {row.mappedPreview ? (
                                                                    <span className="ghg-bulk-mapped">
                                                                        {row.mappedPreview.activityType} ·{' '}
                                                                        {formatTonnes(row.mappedPreview.activityAmount)}{' '}
                                                                        {row.mappedPreview.activityUnit}
                                                                    </span>
                                                                ) : (
                                                                    '—'
                                                                )}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                        <p className="ghg-form-hint ghg-form-hint--tight">{t('ghg.stationary.bulkEditedHint')}</p>
                                        <div className="ghg-form-actions ghg-form-actions--split">
                                            <button
                                                type="button"
                                                className="ghg-btn ghg-btn-secondary"
                                                disabled={bulkUploading}
                                                onClick={() => {
                                                    setBulkStep('file');
                                                    setBulkReviewRows([]);
                                                    setBulkFeedback(null);
                                                }}
                                            >
                                                {t('ghg.stationary.bulkBackToFile')}
                                            </button>
                                            <button
                                                type="button"
                                                className="ghg-btn ghg-btn-primary"
                                                disabled={bulkUploading || bulkReviewRows.length === 0}
                                                onClick={handleBulkConfirmImport}
                                            >
                                                {bulkUploading
                                                    ? t('ghg.stationary.bulkConfirming')
                                                    : t('ghg.stationary.bulkConfirmImport')}
                                            </button>
                                        </div>
                                    </>
                                )}
                                {bulkFeedback && (
                                    <p
                                        className={
                                            bulkFeedback.type === 'err'
                                                ? 'ghg-msg ghg-msg-err ghg-msg--pre'
                                                : 'ghg-msg ghg-msg-ok ghg-msg--pre'
                                        }
                                    >
                                        {bulkFeedback.text}
                                    </p>
                                )}
                            </div>
                        </div>
                    )}

                    {addStep === 'bulk' && hasApi && !isStationaryCombustion && (
                        <div className="ghg-method-workspace">
                            <button type="button" className="ghg-back-to-methods" onClick={() => setAddStep(null)}>
                                <i className="fas fa-arrow-left" aria-hidden />
                                <span>{t('ghg.backToMethods')}</span>
                            </button>
                            <div className="ghg-panel">
                                <h3 className="ghg-panel-title">{t('ghg.bulk.title')}</h3>
                                <p className="ghg-placeholder-text">{t('ghg.bulk.placeholder')}</p>
                                <ul className="ghg-bulk-list">
                                    <li>{t('ghg.bulk.template')}</li>
                                    <li>{t('ghg.bulk.dropzone')}</li>
                                    <li>{t('ghg.bulk.validation')}</li>
                                    <li>{t('ghg.bulk.formats')}</li>
                                </ul>
                            </div>
                        </div>
                    )}

                    {addStep === 'ai' && (
                        <div className="ghg-method-workspace">
                            <button type="button" className="ghg-back-to-methods" onClick={() => { setAddStep(null); setAiStep('upload'); setAiFile(null); setAiExtracted(null); setAiFeedback(null); }}>
                                <i className="fas fa-arrow-left" aria-hidden />
                                <span>{t('ghg.backToMethods')}</span>
                            </button>
                            <div className="ghg-panel">
                                <h3 className="ghg-panel-title">{t('ghg.ai.title')}</h3>

                                {/* Step 1: Upload receipt */}
                                {aiStep === 'upload' && (
                                    <div className="ghg-ai-upload">
                                        <p className="ghg-ai-desc">{t('ghg.ai.uploadDesc')}</p>
                                        <label className="ghg-dropzone">
                                            <input
                                                type="file"
                                                accept=".pdf,.jpg,.jpeg,.png"
                                                style={{ display: 'none' }}
                                                onChange={(e) => { setAiFile(e.target.files?.[0] || null); setAiFeedback(null); }}
                                            />
                                            <i className="fas fa-cloud-upload-alt ghg-dropzone-icon" aria-hidden />
                                            <span>{aiFile ? aiFile.name : t('ghg.ai.dropzoneText')}</span>
                                        </label>
                                        {aiFeedback?.type === 'err' && (
                                            <p className="ghg-msg ghg-msg-error">{aiFeedback.text}</p>
                                        )}
                                        <button
                                            type="button"
                                            className="ghg-btn ghg-btn-primary"
                                            disabled={!aiFile}
                                            onClick={async () => {
                                                setAiStep('extracting');
                                                setAiFeedback(null);
                                                try {
                                                    const result = await aiExtractReceipt(aiFile);
                                                    setAiExtracted(result);
                                                    setAiEdited({
                                                        asset: result.asset || '',
                                                        fuelUsed: result.fuelUsed || '',
                                                        fuelUsedQuantity: result.fuelUsedQuantity || '',
                                                        fuelUsedUnit: result.fuelUsedUnit || '',
                                                        facility: result.facility || '',
                                                        dateOfTransaction: result.dateOfTransaction || '',
                                                        notes: result.notes || '',
                                                    });
                                                    setAiStep('review');
                                                } catch (err) {
                                                    setAiFeedback({ type: 'err', text: err.message || 'Extraction failed' });
                                                    setAiStep('upload');
                                                }
                                            }}
                                        >
                                            <i className="fas fa-wand-magic-sparkles" aria-hidden /> {t('ghg.ai.extractBtn')}
                                        </button>
                                    </div>
                                )}

                                {/* Step 2: Extracting (loading) */}
                                {aiStep === 'extracting' && (
                                    <div className="ghg-ai-loading">
                                        <i className="fas fa-spinner fa-spin ghg-ai-spinner" aria-hidden />
                                        <p>{t('ghg.ai.extracting')}</p>
                                    </div>
                                )}

                                {/* Step 3: Review & edit extracted data */}
                                {aiStep === 'review' && (
                                    <div className="ghg-ai-review">
                                        {aiExtracted?.confidence && (
                                            <p className={`ghg-ai-confidence ghg-ai-confidence--${aiExtracted.confidence}`}>
                                                {t('ghg.ai.confidence')}: <strong>{t(`ghg.ai.confidence_${aiExtracted.confidence}`)}</strong>
                                            </p>
                                        )}
                                        <p className="ghg-ai-review-hint">{t('ghg.ai.reviewHint')}</p>
                                        <div className="ghg-form-grid">
                                            <label className="ghg-field">
                                                <span className="ghg-label">{t('ghg.stationary.asset')}</span>
                                                <input className="ghg-input" value={aiEdited.asset} onChange={(e) => setAiEdited({ ...aiEdited, asset: e.target.value })} />
                                            </label>
                                            <label className="ghg-field">
                                                <span className="ghg-label">{t('ghg.stationary.fuelUsed')}</span>
                                                <input className="ghg-input" value={aiEdited.fuelUsed} onChange={(e) => setAiEdited({ ...aiEdited, fuelUsed: e.target.value })} />
                                            </label>
                                            <label className="ghg-field">
                                                <span className="ghg-label">{t('ghg.stationary.fuelUsedQuantity')}</span>
                                                <input className="ghg-input" type="number" step="any" min="0" value={aiEdited.fuelUsedQuantity} onChange={(e) => setAiEdited({ ...aiEdited, fuelUsedQuantity: e.target.value })} />
                                            </label>
                                            <label className="ghg-field">
                                                <span className="ghg-label">{t('ghg.stationary.fuelUsedUnit')}</span>
                                                <select className="ghg-input" value={aiEdited.fuelUsedUnit} onChange={(e) => setAiEdited({ ...aiEdited, fuelUsedUnit: e.target.value })}>
                                                    {STATIONARY_TEMPLATE_UNITS.map((u) => (
                                                        <option key={u} value={u}>{u}</option>
                                                    ))}
                                                </select>
                                            </label>
                                            <label className="ghg-field">
                                                <span className="ghg-label">{t('ghg.stationary.facility')}</span>
                                                <input className="ghg-input" value={aiEdited.facility} onChange={(e) => setAiEdited({ ...aiEdited, facility: e.target.value })} />
                                            </label>
                                            <label className="ghg-field">
                                                <span className="ghg-label">{t('ghg.stationary.dateOfTransaction')}</span>
                                                <input className="ghg-input" value={aiEdited.dateOfTransaction} onChange={(e) => setAiEdited({ ...aiEdited, dateOfTransaction: e.target.value })} placeholder="DD/MM/YYYY" />
                                            </label>
                                            <label className="ghg-field ghg-field--full">
                                                <span className="ghg-label">{t('ghg.form.notes')}</span>
                                                <textarea className="ghg-input" rows={2} value={aiEdited.notes} onChange={(e) => setAiEdited({ ...aiEdited, notes: e.target.value })} />
                                            </label>
                                        </div>
                                        {aiFeedback?.type === 'err' && (
                                            <p className="ghg-msg ghg-msg-error">{aiFeedback.text}</p>
                                        )}
                                        <div className="ghg-ai-actions">
                                            <button
                                                type="button"
                                                className="ghg-btn ghg-btn-secondary"
                                                onClick={() => { setAiStep('upload'); setAiFile(null); setAiExtracted(null); setAiFeedback(null); }}
                                            >
                                                <i className="fas fa-redo" aria-hidden /> {t('ghg.ai.reupload')}
                                            </button>
                                            <button
                                                type="button"
                                                className="ghg-btn ghg-btn-primary"
                                                disabled={!aiEdited.fuelUsed || !aiEdited.fuelUsedQuantity || !aiEdited.fuelUsedUnit}
                                                onClick={async () => {
                                                    setAiStep('confirming');
                                                    setAiFeedback(null);
                                                    try {
                                                        const payload = {
                                                            asset: aiEdited.asset,
                                                            fuelUsed: aiEdited.fuelUsed,
                                                            fuelUsedQuantity: Number(aiEdited.fuelUsedQuantity),
                                                            fuelUsedUnit: aiEdited.fuelUsedUnit,
                                                            facility: aiEdited.facility,
                                                            dateOfTransaction: aiEdited.dateOfTransaction,
                                                            notes: aiEdited.notes,
                                                        };
                                                        const result = await aiConfirmReceipt(payload);
                                                        setLastSaved(result);
                                                        setAiFeedback({ type: 'ok', text: t('ghg.ai.confirmSuccess') });
                                                        setAiStep('done');
                                                        loadEntries();
                                                    } catch (err) {
                                                        setAiFeedback({ type: 'err', text: err.message || 'Confirm failed' });
                                                        setAiStep('review');
                                                    }
                                                }}
                                            >
                                                <i className="fas fa-check" aria-hidden /> {t('ghg.ai.confirmBtn')}
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Step 4: Confirming (loading) */}
                                {aiStep === 'confirming' && (
                                    <div className="ghg-ai-loading">
                                        <i className="fas fa-spinner fa-spin ghg-ai-spinner" aria-hidden />
                                        <p>{t('ghg.ai.confirming')}</p>
                                    </div>
                                )}

                                {/* Step 5: Done — success */}
                                {aiStep === 'done' && (
                                    <div className="ghg-ai-done">
                                        {aiFeedback?.type === 'ok' && (
                                            <p className="ghg-msg ghg-msg-success">{aiFeedback.text}</p>
                                        )}
                                        {lastSaved && (
                                            <p className="ghg-ai-result">
                                                {t('ghg.ai.resultCO2e')}: <strong>{formatTonnes(lastSaved.co2Equivalent ?? lastSaved.totalEmissions)} {t('ghg.tonnes')}</strong>
                                            </p>
                                        )}
                                        <div className="ghg-ai-actions">
                                            <button type="button" className="ghg-btn ghg-btn-secondary" onClick={() => { setAiStep('upload'); setAiFile(null); setAiExtracted(null); setAiFeedback(null); }}>
                                                <i className="fas fa-plus" aria-hidden /> {t('ghg.ai.uploadAnother')}
                                            </button>
                                            <button type="button" className="ghg-btn ghg-btn-primary" onClick={() => { setMainTab('view'); loadEntries(); }}>
                                                <i className="fas fa-table" aria-hidden /> {t('ghg.ai.viewData')}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </>
            )}

            {mainTab === 'view' && (
                <div className="ghg-panel">
                    <div className="ghg-view-toolbar">
                        <div className="ghg-view-search-wrap">
                            <i className="fas fa-search ghg-view-search-icon" aria-hidden />
                            <input
                                className="ghg-search"
                                type="text"
                                placeholder={t('ghg.view.searchPlaceholder')}
                                value={viewSearch}
                                onChange={(ev) => setViewSearch(ev.target.value)}
                            />
                        </div>
                        <button type="button" className="ghg-btn ghg-btn-secondary" onClick={loadEntries} disabled={listLoading || !hasApi}>
                            <i className="fas fa-rotate-right" aria-hidden /> {listLoading ? t('ghg.view.refreshing') : t('ghg.view.refresh')}
                        </button>
                        {selectedIds.length > 0 && (
                            <button
                                type="button"
                                className="ghg-btn ghg-btn-danger"
                                disabled={deleting}
                                onClick={handleDeleteSelected}
                            >
                                {deleting ? (
                                    <><i className="fas fa-spinner fa-spin" aria-hidden /> {t('ghg.view.deleting')}</>
                                ) : (
                                    <><i className="fas fa-trash-alt" aria-hidden /> {t('ghg.view.deleteSelected', { count: selectedIds.length })}</>
                                )}
                            </button>
                        )}
                    </div>
                    {deleteFeedback && (
                        <p className={deleteFeedback.type === 'err' ? 'ghg-msg ghg-msg-err' : 'ghg-msg ghg-msg-ok'}>
                            {deleteFeedback.text}
                            <button type="button" className="ghg-msg-dismiss" onClick={() => setDeleteFeedback(null)} aria-label="dismiss">×</button>
                        </p>
                    )}
                    {listError && <p className="ghg-msg ghg-msg-err">{listError}</p>}
                    <div className="ghg-table-wrap ghg-table-wrap--slider">
                        <table className="ghg-table">
                            <thead>
                                <tr>
                                    <th className="ghg-th-check">
                                        <input
                                            type="checkbox"
                                            checked={allFilteredSelected}
                                            onChange={toggleSelectAll}
                                            disabled={!filteredEntries.length}
                                            aria-label={t('ghg.view.selectAll')}
                                        />
                                    </th>
                                    {['entryId', 'period', 'facility', 'category', 'quantity', 'unit', 'emissions', 'uploadedBy', 'uploadDate', 'actions'].map((k) => (
                                        <th key={k}>{t(`ghg.view.col.${k}`)}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {!hasApi && (
                                    <tr>
                                        <td colSpan={12} className="ghg-table-empty">
                                            {t('ghg.scope3NoApi')}
                                        </td>
                                    </tr>
                                )}
                                {hasApi && listLoading && (
                                    <tr>
                                        <td colSpan={12} className="ghg-table-empty">
                                            {t('ghg.view.loading')}
                                        </td>
                                    </tr>
                                )}
                                {hasApi && !listLoading && entries.length === 0 && (
                                    <tr>
                                        <td colSpan={12} className="ghg-table-empty">
                                            {t('ghg.view.empty')}
                                        </td>
                                    </tr>
                                )}
                                {hasApi && !listLoading && entries.length > 0 && filteredEntries.length === 0 && (
                                    <tr>
                                        <td colSpan={12} className="ghg-table-empty">
                                            {t('ghg.view.noResults')}
                                        </td>
                                    </tr>
                                )}
                                {hasApi &&
                                    !listLoading &&
                                    filteredEntries.map((row) => (
                                        <tr key={row.id} className={selectedIds.includes(row.id) ? 'ghg-row-selected' : ''}>
                                            <td>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedIds.includes(row.id)}
                                                    onChange={() => toggleSelect(row.id)}
                                                    aria-label={t('ghg.view.selectEntry')}
                                                />
                                            </td>
                                            <td className="ghg-td-id">{row.id?.slice(0, 8)}…</td>
                                            <td>{formatDate(row.billingPeriodStart || row.calculatedAt, i18n.language)}</td>
                                            <td>{row.siteName || '—'}</td>
                                            <td>{row.category}</td>
                                            <td>{row.activityAmount}</td>
                                            <td>{row.activityUnit}</td>
                                            <td>{formatTonnes((row.co2e || 0) / 1000)} tCO₂e</td>
                                            <td>{userLabel(row.user)}</td>
                                            <td>{formatDate(row.calculatedAt, i18n.language)}</td>
                                            <td>
                                                <button
                                                    type="button"
                                                    className="ghg-btn-icon ghg-btn-icon--danger"
                                                    title={t('ghg.view.deleteEntry')}
                                                    disabled={deleting}
                                                    onClick={async () => {
                                                        setDeleting(true);
                                                        setDeleteFeedback(null);
                                                        try {
                                                            await deleteEmission(row.id);
                                                            setSelectedIds((prev) => prev.filter((x) => x !== row.id));
                                                            await loadEntries();
                                                        } catch (err) {
                                                            setDeleteFeedback({ type: 'err', text: err?.message || t('ghg.view.deleteFailed') });
                                                        } finally {
                                                            setDeleting(false);
                                                        }
                                                    }}
                                                >
                                                    <i className="fas fa-trash-alt" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                            </tbody>
                        </table>
                    </div>
                    {hasApi && !listLoading && filteredEntries.length > 0 && (
                        <p className="ghg-view-count">
                            {viewSearch.trim()
                                ? t('ghg.view.showingFiltered', { shown: filteredEntries.length, total: entries.length })
                                : t('ghg.view.showingAll', { count: entries.length })}
                        </p>
                    )}
                </div>
            )}
            {isStationaryCombustion && (
                <>
                    <datalist id="ghg-stationary-asset-datalist">
                        {lookupAssets.map((a) => (
                            <option key={a} value={a} />
                        ))}
                    </datalist>
                    <datalist id="ghg-stationary-facility-datalist">
                        {lookupFacilities.map((f) => (
                            <option key={f} value={f} />
                        ))}
                    </datalist>
                    <datalist id="ghg-stationary-fuel-datalist">
                        {STATIONARY_FUEL_SELECT_PRESETS.map((p) => (
                            <option key={p.value} value={p.value} label={t(p.labelKey)} />
                        ))}
                        {lookupPastActivityTypes.map((name) => (
                            <option key={`past-${name}`} value={name} />
                        ))}
                    </datalist>
                </>
            )}
        </div>
    );
}

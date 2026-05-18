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
    downloadMobileCombustionTemplate,
    previewMobileCombustionBulk,
    confirmMobileCombustionBulk,
    getMobileCombustionLookupOptions,
    deleteEmission,
    deleteEmissionsBulk,
    aiExtractReceipt,
    aiConfirmReceipt,
    aiExtractMobileReceipt,
    aiConfirmMobileReceipt,
} from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { readSitesForOrganization } from '../../utils/dataInputSitesStorage.js';
import { findCategory, titleKeyForCategory } from './ghgCategories.js';
import { STATIONARY_TEMPLATE_COLUMNS, STATIONARY_TEMPLATE_UNITS, STATIONARY_FUEL_SELECT_PRESETS } from './stationaryCombustionConfig.js';
import {
    MOBILE_TEMPLATE_COLUMNS,
    MOBILE_TEMPLATE_UNITS,
    MOBILE_VEHICLE_SELECT_PRESETS,
    MOBILE_FUEL_SELECT_PRESETS,
} from './mobileCombustionConfig.js';
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
    /** Mobile combustion: vehicle type (workbook column). */
    const [mcVehicleType, setMcVehicleType] = useState('');
    const [mcFacility, setMcFacility] = useState('');
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
    const [lookupVehicleTypes, setLookupVehicleTypes] = useState([]);
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
    const isMobileCombustion = Boolean(slug === 'mobile-combustion' && scope === 1);
    const isWorkbookScope1 = isStationaryCombustion || isMobileCombustion;

    /** i18n + column list for Scope 1 workbook bulk (stationary vs mobile). */
    const wbBulk = isStationaryCombustion ? 'ghg.stationary' : 'ghg.mobile';
    const wbTemplateColumns = isStationaryCombustion ? STATIONARY_TEMPLATE_COLUMNS : MOBILE_TEMPLATE_COLUMNS;

    const addMethodChoices = useMemo(() => {
        const cards = [
            { id: 'form', icon: 'fa-file-pen' },
            { id: 'bulk', icon: 'fa-cloud-arrow-up' },
        ];
        if (isStationaryCombustion || isMobileCombustion) cards.push({ id: 'ai', icon: 'fa-wand-magic-sparkles' });
        return cards;
    }, [isStationaryCombustion, isMobileCombustion]);

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

    const mobileExtraPastFuels = useMemo(() => {
        const presetLower = new Set(MOBILE_FUEL_SELECT_PRESETS.map((p) => p.value.toLowerCase()));
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
        if (!isWorkbookScope1 || !hasApi || !getAuthToken()) return;
        let cancelled = false;
        const loader = isStationaryCombustion ? getStationaryCombustionLookupOptions : getMobileCombustionLookupOptions;
        loader()
            .then((opts) => {
                if (cancelled) return;
                const localNames = (user?.organizationId ? readSitesForOrganization(user.organizationId) : [])
                    .map((s) => (typeof s.name === 'string' ? s.name.trim() : ''))
                    .filter(Boolean);
                const fac = new Set([...(opts.facilities || []), ...localNames]);
                setLookupFacilities([...fac].sort((a, b) => a.localeCompare(b)));
                if (isStationaryCombustion) {
                    setLookupAssets([...(opts.assets || [])].sort((a, b) => a.localeCompare(b)));
                    setLookupVehicleTypes([]);
                    setLookupPastActivityTypes(Array.isArray(opts.pastActivityTypes) ? opts.pastActivityTypes : []);
                } else {
                    setLookupAssets([]);
                    setLookupVehicleTypes(Array.isArray(opts.vehicleTypes) ? opts.vehicleTypes : []);
                    setLookupPastActivityTypes(Array.isArray(opts.pastActivityTypes) ? opts.pastActivityTypes : []);
                }
            })
            .catch(() => {
                if (cancelled) return;
                const localNames = (user?.organizationId ? readSitesForOrganization(user.organizationId) : [])
                    .map((s) => (typeof s.name === 'string' ? s.name.trim() : ''))
                    .filter(Boolean);
                setLookupFacilities([...new Set(localNames)].sort((a, b) => a.localeCompare(b)));
                setLookupAssets([]);
                setLookupVehicleTypes([]);
                setLookupPastActivityTypes([]);
            });
        return () => {
            cancelled = true;
        };
    }, [isWorkbookScope1, isStationaryCombustion, hasApi, user?.organizationId]);

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
        } else if (slug === 'mobile-combustion' && scope === 1) {
            setMcVehicleType('Car');
            setMcFacility('');
            setStFuelSelectKey('CNG');
            setStFuelUsed('CNG');
            setStFuelUnit('Metric ton');
        } else {
            setMcVehicleType('');
            setMcFacility('');
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

    const handleDownloadWorkbookTemplate = async () => {
        setBulkFeedback(null);
        try {
            if (isStationaryCombustion) {
                await downloadStationaryCombustionTemplate();
                setBulkFeedback({ type: 'ok', text: t('ghg.stationary.templateDownloaded') });
            } else {
                await downloadMobileCombustionTemplate();
                setBulkFeedback({ type: 'ok', text: t('ghg.mobile.templateDownloaded') });
            }
        } catch (err) {
            setBulkFeedback({
                type: 'err',
                text: err?.message || (isStationaryCombustion ? t('ghg.stationary.templateDownloadError') : t('ghg.mobile.templateDownloadError')),
            });
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
            const data = isStationaryCombustion
                ? await previewStationaryCombustionBulk(bulkFile)
                : await previewMobileCombustionBulk(bulkFile);
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
            const previewKey = isStationaryCombustion ? 'ghg.stationary.bulkPreviewReady' : 'ghg.mobile.bulkPreviewReady';
            setBulkFeedback({
                type: 'ok',
                text: t(previewKey, {
                    total: data.summary?.total ?? rows.length,
                    valid: data.summary?.validCount ?? 0,
                    invalid: data.summary?.invalidCount ?? 0,
                }),
            });
        } catch (err) {
            setBulkFeedback({
                type: 'err',
                text: err?.message || (isStationaryCombustion ? t('ghg.stationary.bulkError') : t('ghg.mobile.bulkError')),
            });
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
                const base = {
                    fuelUsed: String(r.input.fuelUsed ?? '').trim(),
                    fuelUsedQuantity: Number.isFinite(q) && q > 0 ? q : r.input.fuelUsedQuantity,
                    fuelUsedUnit: String(r.input.fuelUsedUnit ?? '').trim(),
                    facility: String(r.input.facility ?? '').trim(),
                    dateOfTransaction: r.input.dateOfTransaction,
                    notes: r.input.notes ? String(r.input.notes).trim() : undefined,
                    excelRow: r.excelRow,
                };
                if (isStationaryCombustion) {
                    return { ...base, asset: String(r.input.asset ?? '').trim() };
                }
                return { ...base, vehicleType: String(r.input.vehicleType ?? '').trim() };
            });
            const data = isStationaryCombustion
                ? await confirmStationaryCombustionBulk(rows)
                : await confirmMobileCombustionBulk(rows);
            const created = data.createdCount ?? 0;
            const failed = data.failedCount ?? 0;
            const rowErrors = Array.isArray(data.rowErrors) ? data.rowErrors.filter(Boolean) : [];
            const bulkOkKey = isStationaryCombustion ? 'ghg.stationary.bulkOk' : 'ghg.mobile.bulkOk';
            const bulkPartialKey = isStationaryCombustion ? 'ghg.stationary.bulkPartial' : 'ghg.mobile.bulkPartial';
            const summary = failed > 0 ? t(bulkPartialKey, { created, failed }) : t(bulkOkKey, { created });
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
                const dashMsg = isStationaryCombustion
                    ? t('ghg.stationary.dashboardAfterBulk')
                    : t('ghg.mobile.dashboardAfterBulk');
                navigate('/', {
                    replace: false,
                    state: { fromSubmit: true, submitMessage: dashMsg },
                });
            }
        } catch (err) {
            setBulkFeedback({
                type: 'err',
                text: err?.message || (isStationaryCombustion ? t('ghg.stationary.bulkError') : t('ghg.mobile.bulkError')),
            });
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

    const validateMobileManual = () => {
        const amount = parseFloat(String(activityAmount).replace(',', '.'));
        if (!Number.isFinite(amount) || amount <= 0) {
            setSubmitFeedback({ type: 'err', text: t('ghg.form.invalidAmount') });
            return false;
        }
        if (!mcVehicleType.trim() && !mcFacility.trim()) {
            setSubmitFeedback({ type: 'err', text: t('ghg.mobile.vehicleOrFacilityRequired') });
            return false;
        }
        if (!stFuelUsed.trim()) {
            setSubmitFeedback({ type: 'err', text: t('ghg.mobile.fuelUsedRequired') });
            return false;
        }
        if (!stDate) {
            setSubmitFeedback({ type: 'err', text: t('ghg.mobile.dateRequired') });
            return false;
        }
        return true;
    };

    const handleSubmitForm = async (e) => {
        e.preventDefault();
        if (!hasApi || !slug) return;

        if (isWorkbookScope1 && stManualPhase === 'edit') {
            setSubmitFeedback(null);
            if (isStationaryCombustion) {
                if (!validateStationaryManual()) return;
            } else if (!validateMobileManual()) {
                return;
            }
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
            } else if (isMobileCombustion) {
                if (!validateMobileManual()) {
                    setSubmitting(false);
                    return;
                }
                payload = {
                    vehicleType: mcVehicleType.trim(),
                    fuelUsed: stFuelUsed.trim(),
                    fuelUsedQuantity: amount,
                    fuelUsedUnit: stFuelUnit,
                    facility: mcFacility.trim(),
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
            } else if (isMobileCombustion) {
                navigate('/', {
                    replace: false,
                    state: { fromSubmit: true, submitMessage: t('ghg.mobile.dashboardAfterManual') },
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
                            <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: 16, color: '#1a2e2b' }}>
                                {t('ghg.addMethodHeading')}
                            </div>
                            <div className="ghg-choice-grid">
                                {addMethodChoices.map((m) => (
                                    <article key={m.id} className="ghg-choice-card" onClick={() => setAddStep(m.id)}>
                                        <div className={`ghg-choice-card__icon-wrap ghg-choice-card__icon-wrap--${m.id}`} aria-hidden="true">
                                            <i className={`fas ${m.icon}`} />
                                        </div>
                                        <h3 className="ghg-choice-card__title">{t(`ghg.method.${m.id}`)}</h3>
                                        <p className="ghg-choice-card__desc">{t(`ghg.method.desc.${m.id}`)}</p>
                                        <button
                                            type="button"
                                            className="ghg-choice-card__start"
                                            onClick={(e) => { e.stopPropagation(); setAddStep(m.id); }}
                                        >
                                            {t('ghg.method.start')} →
                                        </button>
                                    </article>
                                ))}
                            </div>
                        </section>
                    )}

                    {addStep === 'form' && hasApi && (
                        <div className="ghg-method-workspace">
                            <div className="ghg-v2-page-header">
                                <div>
                                    <div className="ghg-v2-page-title">{t('ghg.form.questionnaire')}</div>
                                    <p className="ghg-v2-page-sub">{t(titleKey)} · {t('ghg.scopeTab', { n: scope })} · {t('ghg.method.form')}</p>
                                </div>
                                <button type="button" className="ghg-v2-btn ghg-v2-btn-o" onClick={() => setAddStep(null)}>← {t('ghg.backToMethods')}</button>
                            </div>
                            <form className="ghg-v2-layout" onSubmit={handleSubmitForm}>
                                <div>
                                    {(isStationaryCombustion || isMobileCombustion) && stManualPhase === 'review' && (
                                        <div className="ghg-v2-status-bar ghg-v2-status-bar--ok" role="status" style={{ marginBottom: 14 }}>
                                            ✓ {t(isStationaryCombustion ? 'ghg.stationary.reviewBannerManual' : 'ghg.mobile.reviewBannerManual')}
                                        </div>
                                    )}
                                    <div className="ghg-v2-card">
                                    <div className="ghg-v2-card-title">{t('ghg.form.questionnaire')}</div>
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
                                    ) : isMobileCombustion ? (
                                        <>
                                            <div className="ghg-field">
                                                <label htmlFor="ghg-mc-vehicle">{t('ghg.mobile.vehicleType')}</label>
                                                <input
                                                    id="ghg-mc-vehicle"
                                                    list="ghg-mobile-vehicle-datalist"
                                                    value={mcVehicleType}
                                                    onChange={(ev) => setMcVehicleType(ev.target.value)}
                                                    autoComplete="off"
                                                    placeholder={t('ghg.mobile.vehiclePlaceholder')}
                                                />
                                                <p className="ghg-form-hint ghg-form-hint--tight">{t('ghg.mobile.vehiclePickHint')}</p>
                                            </div>
                                            <div className="ghg-field">
                                                <label htmlFor="ghg-mc-facility">{t('ghg.mobile.facility')}</label>
                                                <input
                                                    id="ghg-mc-facility"
                                                    list="ghg-mobile-facility-datalist"
                                                    value={mcFacility}
                                                    onChange={(ev) => setMcFacility(ev.target.value)}
                                                    autoComplete="off"
                                                    placeholder={t('ghg.mobile.facilityPlaceholder')}
                                                />
                                                <p className="ghg-form-hint ghg-form-hint--tight">{t('ghg.mobile.facilityPickHint')}</p>
                                            </div>
                                            <p className="ghg-form-hint ghg-form-hint--between-fields">
                                                {t('ghg.mobile.vehicleOrFacilityRule')}
                                            </p>
                                            <div className="ghg-field">
                                                <label htmlFor="ghg-mc-fuel-select">{t('ghg.mobile.fuelUsed')}</label>
                                                <select
                                                    id="ghg-mc-fuel-select"
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
                                                    {MOBILE_FUEL_SELECT_PRESETS.map((p) => (
                                                        <option key={p.value} value={p.value}>
                                                            {t(p.labelKey)}
                                                        </option>
                                                    ))}
                                                    {mobileExtraPastFuels.length > 0 && (
                                                        <optgroup label={t('ghg.mobile.fuelOptionGroupPast')}>
                                                            {mobileExtraPastFuels.map((name) => (
                                                                <option key={name} value={name}>
                                                                    {name}
                                                                </option>
                                                            ))}
                                                        </optgroup>
                                                    )}
                                                    <option value="__other__">{t('ghg.mobile.fuelOptionOther')}</option>
                                                </select>
                                                <p className="ghg-form-hint ghg-form-hint--tight">
                                                    {t('ghg.mobile.fuelSelectHint')}
                                                </p>
                                                {stFuelSelectKey === '__other__' && (
                                                    <textarea
                                                        id="ghg-mc-fuel-custom"
                                                        className="ghg-field-fuel-custom"
                                                        rows={3}
                                                        value={stFuelUsed}
                                                        onChange={(ev) => setStFuelUsed(ev.target.value)}
                                                        placeholder={t('ghg.mobile.fuelUsedPlaceholder')}
                                                        aria-label={t('ghg.mobile.fuelCustomAria')}
                                                    />
                                                )}
                                            </div>
                                            <div className="ghg-field-row">
                                                <div className="ghg-field">
                                                    <label htmlFor="ghg-mc-amount">{t('ghg.mobile.fuelUsedQuantity')}</label>
                                                    <input
                                                        id="ghg-mc-amount"
                                                        type="text"
                                                        inputMode="decimal"
                                                        value={activityAmount}
                                                        onChange={(ev) => setActivityAmount(ev.target.value)}
                                                    />
                                                </div>
                                                <div className="ghg-field">
                                                    <label htmlFor="ghg-mc-unit">{t('ghg.mobile.fuelUsedUnit')}</label>
                                                    <select
                                                        id="ghg-mc-unit"
                                                        value={stFuelUnit}
                                                        onChange={(ev) => setStFuelUnit(ev.target.value)}
                                                    >
                                                        {MOBILE_TEMPLATE_UNITS.map((u) => (
                                                            <option key={u} value={u}>
                                                                {u}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>
                                            </div>
                                            <div className="ghg-field">
                                                <label htmlFor="ghg-mc-date">{t('ghg.mobile.dateOfTransaction')}</label>
                                                <input
                                                    id="ghg-mc-date"
                                                    type="date"
                                                    value={stDate}
                                                    onChange={(ev) => setStDate(ev.target.value)}
                                                    required
                                                />
                                            </div>
                                            <div className="ghg-field">
                                                <label htmlFor="ghg-mc-notes">{t('ghg.form.notes')}</label>
                                                <textarea
                                                    id="ghg-mc-notes"
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
                                    </div>{/* /ghg-v2-card */}
                                    {submitFeedback && (
                                        <p className={submitFeedback.type === 'err' ? 'ghg-msg ghg-msg-err' : 'ghg-msg ghg-msg-ok'} style={{ marginTop: 10 }}>
                                            {submitFeedback.text}
                                        </p>
                                    )}
                                    <div className="ghg-v2-btn-row" style={{ marginTop: 14 }}>
                                        {isWorkbookScope1 && stManualPhase === 'review' && (
                                            <button type="button" className="ghg-v2-btn ghg-v2-btn-g" disabled={submitting} onClick={() => { setStManualPhase('edit'); setSubmitFeedback(null); }}>
                                                {t(isStationaryCombustion ? 'ghg.stationary.backToEdit' : 'ghg.mobile.backToEdit')}
                                            </button>
                                        )}
                                        <button type="submit" className="ghg-v2-btn ghg-v2-btn-p" style={{ flex: 2, justifyContent: 'center' }} disabled={submitting}>
                                            {submitting
                                                ? t('ghg.form.submitting')
                                                : !isWorkbookScope1
                                                  ? t('ghg.form.submit')
                                                  : stManualPhase === 'edit'
                                                    ? t(isStationaryCombustion ? 'ghg.stationary.continueToReview' : 'ghg.mobile.continueToReview')
                                                    : t(isStationaryCombustion ? 'ghg.stationary.submitToInventory' : 'ghg.mobile.submitToInventory')}
                                             →
                                        </button>
                                    </div>
                                </div>
                                {/* ── v2 Sidebar: Emission Preview ── */}
                                <div className="ghg-v2-card ghg-v2-sidebar">
                                    <div className="ghg-v2-card-title">{t('ghg.form.emissionPreview')} {lastSaved && <span className="ghg-v2-ai-badge" style={{ background: '#eaf7f6', color: '#1a9a8f', fontSize: 10 }}>Live</span>}</div>
                                    {lastSaved ? (
                                        <>
                                            <div className="ghg-v2-emission-box">
                                                <div className="ghg-v2-emission-label">{t('ghg.form.previewCo2e')}</div>
                                                <div className="ghg-v2-emission-value">{formatTonnes((lastSaved.co2e || 0) / 1000)}</div>
                                                <div className="ghg-v2-emission-unit">{t('ghg.tco2e')}</div>
                                            </div>
                                            <div className="ghg-v2-kv-row">
                                                <span className="ghg-v2-kv-label">{t('ghg.form.previewFactor')}</span>
                                                <span className="ghg-v2-kv-value">{lastSaved.emissionFactor ?? '—'}</span>
                                            </div>
                                            <div className="ghg-v2-verified">
                                                <strong>✓ Verified</strong> · Emission factor from IPCC database
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <div className="ghg-v2-emission-box">
                                                <div className="ghg-v2-emission-label">{t('ghg.form.previewCo2e')}</div>
                                                <div className="ghg-v2-emission-value" style={{ color: '#9bb5b0' }}>—</div>
                                                <div className="ghg-v2-emission-unit">{t('ghg.tco2e')}</div>
                                            </div>
                                            <p style={{ fontSize: 12, color: '#9bb5b0', textAlign: 'center' }}>{t('ghg.form.previewPlaceholder')}</p>
                                        </>
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

                    {addStep === 'bulk' && hasApi && isWorkbookScope1 && (
                        <div className="ghg-method-workspace">
                            <div className="ghg-v2-page-header">
                                <div>
                                    <div className="ghg-v2-page-title">{t('ghg.bulk.title')}</div>
                                    <p className="ghg-v2-page-sub">{t(titleKey)} · {t('ghg.scopeTab', { n: scope })} · Bulk Upload</p>
                                </div>
                                <button type="button" className="ghg-v2-btn ghg-v2-btn-o" onClick={() => setAddStep(null)}>← {t('ghg.backToMethods')}</button>
                            </div>
                            <div className="ghg-v2-layout ghg-v2-layout--bulk">
                              <div>
                                {bulkStep === 'file' && (
                                    <>
                                        {/* Step 1 — Download Template */}
                                        <div className="ghg-v2-card">
                                            <div className="ghg-v2-card-title">Step 1 – Download Template</div>
                                            <div className="ghg-v2-template-row">
                                                <div className="ghg-v2-template-icon"><i className="fas fa-file-excel" aria-hidden /></div>
                                                <div className="ghg-v2-template-info">
                                                    <div className="ghg-v2-template-name">{isStationaryCombustion ? 'Stationary_Combustion_Template.xlsx' : 'Mobile_Combustion_Template.xlsx'}</div>
                                                    <div className="ghg-v2-template-desc">Required fields, dropdown validations, sample data included</div>
                                                </div>
                                                <button type="button" className="ghg-v2-btn ghg-v2-btn-p" style={{ fontSize: 11.5 }} onClick={handleDownloadWorkbookTemplate}>Download</button>
                                            </div>
                                            <div style={{ fontSize: 12, color: '#6b8a85', marginTop: 10 }}>Supported: <strong>.XLSX · .CSV</strong> · Max 50MB</div>
                                        </div>
                                        {/* Step 2 — Upload File */}
                                        <div className="ghg-v2-card">
                                            <div className="ghg-v2-card-title">Step 2 – Upload Your File</div>
                                            <label className="ghg-v2-upload-zone">
                                                <input
                                                    type="file"
                                                    style={{ display: 'none' }}
                                                    accept=".csv,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
                                                    onChange={(ev) => {
                                                        const f = ev.target.files?.[0];
                                                        setBulkFile(f || null);
                                                        setBulkFeedback(null);
                                                        setBulkStep('file');
                                                        setBulkReviewRows([]);
                                                    }}
                                                />
                                                <div className="ghg-v2-upload-icon"><i className="fas fa-cloud-upload-alt" aria-hidden /></div>
                                                <div className="ghg-v2-upload-title">{bulkFile ? bulkFile.name : 'Drag & drop your file here'}</div>
                                                {!bulkFile && <button type="button" className="ghg-v2-btn ghg-v2-btn-o" style={{ marginTop: 4, fontSize: 11.5 }}>Browse File</button>}
                                                {bulkFile && <div className="ghg-v2-upload-sub">Selected · {(bulkFile.size / 1024).toFixed(0)} KB</div>}
                                            </label>
                                            <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                                                <button
                                                    type="button"
                                                    className="ghg-v2-btn ghg-v2-btn-p"
                                                    style={{ flex: 1, justifyContent: 'center' }}
                                                    disabled={!bulkFile || bulkUploading}
                                                    onClick={handleBulkPreviewFile}
                                                >
                                                    {bulkUploading ? t(`${wbBulk}.bulkParsing`) : t(`${wbBulk}.bulkParseReview`)} →
                                                </button>
                                            </div>
                                        </div>
                                    </>
                                )}
                                {bulkStep === 'review' && (
                                    <>
                                        <div className="ghg-v2-card" style={{ marginBottom: 14 }}>
                                            <div className="ghg-v2-card-title">Step 3 – Validation Preview</div>
                                            {(() => {
                                                const validCount = bulkReviewRows.filter(r => r.status === 'valid' || r.status === 'edited').length;
                                                const invalidCount = bulkReviewRows.filter(r => r.status === 'invalid').length;
                                                const warnCount = bulkReviewRows.filter(r => r.status === 'edited').length;
                                                return (
                                                    <div className={`ghg-v2-status-bar ghg-v2-status-bar--${invalidCount > 0 ? 'warn' : 'ok'}`}>
                                                        {invalidCount > 0
                                                            ? `${bulkReviewRows.length} rows detected · ${invalidCount} errors · ${warnCount} warnings`
                                                            : `✓ ${bulkReviewRows.length} rows detected · 0 errors`}
                                                    </div>
                                                );
                                            })()}
                                        <div className="ghg-bulk-preview-wrap">
                                            <table className="ghg-bulk-preview-table">
                                                <thead>
                                                    <tr>
                                                        <th>#</th>
                                                        <th>
                                                            {isStationaryCombustion
                                                                ? t('ghg.stationary.asset')
                                                                : t('ghg.mobile.vehicleType')}
                                                        </th>
                                                        <th>{t(`${wbBulk}.fuelUsed`)}</th>
                                                        <th>{t(`${wbBulk}.fuelUsedQuantity`)}</th>
                                                        <th>{t(`${wbBulk}.fuelUsedUnit`)}</th>
                                                        <th>{t(`${wbBulk}.facility`)}</th>
                                                        <th>{t(`${wbBulk}.dateOfTransaction`)}</th>
                                                        <th>{t(`${wbBulk}.bulkColStatus`)}</th>
                                                        <th>{t(`${wbBulk}.bulkColMapped`)}</th>
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
                                                                    list={
                                                                        isStationaryCombustion
                                                                            ? 'ghg-stationary-asset-datalist'
                                                                            : 'ghg-mobile-vehicle-datalist'
                                                                    }
                                                                    value={
                                                                        isStationaryCombustion
                                                                            ? (row.input.asset ?? '')
                                                                            : (row.input.vehicleType ?? '')
                                                                    }
                                                                    onChange={(ev) =>
                                                                        updateBulkRowInput(
                                                                            row.clientId,
                                                                            isStationaryCombustion ? 'asset' : 'vehicleType',
                                                                            ev.target.value
                                                                        )
                                                                    }
                                                                />
                                                            </td>
                                                            <td>
                                                                <input
                                                                    className="ghg-bulk-cell-input"
                                                                    list={
                                                                        isStationaryCombustion
                                                                            ? 'ghg-stationary-fuel-datalist'
                                                                            : 'ghg-mobile-fuel-datalist'
                                                                    }
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
                                                                    list={
                                                                        isStationaryCombustion
                                                                            ? 'ghg-stationary-facility-datalist'
                                                                            : 'ghg-mobile-facility-datalist'
                                                                    }
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
                                                                        ? t(`${wbBulk}.bulkStatusEdited`)
                                                                        : row.status === 'valid'
                                                                          ? t(`${wbBulk}.bulkStatusValid`)
                                                                          : t(`${wbBulk}.bulkStatusInvalid`)}
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
                                        </div>{/* close ghg-v2-card */}
                                        <p className="ghg-form-hint ghg-form-hint--tight">{t(`${wbBulk}.bulkEditedHint`)}</p>
                                        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                                            <button
                                                type="button"
                                                className="ghg-v2-btn ghg-v2-btn-g"
                                                disabled={bulkUploading}
                                                onClick={() => {
                                                    setBulkStep('file');
                                                    setBulkReviewRows([]);
                                                    setBulkFeedback(null);
                                                }}
                                            >
                                                {t(`${wbBulk}.bulkBackToFile`)}
                                            </button>
                                            <button
                                                type="button"
                                                className="ghg-v2-btn ghg-v2-btn-p"
                                                style={{ flex: 1 }}
                                                disabled={bulkUploading || bulkReviewRows.length === 0}
                                                onClick={handleBulkConfirmImport}
                                            >
                                                {bulkUploading ? t(`${wbBulk}.bulkConfirming`) : t(`${wbBulk}.bulkConfirmImport`)} →
                                            </button>
                                        </div>
                                    </>
                                )}
                                {bulkFeedback && (
                                    <div className={`ghg-v2-status-bar ghg-v2-status-bar--${bulkFeedback.type === 'err' ? 'err' : 'ok'}`} style={{ marginTop: 10 }}>
                                        {bulkFeedback.text}
                                    </div>
                                )}
                            </div>
                            {/* Sidebar — Error Summary */}
                            <div className="ghg-v2-card" style={{ position: 'sticky', top: 80 }}>
                                <div className="ghg-v2-card-title">Error Summary</div>
                                {bulkReviewRows.length > 0 ? (
                                    <>
                                        {(() => {
                                            const validCount = bulkReviewRows.filter(r => r.status === 'valid').length;
                                            const editedCount = bulkReviewRows.filter(r => r.status === 'edited').length;
                                            const invalidCount = bulkReviewRows.filter(r => r.status === 'invalid').length;
                                            return (
                                                <>
                                                    {invalidCount > 0 && (
                                                        <div className="ghg-v2-status-bar ghg-v2-status-bar--err" style={{ marginBottom: 10 }}>
                                                            {invalidCount} row{invalidCount > 1 ? 's' : ''} with errors
                                                        </div>
                                                    )}
                                                    {editedCount > 0 && (
                                                        <div className="ghg-v2-status-bar ghg-v2-status-bar--warn" style={{ marginBottom: 10 }}>
                                                            {editedCount} row{editedCount > 1 ? 's' : ''} edited
                                                        </div>
                                                    )}
                                                    <div className="ghg-v2-status-bar ghg-v2-status-bar--ok" style={{ marginBottom: 14 }}>
                                                        ✓ {validCount + editedCount} row{validCount + editedCount !== 1 ? 's' : ''} ready to import
                                                    </div>
                                                    {[
                                                        ['Total Rows', bulkReviewRows.length],
                                                        ['Valid', validCount],
                                                        ['Edited', editedCount],
                                                        ['Errors', invalidCount],
                                                    ].map(([label, val]) => (
                                                        <div key={label} className="ghg-v2-kv-row">
                                                            <span>{label}</span><span style={{ fontWeight: 600 }}>{val}</span>
                                                        </div>
                                                    ))}
                                                </>
                                            );
                                        })()}
                                    </>
                                ) : (
                                    <p style={{ fontSize: 12, color: '#6b8a85' }}>Upload a file to see validation results</p>
                                )}
                            </div>
                        </div>
                        </div>
                    )}

                    {addStep === 'bulk' && hasApi && !isWorkbookScope1 && (
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

                    {addStep === 'ai' && (isStationaryCombustion || isMobileCombustion) && (
                        <div className="ghg-method-workspace">
                            {/* v2 Page header */}
                            <div className="ghg-v2-page-header">
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                                        <div className="ghg-v2-page-title">{t('ghg.ai.title')}</div>
                                        <span className="ghg-v2-ai-badge">✦ AI ASSISTANT</span>
                                    </div>
                                    <p className="ghg-v2-page-sub">{t('ghg.ai.uploadDesc')}</p>
                                </div>
                                <button type="button" className="ghg-v2-btn ghg-v2-btn-o" onClick={() => { setAddStep(null); setAiStep('upload'); setAiFile(null); setAiExtracted(null); setAiFeedback(null); }}>← {t('ghg.backToMethods')}</button>
                            </div>

                            {/* Stepper */}
                            <div className="ghg-v2-steps">
                                <div className={`ghg-v2-step-circle ${aiStep === 'upload' ? 'ghg-v2-step-circle--on' : (aiStep === 'extracting' || aiStep === 'review' || aiStep === 'confirming' || aiStep === 'done') ? 'ghg-v2-step-circle--done' : 'ghg-v2-step-circle--off'}`}>
                                    {(aiStep !== 'upload') ? '✓' : '1'}
                                </div>
                                <div className={`ghg-v2-step-label ${aiStep === 'upload' ? '' : 'ghg-v2-step-label--on'}`}>Upload</div>
                                <div className={`ghg-v2-step-connector ${(aiStep === 'extracting' || aiStep === 'review' || aiStep === 'confirming' || aiStep === 'done') ? 'ghg-v2-step-connector--done' : ''}`} />
                                <div className={`ghg-v2-step-circle ${aiStep === 'extracting' ? 'ghg-v2-step-circle--on' : (aiStep === 'review' || aiStep === 'confirming' || aiStep === 'done') ? 'ghg-v2-step-circle--done' : 'ghg-v2-step-circle--off'}`}>
                                    {(aiStep === 'review' || aiStep === 'confirming' || aiStep === 'done') ? '✓' : '2'}
                                </div>
                                <div className={`ghg-v2-step-label ${(aiStep === 'extracting' || aiStep === 'review' || aiStep === 'confirming' || aiStep === 'done') ? '' : 'ghg-v2-step-label--off'}`}>AI Extract</div>
                                <div className={`ghg-v2-step-connector ${(aiStep === 'review' || aiStep === 'confirming' || aiStep === 'done') ? 'ghg-v2-step-connector--done' : ''}`} />
                                <div className={`ghg-v2-step-circle ${aiStep === 'review' || aiStep === 'confirming' ? 'ghg-v2-step-circle--on' : aiStep === 'done' ? 'ghg-v2-step-circle--done' : 'ghg-v2-step-circle--off'}`}>
                                    {aiStep === 'done' ? '✓' : '3'}
                                </div>
                                <div className={`ghg-v2-step-label ${(aiStep === 'review' || aiStep === 'confirming' || aiStep === 'done') ? '' : 'ghg-v2-step-label--off'}`}>Review</div>
                                <div className={`ghg-v2-step-connector ${aiStep === 'done' ? 'ghg-v2-step-connector--done' : ''}`} />
                                <div className={`ghg-v2-step-circle ${aiStep === 'done' ? 'ghg-v2-step-circle--done' : 'ghg-v2-step-circle--off'}`}>
                                    {aiStep === 'done' ? '✓' : '4'}
                                </div>
                                <div className={`ghg-v2-step-label ${aiStep === 'done' ? '' : 'ghg-v2-step-label--off'}`}>Save</div>
                            </div>

                            <div className="ghg-v2-layout ghg-v2-layout--ai">
                              {/* LEFT COLUMN — Upload + Confidence */}
                              <div>
                                {/* Upload card */}
                                <div className="ghg-v2-card" style={{ marginBottom: 14 }}>
                                    <div className="ghg-v2-card-title">Upload Invoice / Utility Bill</div>
                                    <label className="ghg-v2-upload-zone" style={{ borderColor: aiFile ? 'var(--teal-mid, #2BBFB3)' : undefined, background: aiFile ? 'var(--teal-bg, #E6FAF8)' : undefined }}>
                                        <input
                                            type="file"
                                            accept=".pdf,.jpg,.jpeg,.png"
                                            style={{ display: 'none' }}
                                            onChange={(e) => { setAiFile(e.target.files?.[0] || null); setAiFeedback(null); }}
                                        />
                                        <div className="ghg-v2-upload-icon"><i className="fas fa-file-invoice" aria-hidden /></div>
                                        <div className="ghg-v2-upload-title">{aiFile ? aiFile.name : t('ghg.ai.dropzoneText')}</div>
                                        {aiFile
                                            ? <div className="ghg-v2-upload-sub">Successfully uploaded · {(aiFile.size / 1024).toFixed(0)} KB</div>
                                            : <button type="button" className="ghg-v2-btn ghg-v2-btn-o" style={{ marginTop: 4, fontSize: 11.5 }}>Browse File</button>
                                        }
                                    </label>
                                    {aiStep === 'upload' && (
                                        <button
                                            type="button"
                                            className="ghg-v2-btn ghg-v2-btn-p"
                                            style={{ width: '100%', justifyContent: 'center', marginTop: 12 }}
                                            disabled={!aiFile}
                                            onClick={async () => {
                                                setAiStep('extracting');
                                                setAiFeedback(null);
                                                try {
                                                    const result = isMobileCombustion
                                                        ? await aiExtractMobileReceipt(aiFile)
                                                        : await aiExtractReceipt(aiFile);
                                                    setAiExtracted(result);
                                                    setAiEdited(isMobileCombustion ? {
                                                        vehicleType: result.vehicleType || '',
                                                        fuelUsed: result.fuelUsed || '',
                                                        fuelUsedQuantity: result.fuelUsedQuantity || '',
                                                        fuelUsedUnit: result.fuelUsedUnit || '',
                                                        facility: result.facility || '',
                                                        dateOfTransaction: result.dateOfTransaction || '',
                                                        notes: result.notes || '',
                                                    } : {
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
                                            <i className="fas fa-wand-magic-sparkles" aria-hidden /> {t('ghg.ai.extractBtn')} →
                                        </button>
                                    )}
                                    {aiFeedback?.type === 'err' && aiStep === 'upload' && (
                                        <div className="ghg-v2-status-bar ghg-v2-status-bar--err" style={{ marginTop: 10 }}>{aiFeedback.text}</div>
                                    )}
                                </div>

                                {/* Extracting spinner */}
                                {aiStep === 'extracting' && (
                                    <div className="ghg-v2-card" style={{ textAlign: 'center', padding: 40 }}>
                                        <i className="fas fa-spinner fa-spin" style={{ fontSize: 28, color: '#2BBFB3', marginBottom: 12 }} aria-hidden />
                                        <p style={{ fontSize: 13, color: '#6b8a85' }}>{t('ghg.ai.extracting')}</p>
                                    </div>
                                )}

                                {/* AI Confidence panel — shown after extraction */}
                                {(aiStep === 'review' || aiStep === 'confirming' || aiStep === 'done') && (
                                    <div className="ghg-v2-card ghg-v2-aip">
                                        <div className="ghg-v2-ai-badge">✦ AI Analysis Complete</div>
                                        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Confidence Score</div>
                                        <div className="ghg-v2-conf-bar">
                                            <div className="ghg-v2-conf-fill" style={{ width: aiExtracted?.confidence === 'high' ? '95%' : aiExtracted?.confidence === 'medium' ? '75%' : '50%' }} />
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#6b8a85' }}>
                                            <span>{aiExtracted?.confidence === 'high' ? '95%' : aiExtracted?.confidence === 'medium' ? '75%' : '50%'} – {aiExtracted?.confidence ? t(`ghg.ai.confidence_${aiExtracted.confidence}`) : 'Unknown'}</span>
                                            {aiExtracted?.confidence === 'high' && <span style={{ color: '#1E8A47', fontWeight: 600 }}>✓ Verified</span>}
                                        </div>
                                    </div>
                                )}
                              </div>

                              {/* RIGHT COLUMN — Review form + emission result */}
                              <div>
                                {/* Waiting state */}
                                {(aiStep === 'upload' || aiStep === 'extracting') && (
                                    <div className="ghg-v2-card" style={{ textAlign: 'center', padding: '40px 20px', color: '#6b8a85' }}>
                                        <i className="fas fa-robot" style={{ fontSize: 32, marginBottom: 10, opacity: 0.3 }} aria-hidden />
                                        <p style={{ fontSize: 13 }}>Upload a document to begin AI extraction</p>
                                    </div>
                                )}

                                {/* Review form */}
                                {aiStep === 'review' && (
                                    <>
                                        <div className="ghg-v2-card" style={{ marginBottom: 14 }}>
                                            <div className="ghg-v2-card-title">AI Extracted Data – Review & Edit</div>
                                            <div className="ghg-v2-status-bar ghg-v2-status-bar--warn" style={{ marginBottom: 12 }}>
                                                ⚠ Review all fields before approving. Highlighted fields need attention.
                                            </div>
                                            {isMobileCombustion ? (
                                                <div className="ghg-v2-fg">
                                                    <label className="ghg-v2-fl">{t('ghg.mobile.vehicleType')}</label>
                                                    <input className="ghg-v2-fi" value={aiEdited.vehicleType} onChange={(e) => setAiEdited({ ...aiEdited, vehicleType: e.target.value })} />
                                                </div>
                                            ) : (
                                                <div className="ghg-v2-fg">
                                                    <label className="ghg-v2-fl">{t('ghg.stationary.asset')}</label>
                                                    <input className="ghg-v2-fi" value={aiEdited.asset} onChange={(e) => setAiEdited({ ...aiEdited, asset: e.target.value })} />
                                                </div>
                                            )}
                                            <div className="ghg-v2-fg">
                                                <label className="ghg-v2-fl">{t(isMobileCombustion ? 'ghg.mobile.fuelUsed' : 'ghg.stationary.fuelUsed')}</label>
                                                <input className="ghg-v2-fi" value={aiEdited.fuelUsed} onChange={(e) => setAiEdited({ ...aiEdited, fuelUsed: e.target.value })} />
                                            </div>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                                <div className="ghg-v2-fg">
                                                    <label className="ghg-v2-fl">{t(isMobileCombustion ? 'ghg.mobile.fuelUsedQuantity' : 'ghg.stationary.fuelUsedQuantity')}</label>
                                                    <input className="ghg-v2-fi" type="number" step="any" min="0" value={aiEdited.fuelUsedQuantity} onChange={(e) => setAiEdited({ ...aiEdited, fuelUsedQuantity: e.target.value })} />
                                                </div>
                                                <div className="ghg-v2-fg">
                                                    <label className="ghg-v2-fl">{t(isMobileCombustion ? 'ghg.mobile.fuelUsedUnit' : 'ghg.stationary.fuelUsedUnit')}</label>
                                                    <select className="ghg-v2-fsel" value={aiEdited.fuelUsedUnit} onChange={(e) => setAiEdited({ ...aiEdited, fuelUsedUnit: e.target.value })}>
                                                        {(isMobileCombustion ? MOBILE_TEMPLATE_UNITS : STATIONARY_TEMPLATE_UNITS).map((u) => (
                                                            <option key={u} value={u}>{u}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            </div>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                                <div className="ghg-v2-fg">
                                                    <label className="ghg-v2-fl">{t(isMobileCombustion ? 'ghg.mobile.facility' : 'ghg.stationary.facility')}</label>
                                                    <input className="ghg-v2-fi" value={aiEdited.facility} onChange={(e) => setAiEdited({ ...aiEdited, facility: e.target.value })} />
                                                </div>
                                                <div className="ghg-v2-fg">
                                                    <label className="ghg-v2-fl">{t(isMobileCombustion ? 'ghg.mobile.dateOfTransaction' : 'ghg.stationary.dateOfTransaction')}</label>
                                                    <input className="ghg-v2-fi" value={aiEdited.dateOfTransaction} onChange={(e) => setAiEdited({ ...aiEdited, dateOfTransaction: e.target.value })} placeholder="DD/MM/YYYY" />
                                                </div>
                                            </div>
                                            <div className="ghg-v2-fg">
                                                <label className="ghg-v2-fl">{t('ghg.form.notes')}</label>
                                                <textarea className="ghg-v2-fta" rows={2} value={aiEdited.notes} onChange={(e) => setAiEdited({ ...aiEdited, notes: e.target.value })} />
                                            </div>
                                        </div>
                                        {aiFeedback?.type === 'err' && (
                                            <div className="ghg-v2-status-bar ghg-v2-status-bar--err" style={{ marginBottom: 10 }}>{aiFeedback.text}</div>
                                        )}
                                        <div style={{ display: 'flex', gap: 10 }}>
                                            <button
                                                type="button"
                                                className="ghg-v2-btn ghg-v2-btn-g"
                                                style={{ flex: 1 }}
                                                onClick={() => { setAiStep('upload'); setAiFile(null); setAiExtracted(null); setAiFeedback(null); }}
                                            >
                                                Reject & Re-upload
                                            </button>
                                            <button
                                                type="button"
                                                className="ghg-v2-btn ghg-v2-btn-p"
                                                style={{ flex: 2 }}
                                                disabled={!aiEdited.fuelUsed || !aiEdited.fuelUsedQuantity || !aiEdited.fuelUsedUnit}
                                                onClick={async () => {
                                                    setAiStep('confirming');
                                                    setAiFeedback(null);
                                                    try {
                                                        const payload = isMobileCombustion ? {
                                                            vehicleType: aiEdited.vehicleType,
                                                            fuelUsed: aiEdited.fuelUsed,
                                                            fuelUsedQuantity: Number(aiEdited.fuelUsedQuantity),
                                                            fuelUsedUnit: aiEdited.fuelUsedUnit,
                                                            facility: aiEdited.facility,
                                                            dateOfTransaction: aiEdited.dateOfTransaction,
                                                            notes: aiEdited.notes,
                                                        } : {
                                                            asset: aiEdited.asset,
                                                            fuelUsed: aiEdited.fuelUsed,
                                                            fuelUsedQuantity: Number(aiEdited.fuelUsedQuantity),
                                                            fuelUsedUnit: aiEdited.fuelUsedUnit,
                                                            facility: aiEdited.facility,
                                                            dateOfTransaction: aiEdited.dateOfTransaction,
                                                            notes: aiEdited.notes,
                                                        };
                                                        const result = isMobileCombustion
                                                            ? await aiConfirmMobileReceipt(payload)
                                                            : await aiConfirmReceipt(payload);
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
                                                ✓ Approve & Save
                                            </button>
                                        </div>
                                    </>
                                )}

                                {/* Confirming spinner */}
                                {aiStep === 'confirming' && (
                                    <div className="ghg-v2-card" style={{ textAlign: 'center', padding: 40 }}>
                                        <i className="fas fa-spinner fa-spin" style={{ fontSize: 28, color: '#2BBFB3', marginBottom: 12 }} aria-hidden />
                                        <p style={{ fontSize: 13, color: '#6b8a85' }}>{t('ghg.ai.confirming')}</p>
                                    </div>
                                )}

                                {/* Done — success */}
                                {aiStep === 'done' && (
                                    <>
                                        {lastSaved && (
                                            <div className="ghg-v2-card" style={{ marginBottom: 14 }}>
                                                <div className="ghg-v2-card-title">Calculated Emission</div>
                                                <div className="ghg-v2-emission-box">
                                                    <div style={{ fontSize: 11, color: '#6b8a85', marginBottom: 4 }}>Auto-calculated</div>
                                                    <div className="ghg-v2-emission-value">{formatTonnes(lastSaved.co2Equivalent ?? lastSaved.totalEmissions)}</div>
                                                    <div style={{ fontSize: 13, color: '#6b8a85' }}>tCO₂e</div>
                                                </div>
                                            </div>
                                        )}
                                        <div className="ghg-v2-verified">
                                            ✓ {aiFeedback?.text || 'Emission saved successfully'}
                                        </div>
                                        <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                                            <button type="button" className="ghg-v2-btn ghg-v2-btn-g" style={{ flex: 1 }} onClick={() => { setAiStep('upload'); setAiFile(null); setAiExtracted(null); setAiFeedback(null); }}>
                                                <i className="fas fa-plus" aria-hidden /> {t('ghg.ai.uploadAnother')}
                                            </button>
                                            <button type="button" className="ghg-v2-btn ghg-v2-btn-p" style={{ flex: 2 }} onClick={() => { setMainTab('view'); loadEntries(); }}>
                                                <i className="fas fa-table" aria-hidden /> {t('ghg.ai.viewData')}
                                            </button>
                                        </div>
                                    </>
                                )}
                              </div>
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
            {(isStationaryCombustion || isMobileCombustion) && (
                <>
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
                    {isMobileCombustion && (
                        <>
                            <datalist id="ghg-mobile-vehicle-datalist">
                                {MOBILE_VEHICLE_SELECT_PRESETS.map((p) => (
                                    <option key={p.value} value={p.value} label={t(p.labelKey)} />
                                ))}
                                {lookupVehicleTypes.map((v) => (
                                    <option key={`vt-${v}`} value={v} />
                                ))}
                            </datalist>
                            <datalist id="ghg-mobile-facility-datalist">
                                {lookupFacilities.map((f) => (
                                    <option key={`m-f-${f}`} value={f} />
                                ))}
                            </datalist>
                            <datalist id="ghg-mobile-fuel-datalist">
                                {MOBILE_FUEL_SELECT_PRESETS.map((p) => (
                                    <option key={p.value} value={p.value} label={t(p.labelKey)} />
                                ))}
                                {lookupPastActivityTypes.map((name) => (
                                    <option key={`m-past-${name}`} value={name} />
                                ))}
                            </datalist>
                        </>
                    )}
                </>
            )}
        </div>
    );
}

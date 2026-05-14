import { useCallback, useEffect, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import {
    fetchOrganizationMe,
    saveScopeOnboardingDraftApi,
    submitScope2OnboardingApi,
} from '../../api/client.js';
import '../CompanyOnboarding/CompanyOnboarding.css';
import { canOpenRevisitOnboarding } from '../../utils/onboardingRevisit.js';

const DRAFT_PREFIX = 'urimpact_scope2_onboarding_draft_';

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const FACILITY_TYPE_OPTIONS = [
    { value: 'OFFICE', label: 'Office' },
    { value: 'MANUFACTURING', label: 'Manufacturing' },
    { value: 'WAREHOUSE', label: 'Warehouse' },
    { value: 'DATA_CENTER', label: 'Data Center' },
    { value: 'RETAIL', label: 'Retail' },
    { value: 'OTHER', label: 'Other' },
];

function newId() {
    return typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `s2_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function emptyPurchasedLine() {
    return { enabled: false, supplierName: '', supplierAddress: '' };
}

function createFacilityRow() {
    return {
        id: newId(),
        name: '',
        facilityType: 'OFFICE',
        facilityTypeOther: '',
        city: '',
        state: '',
        country: '',
        pinCode: '',
        totalArea: '',
        totalAreaUnit: 'SQ_M',
        renewableElectricityProduction: false,
        monthlyProductionKwh: Array(12).fill(''),
    };
}

function emptyScope2() {
    const facilities = [createFacilityRow()];
    return {
        totalFacilityCount: facilities.length,
        facilities,
        purchasedElectricity: emptyPurchasedLine(),
        purchasedHeating: emptyPurchasedLine(),
        purchasedCooling: emptyPurchasedLine(),
        purchasedSteam: emptyPurchasedLine(),
    };
}

function mapPurchasedFromRaw(raw) {
    if (!raw || typeof raw !== 'object') return emptyPurchasedLine();
    return {
        enabled: !!raw.enabled,
        supplierName: raw.supplierName ?? '',
        supplierAddress: raw.supplierAddress ?? '',
    };
}

function mapFacilityFromRaw(f, i) {
    if (!f || typeof f !== 'object') return createFacilityRow();
    const months = Array.isArray(f.monthlyProductionKwh) ? f.monthlyProductionKwh : [];
    const padded = Array.from({ length: 12 }, (_, j) =>
        months[j] !== undefined && months[j] !== null ? String(months[j]) : ''
    );
    return {
        id: f.id || `f-${i}`,
        name: f.name ?? '',
        facilityType: f.facilityType || 'OFFICE',
        facilityTypeOther: f.facilityTypeOther ?? '',
        city: f.city ?? '',
        state: f.state ?? '',
        country: f.country ?? '',
        pinCode: f.pinCode ?? '',
        totalArea: f.totalArea !== undefined && f.totalArea !== null ? String(f.totalArea) : '',
        totalAreaUnit: f.totalAreaUnit === 'SQ_FT' ? 'SQ_FT' : 'SQ_M',
        renewableElectricityProduction: !!f.renewableElectricityProduction,
        monthlyProductionKwh: padded,
    };
}

function mapScope2FromServer(raw) {
    if (!raw || typeof raw !== 'object') return emptyScope2();
    const facilities = Array.isArray(raw.facilities)
        ? raw.facilities.map((f, i) => mapFacilityFromRaw(f, i))
        : [createFacilityRow()];
    const count =
        typeof raw.totalFacilityCount === 'number' && raw.totalFacilityCount > 0
            ? raw.totalFacilityCount
            : facilities.length;
    let fac = facilities;
    while (fac.length < count) fac = [...fac, createFacilityRow()];
    if (fac.length > count) fac = fac.slice(0, count);
    return {
        totalFacilityCount: fac.length,
        facilities: fac,
        purchasedElectricity: mapPurchasedFromRaw(raw.purchasedElectricity),
        purchasedHeating: mapPurchasedFromRaw(raw.purchasedHeating),
        purchasedCooling: mapPurchasedFromRaw(raw.purchasedCooling),
        purchasedSteam: mapPurchasedFromRaw(raw.purchasedSteam),
    };
}

function twelveMonthlyKwh(arr) {
    const out = Array(12).fill(0);
    for (let i = 0; i < 12; i += 1) {
        const n = parseFloat(String(arr?.[i] ?? '').trim());
        out[i] = Number.isFinite(n) && n >= 0 ? n : 0;
    }
    return out;
}

function toSubmitPayload(s) {
    const facilities = (s.facilities || []).map((f) => ({
        id: String(f.id || '').trim() || newId(),
        name: String(f.name || '').trim(),
        facilityType: f.facilityType,
        facilityTypeOther: f.facilityType === 'OTHER' ? String(f.facilityTypeOther || '').trim() || null : null,
        city: String(f.city || '').trim(),
        state: String(f.state || '').trim(),
        country: String(f.country || '').trim(),
        pinCode: String(f.pinCode || '').trim(),
        totalArea: parseFloat(String(f.totalArea || '').trim()),
        totalAreaUnit: f.totalAreaUnit === 'SQ_FT' ? 'SQ_FT' : 'SQ_M',
        renewableElectricityProduction: !!f.renewableElectricityProduction,
        monthlyProductionKwh: twelveMonthlyKwh(f.monthlyProductionKwh),
    }));

    const line = (p) => ({
        enabled: !!p.enabled,
        supplierName: p.enabled ? String(p.supplierName || '').trim() : null,
        supplierAddress: p.enabled ? String(p.supplierAddress || '').trim() : null,
    });

    return {
        totalFacilityCount: facilities.length,
        facilities,
        purchasedElectricity: line(s.purchasedElectricity),
        purchasedHeating: line(s.purchasedHeating),
        purchasedCooling: line(s.purchasedCooling),
        purchasedSteam: line(s.purchasedSteam),
    };
}

function canCompleteOnboarding(role) {
    const r = String(role || '').toUpperCase();
    return r === 'ADMINISTRATOR' || r === 'SUPER_ADMIN';
}

function YesNoField({ name, value, onPick }) {
    return (
        <fieldset className="cob-field" style={{ border: 'none', padding: 0, margin: '0 0 8px' }}>
            <div style={{ display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
                <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input type="radio" name={name} checked={value === true} onChange={() => onPick(true)} />
                    Yes
                </label>
                <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input type="radio" name={name} checked={value === false} onChange={() => onPick(false)} />
                    No
                </label>
            </div>
        </fieldset>
    );
}

export default function Scope2Onboarding() {
    const { t } = useTranslation();
    const { user, refreshSession } = useAuth();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const allowWizardRevisit = canOpenRevisitOnboarding(user?.role, searchParams);
    const [step, setStep] = useState(1);
    const [s2, setS2] = useState(emptyScope2);
    const [fieldErrors, setFieldErrors] = useState({});
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [canEditOrg, setCanEditOrg] = useState(true);

    const persistLocal = useCallback(
        (next) => {
            if (!user?.organizationId) return;
            try {
                localStorage.setItem(`${DRAFT_PREFIX}${user.organizationId}`, JSON.stringify(next));
            } catch (_) {
                /* ignore */
            }
        },
        [user?.organizationId]
    );

    const setScope = useCallback(
        (updater) => {
            setS2((prev) => {
                const next = typeof updater === 'function' ? updater(prev) : { ...prev, ...updater };
                const synced = { ...next, totalFacilityCount: next.facilities?.length || 0 };
                persistLocal(synced);
                return synced;
            });
        },
        [persistLocal]
    );

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const data = await fetchOrganizationMe();
                const org = data.organization;
                if (!cancelled) setCanEditOrg(!!data.canEdit);

                const fromDraft = org?.scopeOnboardingDraft?.scope2;
                const fromInv = org?.scope2Inventory;
                let merged = mapScope2FromServer(fromDraft || fromInv);

                if (user?.organizationId) {
                    try {
                        const raw = localStorage.getItem(`${DRAFT_PREFIX}${user.organizationId}`);
                        if (raw) {
                            const parsed = JSON.parse(raw);
                            merged = mapScope2FromServer({ ...merged, ...parsed });
                        }
                    } catch (_) {
                        /* ignore */
                    }
                }

                if (!cancelled) setS2(merged);
            } catch (_) {
                if (!cancelled) setCanEditOrg(false);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [user?.organizationId]);

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    if (!user.organizationOnboardingComplete) {
        return <Navigate to="/company-onboarding" replace />;
    }

    if (!user.scope1OnboardingComplete) {
        return <Navigate to="/scope-onboarding" replace />;
    }

    if (user.scope2OnboardingComplete && !allowWizardRevisit) {
        return <Navigate to="/" replace />;
    }

    if (!canCompleteOnboarding(user.role)) {
        return <Navigate to="/" replace />;
    }

    const blurSave = async () => {
        try {
            await saveScopeOnboardingDraftApi({ scope2: toSubmitPayload(s2) });
        } catch (_) {
            /* draft remains in localStorage */
        }
    };

    const validateStep = (n) => {
        const err = {};
        if (n === 1) {
            if (!s2.facilities?.length) err.facilities = 'Add at least one facility';
            s2.facilities.forEach((f, i) => {
                if (!String(f.name || '').trim()) err[`fac_name_${i}`] = 'Required';
                if (f.facilityType === 'OTHER' && !String(f.facilityTypeOther || '').trim()) {
                    err[`fac_type_other_${i}`] = 'Specify type';
                }
                if (!String(f.city || '').trim()) err[`fac_city_${i}`] = 'Required';
                if (!String(f.state || '').trim()) err[`fac_state_${i}`] = 'Required';
                if (!String(f.country || '').trim()) err[`fac_country_${i}`] = 'Required';
                if (!String(f.pinCode || '').trim()) err[`fac_pin_${i}`] = 'Required';
                const area = parseFloat(String(f.totalArea || '').trim());
                if (!f.totalArea || Number.isNaN(area) || area <= 0) err[`fac_area_${i}`] = 'Positive number';
            });
            if (s2.totalFacilityCount !== s2.facilities.length) {
                err.facilityCount = 'Count must match number of facility rows';
            }
        }
        if (n === 2) {
            const keys = ['purchasedElectricity', 'purchasedHeating', 'purchasedCooling', 'purchasedSteam'];
            keys.forEach((k) => {
                const p = s2[k];
                if (p?.enabled) {
                    if (!String(p.supplierName || '').trim()) err[`${k}_name`] = 'Supplier name required';
                    if (!String(p.supplierAddress || '').trim()) err[`${k}_addr`] = 'Supplier address required';
                }
            });
        }
        setFieldErrors(err);
        return Object.keys(err).length === 0;
    };

    const goNext = async () => {
        if (!validateStep(step)) return;
        await blurSave();
        setStep((x) => Math.min(3, x + 1));
        window.scrollTo(0, 0);
    };

    const goBack = () => {
        setStep((x) => Math.max(1, x - 1));
        window.scrollTo(0, 0);
    };

    const handleSubmit = async () => {
        const ok1 = validateStep(1);
        if (!ok1) {
            setStep(1);
            return;
        }
        const ok2 = validateStep(2);
        if (!ok2) {
            setStep(2);
            return;
        }
        setSubmitting(true);
        try {
            await submitScope2OnboardingApi(toSubmitPayload(s2));
            if (user?.organizationId) {
                try {
                    localStorage.removeItem(`${DRAFT_PREFIX}${user.organizationId}`);
                } catch (_) {
                    /* ignore */
                }
            }
            await refreshSession();
            setToast('Scope 2 baseline saved.');
            setTimeout(() => navigate('/', { replace: true }), 800);
        } catch (e) {
            setToast(e?.message || 'Submission failed');
        } finally {
            setSubmitting(false);
        }
    };

    const setFacilityCount = (raw) => {
        const n = Math.max(1, Math.min(500, parseInt(String(raw), 10) || 1));
        setScope((prev) => {
            const fac = [...prev.facilities];
            while (fac.length < n) fac.push(createFacilityRow());
            if (fac.length > n) fac.length = n;
            return { ...prev, facilities: fac, totalFacilityCount: n };
        });
        setFieldErrors({});
    };

    const updateFacility = (id, patch) => {
        setScope((prev) => ({
            ...prev,
            facilities: prev.facilities.map((f) => (f.id === id ? { ...f, ...patch } : f)),
        }));
        setFieldErrors((e) => {
            const next = { ...e };
            delete next.facilities;
            delete next.facilityCount;
            return next;
        });
    };

    const addFacility = () => {
        setScope((prev) => ({
            ...prev,
            facilities: [...prev.facilities, createFacilityRow()],
            totalFacilityCount: prev.facilities.length + 1,
        }));
    };

    const removeFacility = (id) => {
        setScope((prev) => {
            if (prev.facilities.length <= 1) return prev;
            const facilities = prev.facilities.filter((f) => f.id !== id);
            return { ...prev, facilities, totalFacilityCount: facilities.length };
        });
    };

    const updatePurchased = (key, patch) => {
        setScope((prev) => ({
            ...prev,
            [key]: { ...prev[key], ...patch },
        }));
        setFieldErrors((e) => {
            const next = { ...e };
            Object.keys(next).forEach((k) => {
                if (k.startsWith(key)) delete next[k];
            });
            return next;
        });
    };

    const purchasedBlock = (key, title, hint) => {
        const p = s2[key];
        return (
            <div className="cob-section-panel" style={{ marginBottom: 16, padding: 16 }}>
                <h3 className="cob-section-title" style={{ fontSize: '1rem', marginBottom: 8 }}>
                    {title}
                </h3>
                <p className="cob-lead" style={{ marginBottom: 10, fontSize: 13 }}>
                    {hint}
                </p>
                <YesNoField name={`${key}_en`} value={p.enabled} onPick={(v) => updatePurchased(key, { enabled: v })} />
                {p.enabled && (
                    <div className="cob-grid" style={{ marginTop: 12 }}>
                        <label className="cob-field cob-span2">
                            <span className="cob-label">Supplier name</span>
                            <input
                                className="cob-input"
                                value={p.supplierName}
                                onChange={(e) => updatePurchased(key, { supplierName: e.target.value })}
                                onBlur={blurSave}
                            />
                            {fieldErrors[`${key}_name`] && (
                                <span className="cob-field-error">{fieldErrors[`${key}_name`]}</span>
                            )}
                        </label>
                        <label className="cob-field cob-span2">
                            <span className="cob-label">Supplier address</span>
                            <textarea
                                className="cob-input"
                                rows={3}
                                value={p.supplierAddress}
                                onChange={(e) => updatePurchased(key, { supplierAddress: e.target.value })}
                                onBlur={blurSave}
                            />
                            {fieldErrors[`${key}_addr`] && (
                                <span className="cob-field-error">{fieldErrors[`${key}_addr`]}</span>
                            )}
                        </label>
                    </div>
                )}
            </div>
        );
    };

    if (loading) {
        return (
            <div className="loading-screen cob-loading">
                <div className="spinner" />
            </div>
        );
    }

    if (!canEditOrg) {
        return (
            <div className="cob-page">
                <div className="cob-inner">
                    <p className="cob-lead">You do not have permission to edit scope onboarding for this organization.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="cob-page">
            {allowWizardRevisit && (
                <div className="cob-revisit-banner" role="status">
                    <i className="fas fa-pen-to-square" aria-hidden />
                    <span>{t('onboarding.revisitBannerScope2')}</span>
                </div>
            )}
            {toast && (
                <div
                    className={`cob-toast ${toast.includes('fail') ? 'cob-toast-err' : ''}`}
                >
                    {toast}
                </div>
            )}
            <div className="cob-inner">
                <nav className="cob-stepper" aria-label="Scope 2 onboarding progress">
                    {[1, 2, 3].map((n, idx) => (
                        <div key={n} style={{ display: 'contents' }}>
                            {idx > 0 && <div className="cob-step-connector" aria-hidden="true" />}
                            <div
                                className={`cob-step ${step === n ? 'cob-step-active' : ''} ${step > n ? 'cob-step-done' : ''}`}
                            >
                                <span className="cob-step-num" aria-hidden="true">
                                    {step > n ? '✓' : n}
                                </span>
                                <div className="cob-step-text">
                                    <span className="cob-step-label">
                                        {n === 1 && 'Facilities'}
                                        {n === 2 && 'Purchased energy'}
                                        {n === 3 && 'Review'}
                                    </span>
                                    <span className="cob-step-sub">
                                        {n === 1 && 'Sites & renewable generation'}
                                        {n === 2 && 'Electricity, heat, cooling, steam'}
                                        {n === 3 && 'Confirm & submit'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))}
                </nav>

                <header className="cob-page-header">
                    <div className="cob-page-header-icon" aria-hidden="true">
                        <i className="fas fa-bolt" />
                    </div>
                    <div>
                        <h1 className="cob-page-title">Scope 2 · Energy baseline</h1>
                        <p className="cob-lead">
                            Indirect emissions from purchased electricity, steam, heating, and cooling (GHG Protocol).
                            Supplier location supports market-based emission factors. Progress is saved when you continue or
                            leave a field.
                        </p>
                    </div>
                </header>

                {step === 1 && (
                    <section className="cob-section cob-section-panel">
                        <div className="cob-section-head">
                            <span className="cob-section-icon" aria-hidden="true">
                                <i className="fas fa-building" />
                            </span>
                            <h2 className="cob-section-title">5.1 Facility information</h2>
                        </div>
                        <p className="cob-lead" style={{ marginBottom: 16 }}>
                            Enter the number of facilities, then complete each facility card.
                        </p>
                        <label className="cob-field" style={{ maxWidth: 280 }}>
                            <span className="cob-label">Total number of facilities</span>
                            <input
                                type="number"
                                min={1}
                                max={500}
                                className="cob-input"
                                value={s2.totalFacilityCount}
                                onChange={(e) => setFacilityCount(e.target.value)}
                                onBlur={blurSave}
                            />
                            {fieldErrors.facilityCount && (
                                <span className="cob-field-error">{fieldErrors.facilityCount}</span>
                            )}
                            {fieldErrors.facilities && <span className="cob-field-error">{fieldErrors.facilities}</span>}
                        </label>

                        <div style={{ marginTop: 20 }}>
                            <button type="button" className="cob-btn ghost" onClick={addFacility}>
                                + Add facility
                            </button>
                        </div>

                        {s2.facilities.map((f, i) => (
                            <div
                                key={f.id}
                                className="cob-section-panel"
                                style={{ marginTop: 20, padding: 16, borderRadius: 12 }}
                            >
                                <div
                                    style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        marginBottom: 12,
                                        flexWrap: 'wrap',
                                        gap: 8,
                                    }}
                                >
                                    <strong>Facility {i + 1}</strong>
                                    {s2.facilities.length > 1 && (
                                        <button
                                            type="button"
                                            className="cob-btn ghost"
                                            style={{ padding: '6px 12px', fontSize: 13 }}
                                            onClick={() => removeFacility(f.id)}
                                        >
                                            Remove
                                        </button>
                                    )}
                                </div>
                                <div className="cob-grid">
                                    <label className="cob-field cob-span2">
                                        <span className="cob-label">Facility name</span>
                                        <input
                                            className="cob-input"
                                            value={f.name}
                                            onChange={(e) => updateFacility(f.id, { name: e.target.value })}
                                            onBlur={blurSave}
                                        />
                                        {fieldErrors[`fac_name_${i}`] && (
                                            <span className="cob-field-error">{fieldErrors[`fac_name_${i}`]}</span>
                                        )}
                                    </label>
                                    <label className="cob-field">
                                        <span className="cob-label">Facility type</span>
                                        <select
                                            className="cob-input"
                                            value={f.facilityType}
                                            onChange={(e) => updateFacility(f.id, { facilityType: e.target.value })}
                                            onBlur={blurSave}
                                        >
                                            {FACILITY_TYPE_OPTIONS.map((o) => (
                                                <option key={o.value} value={o.value}>
                                                    {o.label}
                                                </option>
                                            ))}
                                        </select>
                                    </label>
                                    {f.facilityType === 'OTHER' && (
                                        <label className="cob-field">
                                            <span className="cob-label">Other (specify)</span>
                                            <input
                                                className="cob-input"
                                                value={f.facilityTypeOther}
                                                onChange={(e) =>
                                                    updateFacility(f.id, { facilityTypeOther: e.target.value })
                                                }
                                                onBlur={blurSave}
                                            />
                                            {fieldErrors[`fac_type_other_${i}`] && (
                                                <span className="cob-field-error">
                                                    {fieldErrors[`fac_type_other_${i}`]}
                                                </span>
                                            )}
                                        </label>
                                    )}
                                    <label className="cob-field">
                                        <span className="cob-label">City</span>
                                        <input
                                            className="cob-input"
                                            value={f.city}
                                            onChange={(e) => updateFacility(f.id, { city: e.target.value })}
                                            onBlur={blurSave}
                                        />
                                        {fieldErrors[`fac_city_${i}`] && (
                                            <span className="cob-field-error">{fieldErrors[`fac_city_${i}`]}</span>
                                        )}
                                    </label>
                                    <label className="cob-field">
                                        <span className="cob-label">State / Region</span>
                                        <input
                                            className="cob-input"
                                            value={f.state}
                                            onChange={(e) => updateFacility(f.id, { state: e.target.value })}
                                            onBlur={blurSave}
                                        />
                                        {fieldErrors[`fac_state_${i}`] && (
                                            <span className="cob-field-error">{fieldErrors[`fac_state_${i}`]}</span>
                                        )}
                                    </label>
                                    <label className="cob-field">
                                        <span className="cob-label">Country</span>
                                        <input
                                            className="cob-input"
                                            value={f.country}
                                            onChange={(e) => updateFacility(f.id, { country: e.target.value })}
                                            onBlur={blurSave}
                                        />
                                        {fieldErrors[`fac_country_${i}`] && (
                                            <span className="cob-field-error">{fieldErrors[`fac_country_${i}`]}</span>
                                        )}
                                    </label>
                                    <label className="cob-field">
                                        <span className="cob-label">PIN / Postal code</span>
                                        <input
                                            className="cob-input"
                                            value={f.pinCode}
                                            onChange={(e) => updateFacility(f.id, { pinCode: e.target.value })}
                                            onBlur={blurSave}
                                        />
                                        {fieldErrors[`fac_pin_${i}`] && (
                                            <span className="cob-field-error">{fieldErrors[`fac_pin_${i}`]}</span>
                                        )}
                                    </label>
                                    <label className="cob-field">
                                        <span className="cob-label">Total area</span>
                                        <input
                                            type="number"
                                            min="0"
                                            step="any"
                                            className="cob-input"
                                            value={f.totalArea}
                                            onChange={(e) => updateFacility(f.id, { totalArea: e.target.value })}
                                            onBlur={blurSave}
                                        />
                                        {fieldErrors[`fac_area_${i}`] && (
                                            <span className="cob-field-error">{fieldErrors[`fac_area_${i}`]}</span>
                                        )}
                                    </label>
                                    <label className="cob-field">
                                        <span className="cob-label">Area unit</span>
                                        <select
                                            className="cob-input"
                                            value={f.totalAreaUnit}
                                            onChange={(e) => updateFacility(f.id, { totalAreaUnit: e.target.value })}
                                            onBlur={blurSave}
                                        >
                                            <option value="SQ_M">sq. m</option>
                                            <option value="SQ_FT">sq. ft</option>
                                        </select>
                                    </label>
                                </div>
                                <div style={{ marginTop: 16 }}>
                                    <span className="cob-label" style={{ display: 'block', marginBottom: 8 }}>
                                        Renewable electricity production on site?
                                    </span>
                                    <YesNoField
                                        name={`fac_re_${f.id}`}
                                        value={f.renewableElectricityProduction}
                                        onPick={(v) => updateFacility(f.id, { renewableElectricityProduction: v })}
                                    />
                                </div>
                                {f.renewableElectricityProduction && (
                                    <div style={{ marginTop: 14 }}>
                                        <span className="cob-label" style={{ display: 'block', marginBottom: 10 }}>
                                            Monthly production (kWh)
                                        </span>
                                        <div
                                            className="cob-grid"
                                            style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))' }}
                                        >
                                            {MONTH_LABELS.map((label, mi) => (
                                                <label key={label} className="cob-field">
                                                    <span className="cob-label">{label}</span>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="any"
                                                        className="cob-input"
                                                        value={f.monthlyProductionKwh[mi]}
                                                        onChange={(e) => {
                                                            const next = [...f.monthlyProductionKwh];
                                                            next[mi] = e.target.value;
                                                            updateFacility(f.id, { monthlyProductionKwh: next });
                                                        }}
                                                        onBlur={blurSave}
                                                    />
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </section>
                )}

                {step === 2 && (
                    <section className="cob-section cob-section-panel">
                        <div className="cob-section-head">
                            <span className="cob-section-icon" aria-hidden="true">
                                <i className="fas fa-plug" />
                            </span>
                            <h2 className="cob-section-title">5.2 Purchased energy sources</h2>
                        </div>
                        <p className="cob-lead" style={{ marginBottom: 16 }}>
                            Toggle each energy type you purchase. Supplier address is used to map emission factors by grid
                            region (market-based Scope 2).
                        </p>
                        {purchasedBlock(
                            'purchasedElectricity',
                            'Purchased electricity',
                            'Grid or retailer-supplied power.'
                        )}
                        {purchasedBlock('purchasedHeating', 'Purchased heating', 'District heat or purchased thermal energy.')}
                        {purchasedBlock('purchasedCooling', 'Purchased cooling', 'District cooling or similar.')}
                        {purchasedBlock('purchasedSteam', 'Purchased steam', 'Imported steam / industrial steam supply.')}
                    </section>
                )}

                {step === 3 && (
                    <section className="cob-section cob-section-panel">
                        <header className="cob-page-header cob-page-header--review">
                            <div className="cob-page-header-icon cob-page-header-icon--review" aria-hidden="true">
                                <i className="fas fa-clipboard-check" />
                            </div>
                            <div>
                                <h1 className="cob-page-title">Review Scope 2 baseline</h1>
                                <p className="cob-lead">Confirm facility and supplier details before submitting.</p>
                            </div>
                        </header>
                        <div className="cob-summary" style={{ marginTop: 16 }}>
                            <h3 style={{ marginBottom: 8 }}>Facilities ({s2.facilities.length})</h3>
                            <ul style={{ paddingLeft: 18, margin: '0 0 20px' }}>
                                {s2.facilities.map((f, i) => (
                                    <li key={f.id} style={{ marginBottom: 8 }}>
                                        <strong>{f.name || `Facility ${i + 1}`}</strong> —{' '}
                                        {FACILITY_TYPE_OPTIONS.find((x) => x.value === f.facilityType)?.label}
                                        {f.facilityType === 'OTHER' && f.facilityTypeOther ? ` (${f.facilityTypeOther})` : ''}
                                        <br />
                                        <span style={{ color: '#64748b', fontSize: 13 }}>
                                            {f.city}, {f.state}, {f.country} {f.pinCode} · {f.totalArea}{' '}
                                            {f.totalAreaUnit === 'SQ_FT' ? 'sq. ft' : 'sq. m'}
                                            {f.renewableElectricityProduction
                                                ? ` · On-site renewable (12-mo kWh sum: ${twelveMonthlyKwh(f.monthlyProductionKwh).reduce((a, b) => a + b, 0)})`
                                                : ''}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                            <h3 style={{ marginBottom: 8 }}>Purchased energy</h3>
                            <ul style={{ paddingLeft: 18, margin: 0 }}>
                                {[
                                    ['purchasedElectricity', 'Electricity'],
                                    ['purchasedHeating', 'Heating'],
                                    ['purchasedCooling', 'Cooling'],
                                    ['purchasedSteam', 'Steam'],
                                ].map(([key, label]) => {
                                    const p = s2[key];
                                    return (
                                        <li key={key} style={{ marginBottom: 8 }}>
                                            <strong>{label}:</strong>{' '}
                                            {p.enabled ? (
                                                <>
                                                    {p.supplierName} — <em>{p.supplierAddress}</em>
                                                </>
                                            ) : (
                                                <span style={{ color: '#64748b' }}>Not applicable</span>
                                            )}
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    </section>
                )}

                <div className="cob-actions">
                    {step > 1 ? (
                        <button type="button" className="cob-btn ghost" onClick={goBack}>
                            Back
                        </button>
                    ) : (
                        <span />
                    )}
                    {step < 3 ? (
                        <button type="button" className="cob-btn primary" onClick={goNext}>
                            Save &amp; continue
                        </button>
                    ) : (
                        <button type="button" className="cob-btn primary" disabled={submitting} onClick={handleSubmit}>
                            {submitting ? 'Submitting…' : 'Submit Scope 2'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

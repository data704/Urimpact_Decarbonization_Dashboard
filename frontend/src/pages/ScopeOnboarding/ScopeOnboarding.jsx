import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import {
    fetchOrganizationMe,
    saveScopeOnboardingDraftApi,
    submitScope1OnboardingApi,
} from '../../api/client.js';
import '../CompanyOnboarding/CompanyOnboarding.css';
import { ISIC_SECTORS } from '../../data/isicRev4GHGSectors.js';
import { PROCESS_SECTORS, typesForProcessSector } from '../../data/scope1ProcessEmissions.js';
import { readSitesForOrganization } from '../../utils/dataInputSitesStorage.js';
import { onboardingFacilitiesToSiteOptions } from '../../utils/onboardingFacilities.js';
import { canOpenRevisitOnboarding } from '../../utils/onboardingRevisit.js';

const DRAFT_PREFIX = 'urimpact_scope1_onboarding_draft_';

const VEHICLE_TYPES = [
    { value: '2_WHEELER', label: '2-Wheeler' },
    { value: '3_WHEELER', label: '3-Wheeler' },
    { value: '4_WHEELER', label: '4-Wheeler' },
];

const VEHICLE_FUELS = [
    { value: 'CNG', label: 'CNG' },
    { value: 'DIESEL', label: 'Diesel' },
    { value: 'PETROL', label: 'Petrol' },
    { value: 'ELECTRIC', label: 'Electric' },
    { value: 'HYBRID', label: 'Hybrid' },
];

const ASSET_TYPES = [
    { value: 'BOILER', label: 'Boiler' },
    { value: 'GENSET', label: 'Genset' },
    { value: 'FURNACE', label: 'Furnace' },
    { value: 'DG_SET', label: 'DG Set' },
    { value: 'KILN', label: 'Kiln' },
    { value: 'OTHER', label: 'Other' },
];

const STATIONARY_FUELS = [
    { value: 'COAL', label: 'Coal' },
    { value: 'KEROSENE', label: 'Kerosene' },
    { value: 'CNG', label: 'CNG' },
    { value: 'LPG', label: 'LPG' },
    { value: 'DIESEL', label: 'Diesel' },
    { value: 'NATURAL_GAS', label: 'Natural Gas' },
    { value: 'BIOMASS', label: 'Biomass' },
];

const EQUIPMENT_TYPES = [
    { value: 'AC', label: 'AC' },
    { value: 'CHILLER', label: 'Chiller' },
    { value: 'REFRIGERATOR', label: 'Refrigerator' },
    { value: 'FIRE_EXTINGUISHER', label: 'Fire Extinguisher' },
];

const REFRIGERANT_GASES = [
    { value: 'HFC_134a', label: 'HFC-134a' },
    { value: 'R_32', label: 'R-32' },
    { value: 'R_410A', label: 'R-410A' },
    { value: 'CO2', label: 'CO₂' },
    { value: 'HALON', label: 'Halon' },
    { value: 'OTHER', label: 'Other' },
];

const newId = () =>
    typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `r_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

const emptyScope1 = () => ({
    hasOwnedVehicles: false,
    vehicles: [],
    hasOwnedStationaryAssets: false,
    stationaryAssets: [],
    hasRefrigerantEquipment: false,
    refrigerantRows: [],
    hasProcessEmissions: false,
    processEmissionRows: [],
});

const defaultVehicle = () => ({
    id: newId(),
    vehicleType: '4_WHEELER',
    vehicleNumber: '',
    fuelUsed: 'PETROL',
});

const defaultStationary = () => ({
    id: newId(),
    assetType: 'BOILER',
    assetName: '',
    fuelUsed: 'NATURAL_GAS',
});

const defaultRefrigerant = () => ({
    id: newId(),
    equipmentName: '',
    equipmentType: 'AC',
    quantity: '',
    refilledInPeriod: false,
    gasRefilled: null,
});

function createDefaultProcessRow(firstSite) {
    const types = typesForProcessSector('CEMENT');
    const pt = types[0]?.value || 'CLINKER_PRODUCTION';
    return {
        id: newId(),
        facilitySiteId: firstSite?.id || 'ORG_LEVEL',
        facilityLabel: firstSite
            ? `${firstSite.name} (${firstSite.code})`
            : 'Organization-level (complete facility mapping in company onboarding)',
        processSector: 'CEMENT',
        processType: pt,
        processTypeOther: '',
    };
}

function labelForProcessSectorAndType(sectorValue, typeValue) {
    const sec = PROCESS_SECTORS.find((s) => s.value === sectorValue);
    const t = sec?.types?.find((x) => x.value === typeValue);
    return t?.label || typeValue;
}

function canCompleteOnboarding(role) {
    const r = String(role || '').toUpperCase();
    return r === 'ADMINISTRATOR' || r === 'SUPER_ADMIN';
}

function mapScope1FromServer(raw) {
    if (!raw || typeof raw !== 'object') return emptyScope1();
    const o = raw;
    return {
        hasOwnedVehicles: !!o.hasOwnedVehicles,
        vehicles: Array.isArray(o.vehicles)
            ? o.vehicles.map((v, i) => ({
                  id: v.id || `v-${i}`,
                  vehicleType: v.vehicleType || '4_WHEELER',
                  vehicleNumber: v.vehicleNumber ?? '',
                  fuelUsed: v.fuelUsed || 'PETROL',
              }))
            : [],
        hasOwnedStationaryAssets: !!o.hasOwnedStationaryAssets,
        stationaryAssets: Array.isArray(o.stationaryAssets)
            ? o.stationaryAssets.map((a, i) => ({
                  id: a.id || `a-${i}`,
                  assetType: a.assetType || 'BOILER',
                  assetName: a.assetName ?? '',
                  fuelUsed: a.fuelUsed || 'NATURAL_GAS',
              }))
            : [],
        hasRefrigerantEquipment: !!o.hasRefrigerantEquipment,
        refrigerantRows: Array.isArray(o.refrigerantRows)
            ? o.refrigerantRows.map((r, i) => ({
                  id: r.id || `f-${i}`,
                  equipmentName: r.equipmentName ?? '',
                  equipmentType: r.equipmentType || 'AC',
                  quantity:
                      r.quantity !== undefined && r.quantity !== null ? String(r.quantity) : '',
                  refilledInPeriod: !!r.refilledInPeriod,
                  gasRefilled: r.gasRefilled ?? null,
              }))
            : [],
        hasProcessEmissions: !!o.hasProcessEmissions,
        processEmissionRows: Array.isArray(o.processEmissionRows)
            ? o.processEmissionRows.map((p, i) => ({
                  id: p.id || `p-${i}`,
                  facilitySiteId: p.facilitySiteId || 'ORG_LEVEL',
                  facilityLabel: p.facilityLabel ?? '',
                  processSector: p.processSector || 'CEMENT',
                  processType: p.processType || 'CLINKER_PRODUCTION',
                  processTypeOther: p.processTypeOther ?? '',
              }))
            : [],
    };
}

function toSubmitPayload(s) {
    return {
        hasOwnedVehicles: !!s.hasOwnedVehicles,
        vehicles: (s.vehicles || []).map(({ vehicleType, vehicleNumber, fuelUsed }) => ({
            vehicleType,
            vehicleNumber: String(vehicleNumber || '').trim(),
            fuelUsed,
        })),
        hasOwnedStationaryAssets: !!s.hasOwnedStationaryAssets,
        stationaryAssets: (s.stationaryAssets || []).map(({ assetType, assetName, fuelUsed }) => ({
            assetType,
            assetName: String(assetName || '').trim(),
            fuelUsed,
        })),
        hasRefrigerantEquipment: !!s.hasRefrigerantEquipment,
        refrigerantRows: (s.refrigerantRows || []).map((row) => ({
            equipmentName: String(row.equipmentName || '').trim(),
            equipmentType: row.equipmentType,
            quantity: parseInt(String(row.quantity).trim(), 10),
            refilledInPeriod: !!row.refilledInPeriod,
            gasRefilled: row.refilledInPeriod ? row.gasRefilled || null : null,
        })),
        hasProcessEmissions: !!s.hasProcessEmissions,
        processEmissionRows: (s.processEmissionRows || []).map((row) => {
            const needOther =
                row.processSector === 'OTHER' ||
                (row.processType && String(row.processType).endsWith('_OTHER')) ||
                row.processType === 'OTHER_SPECIFY';
            const other = String(row.processTypeOther || '').trim();
            return {
                facilitySiteId: String(row.facilitySiteId || '').trim() || 'ORG_LEVEL',
                facilityLabel: String(row.facilityLabel || '').trim(),
                processSector: row.processSector,
                processType: row.processType,
                processTypeOther: needOther && other.length ? other : null,
            };
        }),
    };
}

export default function ScopeOnboarding() {
    const { t } = useTranslation();
    const { user, refreshSession } = useAuth();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const allowWizardRevisit = canOpenRevisitOnboarding(user?.role, searchParams);
    const [step, setStep] = useState(1);
    const [s1, setS1] = useState(emptyScope1);
    const [fieldErrors, setFieldErrors] = useState({});
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [canEditOrg, setCanEditOrg] = useState(true);
    const [orgIsicDisplay, setOrgIsicDisplay] = useState({
        sectorLabel: '—',
        subsectorLabel: '—',
    });
    const [organization, setOrganization] = useState(null);

    const facilitySites = useMemo(() => {
        const fromApi = organization?.onboardingFacilities;
        if (Array.isArray(fromApi) && fromApi.length > 0) {
            return onboardingFacilitiesToSiteOptions(fromApi);
        }
        return readSitesForOrganization(user?.organizationId);
    }, [organization?.onboardingFacilities, user?.organizationId]);

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
            setS1((prev) => {
                const next = typeof updater === 'function' ? updater(prev) : { ...prev, ...updater };
                persistLocal(next);
                return next;
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

                setOrganization(data.organization || null);

                const sector = ISIC_SECTORS.find((x) => x.code === org?.sectorIsicCode);
                const subObj = sector?.subsectors?.find((s) => s.code === org?.subSectorIsicCode);
                if (!cancelled) {
                    setOrgIsicDisplay({
                        sectorLabel: sector?.label ?? '—',
                        subsectorLabel: subObj?.label ?? '—',
                    });
                }

                const fromDraft = org?.scopeOnboardingDraft?.scope1;
                const fromInv = org?.scope1Inventory;
                let merged = mapScope1FromServer(fromDraft || fromInv);

                if (user?.organizationId) {
                    try {
                        const raw = localStorage.getItem(`${DRAFT_PREFIX}${user.organizationId}`);
                        if (raw) {
                            const parsed = JSON.parse(raw);
                            merged = mapScope1FromServer({ ...merged, ...parsed });
                        }
                    } catch (_) {
                        /* ignore */
                    }
                }

                if (!cancelled) setS1(merged);
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

    if (user.scope1OnboardingComplete && !allowWizardRevisit) {
        return <Navigate to="/" replace />;
    }

    if (!canCompleteOnboarding(user.role)) {
        return <Navigate to="/" replace />;
    }

    const blurSave = async () => {
        try {
            await saveScopeOnboardingDraftApi({ scope1: toSubmitPayload(s1) });
        } catch (_) {
            /* draft remains in localStorage */
        }
    };

    const validateStep = (n) => {
        const err = {};
        if (n === 1) {
            if (s1.hasOwnedVehicles) {
                if (!s1.vehicles.length) err.vehicles = 'Add at least one vehicle or choose No';
                s1.vehicles.forEach((v, i) => {
                    if (!String(v.vehicleNumber || '').trim()) err[`v_num_${i}`] = 'Required';
                    const plate = String(v.vehicleNumber || '').trim();
                    if (plate && !/^[a-zA-Z0-9\s\-]+$/.test(plate)) {
                        err[`v_num_${i}`] = 'Alphanumeric (plate format)';
                    }
                });
            }
        }
        if (n === 2) {
            if (s1.hasOwnedStationaryAssets) {
                if (!s1.stationaryAssets.length) err.stationary = 'Add at least one asset or choose No';
                s1.stationaryAssets.forEach((a, i) => {
                    if (!String(a.assetName || '').trim()) err[`a_name_${i}`] = 'Required';
                });
            }
        }
        if (n === 3) {
            if (s1.hasRefrigerantEquipment) {
                if (!s1.refrigerantRows.length) err.refrigerant = 'Add at least one row or choose No';
                s1.refrigerantRows.forEach((r, i) => {
                    if (!String(r.equipmentName || '').trim()) err[`f_name_${i}`] = 'Required';
                    const q = parseInt(String(r.quantity).trim(), 10);
                    if (!r.quantity || Number.isNaN(q) || q < 1) err[`f_qty_${i}`] = 'Positive integer';
                    if (r.refilledInPeriod && !r.gasRefilled) err[`f_gas_${i}`] = 'Select gas type';
                });
            }
        }
        if (n === 4) {
            if (s1.hasProcessEmissions) {
                if (!s1.processEmissionRows.length) err.process = 'Add at least one row or choose No';
                s1.processEmissionRows.forEach((row, i) => {
                    if (!String(row.facilitySiteId || '').trim()) err[`p_fac_${i}`] = 'Select a facility';
                    if (!String(row.facilityLabel || '').trim()) err[`p_flab_${i}`] = 'Required';
                    if (row.processSector === 'OTHER') {
                        if (!String(row.processTypeOther || '').trim()) err[`p_ot_${i}`] = 'Describe the process';
                    } else if (row.processType && String(row.processType).endsWith('_OTHER')) {
                        if (!String(row.processTypeOther || '').trim()) err[`p_ot_${i}`] = 'Specify the process';
                    }
                });
            }
        }
        setFieldErrors(err);
        return Object.keys(err).length === 0;
    };

    const goNext = async () => {
        if (!validateStep(step)) return;
        await blurSave();
        setStep((x) => Math.min(5, x + 1));
        window.scrollTo(0, 0);
    };

    const goBack = () => {
        setStep((x) => Math.max(1, x - 1));
        window.scrollTo(0, 0);
    };

    const handleSubmit = async () => {
        for (let i = 1; i <= 4; i += 1) {
            if (!validateStep(i)) {
                setStep(i);
                return;
            }
        }
        setSubmitting(true);
        try {
            await submitScope1OnboardingApi(toSubmitPayload(s1));
            if (user?.organizationId) {
                try {
                    localStorage.removeItem(`${DRAFT_PREFIX}${user.organizationId}`);
                } catch (_) {
                    /* ignore */
                }
            }
            await refreshSession();
            setToast('Scope 1 saved. Continue with Scope 2.');
            setTimeout(
                () => navigate(allowWizardRevisit ? '/' : '/scope-2-onboarding', { replace: true }),
                800
            );
        } catch (e) {
            setToast(e?.message || 'Submission failed');
        } finally {
            setSubmitting(false);
        }
    };

    const applyYesNo = (key, value) => {
        setFieldErrors({});
        setScope((prev) => {
            const next = { ...prev, [key]: value };
            if (key === 'hasOwnedVehicles') {
                next.vehicles = value ? (prev.vehicles.length ? prev.vehicles : [defaultVehicle()]) : [];
            }
            if (key === 'hasOwnedStationaryAssets') {
                next.stationaryAssets = value
                    ? prev.stationaryAssets.length
                        ? prev.stationaryAssets
                        : [defaultStationary()]
                    : [];
            }
            if (key === 'hasRefrigerantEquipment') {
                next.refrigerantRows = value
                    ? prev.refrigerantRows.length
                        ? prev.refrigerantRows
                        : [defaultRefrigerant()]
                    : [];
            }
            if (key === 'hasProcessEmissions') {
                const sites = readSitesForOrganization(user?.organizationId);
                next.processEmissionRows = value
                    ? prev.processEmissionRows.length
                        ? prev.processEmissionRows
                        : [createDefaultProcessRow(sites[0])]
                    : [];
            }
            persistLocal(next);
            return next;
        });
    };

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

    const updateVehicle = (id, patch) => {
        setScope((prev) => ({
            ...prev,
            vehicles: prev.vehicles.map((v) => (v.id === id ? { ...v, ...patch } : v)),
        }));
        setFieldErrors((e) => {
            const next = { ...e };
            Object.keys(next).forEach((k) => {
                if (k.startsWith('v_')) delete next[k];
            });
            return next;
        });
    };

    const addVehicle = () => {
        setScope((prev) => ({ ...prev, vehicles: [...prev.vehicles, defaultVehicle()] }));
    };

    const removeVehicle = (id) => {
        setScope((prev) => ({
            ...prev,
            vehicles: prev.vehicles.filter((v) => v.id !== id),
        }));
    };

    const updateStationary = (id, patch) => {
        setScope((prev) => ({
            ...prev,
            stationaryAssets: prev.stationaryAssets.map((a) => (a.id === id ? { ...a, ...patch } : a)),
        }));
        setFieldErrors((e) => {
            const next = { ...e };
            Object.keys(next).forEach((k) => {
                if (k.startsWith('a_')) delete next[k];
            });
            return next;
        });
    };

    const addStationary = () => {
        setScope((prev) => ({
            ...prev,
            stationaryAssets: [...prev.stationaryAssets, defaultStationary()],
        }));
    };

    const removeStationary = (id) => {
        setScope((prev) => ({
            ...prev,
            stationaryAssets: prev.stationaryAssets.filter((a) => a.id !== id),
        }));
    };

    const updateRefrigerant = (id, patch) => {
        setScope((prev) => ({
            ...prev,
            refrigerantRows: prev.refrigerantRows.map((r) =>
                r.id === id
                    ? {
                          ...r,
                          ...patch,
                          ...(patch.refilledInPeriod === false ? { gasRefilled: null } : {}),
                      }
                    : r
            ),
        }));
        setFieldErrors((e) => {
            const next = { ...e };
            Object.keys(next).forEach((k) => {
                if (k.startsWith('f_')) delete next[k];
            });
            return next;
        });
    };

    const addRefrigerant = () => {
        setScope((prev) => ({
            ...prev,
            refrigerantRows: [...prev.refrigerantRows, defaultRefrigerant()],
        }));
    };

    const removeRefrigerant = (id) => {
        setScope((prev) => ({
            ...prev,
            refrigerantRows: prev.refrigerantRows.filter((r) => r.id !== id),
        }));
    };

    const updateProcessRow = (id, patch) => {
        setScope((prev) => ({
            ...prev,
            processEmissionRows: prev.processEmissionRows.map((r) => {
                if (r.id !== id) return r;
                const next = { ...r, ...patch };
                if (patch.processSector != null && patch.processSector !== r.processSector) {
                    const ts = typesForProcessSector(patch.processSector);
                    next.processType = ts[0]?.value || 'OTHER_SPECIFY';
                    if (patch.processSector !== 'OTHER') next.processTypeOther = '';
                }
                if (patch.processType != null) {
                    const endsOther = String(patch.processType).endsWith('_OTHER');
                    if (!endsOther && patch.processType !== 'OTHER_SPECIFY') {
                        next.processTypeOther = '';
                    }
                }
                return next;
            }),
        }));
        setFieldErrors((e) => {
            const next = { ...e };
            Object.keys(next).forEach((k) => {
                if (k.startsWith('p_')) delete next[k];
            });
            return next;
        });
    };

    const addProcessRow = () => {
        setScope((prev) => ({
            ...prev,
            processEmissionRows: [...prev.processEmissionRows, createDefaultProcessRow(facilitySites[0])],
        }));
    };

    const removeProcessRow = (id) => {
        setScope((prev) => ({
            ...prev,
            processEmissionRows: prev.processEmissionRows.filter((r) => r.id !== id),
        }));
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
                    <p className="cob-lead">
                        You do not have permission to edit scope onboarding for this organization.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="cob-page">
            {allowWizardRevisit && (
                <div className="cob-revisit-banner" role="status">
                    <i className="fas fa-pen-to-square" aria-hidden />
                    <span>{t('onboarding.revisitBannerScope1')}</span>
                </div>
            )}
            {toast && (
                <div
                    className={`cob-toast ${
                        toast.includes('failed') || toast.includes('Submit') ? 'cob-toast-err' : ''
                    }`}
                >
                    {toast}
                </div>
            )}
            <div className="cob-inner">
                <nav className="cob-stepper" aria-label="Scope 1 onboarding progress">
                    {[1, 2, 3, 4, 5].map((n, idx) => (
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
                                        {n === 1 && 'Owned vehicles'}
                                        {n === 2 && 'Stationary assets'}
                                        {n === 3 && 'Refrigerants'}
                                        {n === 4 && 'Process sources'}
                                        {n === 5 && 'Review'}
                                    </span>
                                    <span className="cob-step-sub">
                                        {n === 1 && 'Mobile combustion (Scope 1)'}
                                        {n === 2 && 'Boilers, gensets, furnaces'}
                                        {n === 3 && 'AC, chillers, extinguishers'}
                                        {n === 4 && 'Industrial process emissions'}
                                        {n === 5 && 'Confirm & submit'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))}
                </nav>

                <header className="cob-page-header">
                    <div className="cob-page-header-icon" aria-hidden="true">
                        <i className="fas fa-leaf" />
                    </div>
                    <div>
                        <h1 className="cob-page-title">Scope 1 · Asset discovery</h1>
                        <p className="cob-lead">
                            Direct emissions from owned or controlled sources (GHG Protocol Corporate Standard). Progress
                            is saved when you continue or leave a field.
                        </p>
                    </div>
                </header>

                {step === 1 && (
                    <section className="cob-section cob-section-panel">
                        <div className="cob-section-head">
                            <span className="cob-section-icon" aria-hidden="true">
                                <i className="fas fa-truck-pickup" />
                            </span>
                            <h2 className="cob-section-title">Owned vehicles</h2>
                        </div>
                        <p className="cob-lead" style={{ marginBottom: 12 }}>
                            Do you have owned vehicles?
                        </p>
                        <YesNoField
                            name="scope1_vehicles"
                            value={s1.hasOwnedVehicles}
                            onPick={(v) => applyYesNo('hasOwnedVehicles', v)}
                        />
                        {fieldErrors.vehicles && <span className="cob-field-error">{fieldErrors.vehicles}</span>}

                        {s1.hasOwnedVehicles && (
                            <>
                                <div style={{ marginTop: 20 }} />
                                {s1.vehicles.map((v, i) => (
                                    <div
                                        key={v.id}
                                        className="cob-section-panel"
                                        style={{ marginBottom: 16, padding: 16, borderRadius: 12 }}
                                    >
                                        <div
                                            style={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                marginBottom: 12,
                                            }}
                                        >
                                            <strong>Vehicle {i + 1}</strong>
                                            {s1.vehicles.length > 1 && (
                                                <button
                                                    type="button"
                                                    className="cob-btn ghost"
                                                    style={{ padding: '6px 12px', fontSize: 13 }}
                                                    onClick={() => removeVehicle(v.id)}
                                                >
                                                    Remove
                                                </button>
                                            )}
                                        </div>
                                        <div className="cob-grid">
                                            <div className="cob-field">
                                                <label>Vehicle type</label>
                                                <select
                                                    value={v.vehicleType}
                                                    onBlur={blurSave}
                                                    onChange={(e) =>
                                                        updateVehicle(v.id, { vehicleType: e.target.value })
                                                    }
                                                >
                                                    {VEHICLE_TYPES.map((o) => (
                                                        <option key={o.value} value={o.value}>
                                                            {o.label}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="cob-field">
                                                <label>Vehicle number (plate)</label>
                                                <input
                                                    value={v.vehicleNumber}
                                                    onBlur={blurSave}
                                                    onChange={(e) =>
                                                        updateVehicle(v.id, { vehicleNumber: e.target.value })
                                                    }
                                                />
                                                {fieldErrors[`v_num_${i}`] && (
                                                    <span className="cob-field-error">{fieldErrors[`v_num_${i}`]}</span>
                                                )}
                                            </div>
                                            <div className="cob-field cob-span2">
                                                <label>Fuel used</label>
                                                <select
                                                    value={v.fuelUsed}
                                                    onBlur={blurSave}
                                                    onChange={(e) =>
                                                        updateVehicle(v.id, { fuelUsed: e.target.value })
                                                    }
                                                >
                                                    {VEHICLE_FUELS.map((o) => (
                                                        <option key={o.value} value={o.value}>
                                                            {o.label}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                <button type="button" className="cob-btn ghost" onClick={addVehicle}>
                                    + Add another vehicle
                                </button>
                            </>
                        )}
                    </section>
                )}

                {step === 2 && (
                    <section className="cob-section cob-section-panel">
                        <div className="cob-section-head">
                            <span className="cob-section-icon" aria-hidden="true">
                                <i className="fas fa-industry" />
                            </span>
                            <h2 className="cob-section-title">Owned stationary assets</h2>
                        </div>
                        <p className="cob-lead" style={{ marginBottom: 12 }}>
                            Do you have owned assets (stationary combustion)?
                        </p>
                        <YesNoField
                            name="scope1_stationary"
                            value={s1.hasOwnedStationaryAssets}
                            onPick={(v) => applyYesNo('hasOwnedStationaryAssets', v)}
                        />
                        {fieldErrors.stationary && (
                            <span className="cob-field-error">{fieldErrors.stationary}</span>
                        )}

                        {s1.hasOwnedStationaryAssets && (
                            <>
                                <div style={{ marginTop: 20 }} />
                                {s1.stationaryAssets.map((a, i) => (
                                    <div
                                        key={a.id}
                                        className="cob-section-panel"
                                        style={{ marginBottom: 16, padding: 16, borderRadius: 12 }}
                                    >
                                        <div
                                            style={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                marginBottom: 12,
                                            }}
                                        >
                                            <strong>Asset {i + 1}</strong>
                                            {s1.stationaryAssets.length > 1 && (
                                                <button
                                                    type="button"
                                                    className="cob-btn ghost"
                                                    style={{ padding: '6px 12px', fontSize: 13 }}
                                                    onClick={() => removeStationary(a.id)}
                                                >
                                                    Remove
                                                </button>
                                            )}
                                        </div>
                                        <div className="cob-grid">
                                            <div className="cob-field">
                                                <label>Asset type</label>
                                                <select
                                                    value={a.assetType}
                                                    onBlur={blurSave}
                                                    onChange={(e) =>
                                                        updateStationary(a.id, { assetType: e.target.value })
                                                    }
                                                >
                                                    {ASSET_TYPES.map((o) => (
                                                        <option key={o.value} value={o.value}>
                                                            {o.label}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="cob-field">
                                                <label>Asset name / ID</label>
                                                <input
                                                    value={a.assetName}
                                                    onBlur={blurSave}
                                                    onChange={(e) =>
                                                        updateStationary(a.id, { assetName: e.target.value })
                                                    }
                                                />
                                                {fieldErrors[`a_name_${i}`] && (
                                                    <span className="cob-field-error">{fieldErrors[`a_name_${i}`]}</span>
                                                )}
                                            </div>
                                            <div className="cob-field cob-span2">
                                                <label>Fuel used</label>
                                                <select
                                                    value={a.fuelUsed}
                                                    onBlur={blurSave}
                                                    onChange={(e) =>
                                                        updateStationary(a.id, { fuelUsed: e.target.value })
                                                    }
                                                >
                                                    {STATIONARY_FUELS.map((o) => (
                                                        <option key={o.value} value={o.value}>
                                                            {o.label}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                <button type="button" className="cob-btn ghost" onClick={addStationary}>
                                    + Add another asset
                                </button>
                            </>
                        )}
                    </section>
                )}

                {step === 3 && (
                    <section className="cob-section cob-section-panel">
                        <div className="cob-section-head">
                            <span className="cob-section-icon" aria-hidden="true">
                                <i className="fas fa-fan" />
                            </span>
                            <h2 className="cob-section-title">Refrigerants &amp; fugitive sources</h2>
                        </div>
                        <p className="cob-lead" style={{ marginBottom: 12 }}>
                            Do you have ACs, chillers, refrigerators, or fire extinguishers with refrigerants / gases?
                        </p>
                        <YesNoField
                            name="scope1_refrigerant"
                            value={s1.hasRefrigerantEquipment}
                            onPick={(v) => applyYesNo('hasRefrigerantEquipment', v)}
                        />
                        {fieldErrors.refrigerant && (
                            <span className="cob-field-error">{fieldErrors.refrigerant}</span>
                        )}

                        {s1.hasRefrigerantEquipment && (
                            <>
                                <div style={{ marginTop: 20 }} />
                                {s1.refrigerantRows.map((r, i) => (
                                    <div
                                        key={r.id}
                                        className="cob-section-panel"
                                        style={{ marginBottom: 16, padding: 16, borderRadius: 12 }}
                                    >
                                        <div
                                            style={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                marginBottom: 12,
                                            }}
                                        >
                                            <strong>Equipment {i + 1}</strong>
                                            {s1.refrigerantRows.length > 1 && (
                                                <button
                                                    type="button"
                                                    className="cob-btn ghost"
                                                    style={{ padding: '6px 12px', fontSize: 13 }}
                                                    onClick={() => removeRefrigerant(r.id)}
                                                >
                                                    Remove
                                                </button>
                                            )}
                                        </div>
                                        <div className="cob-grid">
                                            <div className="cob-field cob-span2">
                                                <label>Equipment name</label>
                                                <input
                                                    placeholder="e.g. AC — Office Floor 2"
                                                    value={r.equipmentName}
                                                    onBlur={blurSave}
                                                    onChange={(e) =>
                                                        updateRefrigerant(r.id, { equipmentName: e.target.value })
                                                    }
                                                />
                                                {fieldErrors[`f_name_${i}`] && (
                                                    <span className="cob-field-error">{fieldErrors[`f_name_${i}`]}</span>
                                                )}
                                            </div>
                                            <div className="cob-field">
                                                <label>Equipment type</label>
                                                <select
                                                    value={r.equipmentType}
                                                    onBlur={blurSave}
                                                    onChange={(e) =>
                                                        updateRefrigerant(r.id, { equipmentType: e.target.value })
                                                    }
                                                >
                                                    {EQUIPMENT_TYPES.map((o) => (
                                                        <option key={o.value} value={o.value}>
                                                            {o.label}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="cob-field">
                                                <label>Quantity (units)</label>
                                                <input
                                                    type="number"
                                                    min={1}
                                                    step={1}
                                                    value={r.quantity}
                                                    onBlur={blurSave}
                                                    onChange={(e) =>
                                                        updateRefrigerant(r.id, { quantity: e.target.value })
                                                    }
                                                />
                                                {fieldErrors[`f_qty_${i}`] && (
                                                    <span className="cob-field-error">{fieldErrors[`f_qty_${i}`]}</span>
                                                )}
                                            </div>
                                            <div className="cob-field cob-toggle cob-span2">
                                                <label style={{ display: 'block', marginBottom: 8 }}>
                                                    Refilled in reporting period?
                                                </label>
                                                <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                                                    <label style={{ cursor: 'pointer' }}>
                                                        <input
                                                            type="radio"
                                                            checked={r.refilledInPeriod === true}
                                                            onChange={() =>
                                                                updateRefrigerant(r.id, { refilledInPeriod: true })
                                                            }
                                                        />{' '}
                                                        Yes
                                                    </label>
                                                    <label style={{ cursor: 'pointer' }}>
                                                        <input
                                                            type="radio"
                                                            checked={r.refilledInPeriod === false}
                                                            onChange={() =>
                                                                updateRefrigerant(r.id, { refilledInPeriod: false })
                                                            }
                                                        />{' '}
                                                        No
                                                    </label>
                                                </div>
                                            </div>
                                            {r.refilledInPeriod && (
                                                <div className="cob-field cob-span2">
                                                    <label>Name of gas refilled</label>
                                                    <select
                                                        value={r.gasRefilled || ''}
                                                        onBlur={blurSave}
                                                        onChange={(e) =>
                                                            updateRefrigerant(r.id, {
                                                                gasRefilled: e.target.value || null,
                                                            })
                                                        }
                                                    >
                                                        <option value="">Select gas</option>
                                                        {REFRIGERANT_GASES.map((o) => (
                                                            <option key={o.value} value={o.value}>
                                                                {o.label}
                                                            </option>
                                                        ))}
                                                    </select>
                                                    {fieldErrors[`f_gas_${i}`] && (
                                                        <span className="cob-field-error">{fieldErrors[`f_gas_${i}`]}</span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                                <button type="button" className="cob-btn ghost" onClick={addRefrigerant}>
                                    + Add another row
                                </button>
                            </>
                        )}
                    </section>
                )}

                {step === 4 && (
                    <section className="cob-section cob-section-panel">
                        <div className="cob-section-head">
                            <span className="cob-section-icon" aria-hidden="true">
                                <i className="fas fa-flask" />
                            </span>
                            <h2 className="cob-section-title">Process-based sources</h2>
                        </div>
                        <p className="cob-lead" style={{ marginBottom: 16 }}>
                            Do you have any industrial processes that generate emissions from chemical or physical
                            reactions (process emissions)? Examples: cement, steel, chemicals, lime, glass production.
                        </p>
                        <YesNoField
                            name="scope1_process"
                            value={s1.hasProcessEmissions}
                            onPick={(v) => applyYesNo('hasProcessEmissions', v)}
                        />
                        {fieldErrors.process && (
                            <span className="cob-field-error">{fieldErrors.process}</span>
                        )}

                        <div
                            className="cob-section-panel"
                            style={{
                                marginTop: 20,
                                marginBottom: 8,
                                padding: 14,
                                background: '#f8fafc',
                                border: '1px solid var(--cob-border, #e2e8f0)',
                                borderRadius: 12,
                            }}
                        >
                            <strong>Sector (from company registration — ISIC Rev.4)</strong>
                            <p style={{ margin: '8px 0 0', fontSize: 14, color: '#334155' }}>
                                {orgIsicDisplay.sectorLabel}
                            </p>
                            <p style={{ margin: '6px 0 0', fontSize: 14, color: '#334155' }}>
                                <strong>Sub-sector:</strong> {orgIsicDisplay.subsectorLabel}
                            </p>
                        </div>
                        <p className="cob-lead" style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>
                            Facility list is loaded from Data Input site mapping (
                            <code style={{ fontSize: 12 }}>urimpact_data_input_sites_</code>
                            ). Add or edit sites under <strong>Data Input</strong> if a plant is missing.
                        </p>

                        {s1.hasProcessEmissions && (
                            <>
                                {s1.processEmissionRows.map((row, i) => {
                                    const typeOptions = typesForProcessSector(row.processSector);
                                    const showProcessOther =
                                        row.processSector === 'OTHER' ||
                                        (row.processType && String(row.processType).endsWith('_OTHER'));
                                    return (
                                        <div
                                            key={row.id}
                                            className="cob-section-panel"
                                            style={{ marginBottom: 16, padding: 16, borderRadius: 12 }}
                                        >
                                            <div
                                                style={{
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center',
                                                    marginBottom: 12,
                                                }}
                                            >
                                                <strong>Facility / process {i + 1}</strong>
                                                {s1.processEmissionRows.length > 1 && (
                                                    <button
                                                        type="button"
                                                        className="cob-btn ghost"
                                                        style={{ padding: '6px 12px', fontSize: 13 }}
                                                        onClick={() => removeProcessRow(row.id)}
                                                    >
                                                        Remove
                                                    </button>
                                                )}
                                            </div>
                                            <div className="cob-grid">
                                                <div className="cob-field cob-span2">
                                                    <label>Facility</label>
                                                    <select
                                                        value={row.facilitySiteId}
                                                        onBlur={blurSave}
                                                        onChange={(e) => {
                                                            const id = e.target.value;
                                                            const site = facilitySites.find((s) => s.id === id);
                                                            updateProcessRow(row.id, {
                                                                facilitySiteId: id,
                                                                facilityLabel:
                                                                    id === 'ORG_LEVEL'
                                                                        ? 'Organization-level (not mapped to a site)'
                                                                        : site
                                                                          ? `${site.name} (${site.code})`
                                                                          : id,
                                                            });
                                                        }}
                                                    >
                                                        <option value="ORG_LEVEL">
                                                            Organization-level / not mapped
                                                        </option>
                                                        {facilitySites.map((s) => (
                                                            <option key={s.id} value={s.id}>
                                                                {s.name} ({s.code}) — {s.city}
                                                            </option>
                                                        ))}
                                                    </select>
                                                    {fieldErrors[`p_fac_${i}`] && (
                                                        <span className="cob-field-error">{fieldErrors[`p_fac_${i}`]}</span>
                                                    )}
                                                </div>

                                                <div className="cob-field cob-span2">
                                                    <h3
                                                        className="cob-section-title"
                                                        style={{ fontSize: 1.05, margin: '12px 0 8px' }}
                                                    >
                                                        Process identification
                                                    </h3>
                                                </div>
                                                <div className="cob-field cob-span2">
                                                    <label>Select process sector</label>
                                                    <select
                                                        value={row.processSector}
                                                        onBlur={blurSave}
                                                        onChange={(e) =>
                                                            updateProcessRow(row.id, {
                                                                processSector: e.target.value,
                                                            })
                                                        }
                                                    >
                                                        {PROCESS_SECTORS.map((s) => (
                                                            <option key={s.value} value={s.value}>
                                                                {s.label}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div className="cob-field cob-span2">
                                                    <label>Process type</label>
                                                    {row.processSector === 'OTHER' ? (
                                                        <p
                                                            style={{
                                                                margin: 0,
                                                                padding: '10px 12px',
                                                                background: '#f1f5f9',
                                                                borderRadius: 8,
                                                                fontSize: 14,
                                                            }}
                                                        >
                                                            Other — describe the process below.
                                                        </p>
                                                    ) : (
                                                        <select
                                                            value={row.processType}
                                                            onBlur={blurSave}
                                                            onChange={(e) =>
                                                                updateProcessRow(row.id, {
                                                                    processType: e.target.value,
                                                                })
                                                            }
                                                        >
                                                            {typeOptions.map((t) => (
                                                                <option key={t.value} value={t.value}>
                                                                    {t.label}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    )}
                                                </div>
                                                {showProcessOther && (
                                                    <div className="cob-field cob-span2">
                                                        <label>
                                                            {row.processSector === 'OTHER'
                                                                ? 'Describe the process'
                                                                : 'Other process (specify)'}
                                                        </label>
                                                        <textarea
                                                            rows={2}
                                                            value={row.processTypeOther}
                                                            onBlur={blurSave}
                                                            onChange={(e) =>
                                                                updateProcessRow(row.id, {
                                                                    processTypeOther: e.target.value,
                                                                })
                                                            }
                                                            placeholder="e.g. specialty clinker additive line, custom furnace…"
                                                        />
                                                        {fieldErrors[`p_ot_${i}`] && (
                                                            <span className="cob-field-error">{fieldErrors[`p_ot_${i}`]}</span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                                <button type="button" className="cob-btn ghost" onClick={addProcessRow}>
                                    + Add another facility / process
                                </button>
                            </>
                        )}
                    </section>
                )}

                {step === 5 && (
                    <>
                        <header className="cob-page-header cob-page-header--review">
                            <div className="cob-page-header-icon cob-page-header-icon--review" aria-hidden="true">
                                <i className="fas fa-clipboard-check" />
                            </div>
                            <div>
                                <h1 className="cob-page-title">Review Scope 1 boundary</h1>
                                <p className="cob-lead">Confirm your inventory before submitting.</p>
                            </div>
                        </header>
                        <div className="cob-summary">
                            <h3 className="cob-summary-heading">Vehicles</h3>
                            <p>{s1.hasOwnedVehicles ? `${s1.vehicles.length} vehicle(s)` : 'None declared'}</p>
                            {s1.hasOwnedVehicles &&
                                s1.vehicles.map((v, i) => (
                                    <p key={v.id} style={{ fontSize: 14 }}>
                                        {i + 1}. {VEHICLE_TYPES.find((x) => x.value === v.vehicleType)?.label} —{' '}
                                        {v.vehicleNumber} — {VEHICLE_FUELS.find((x) => x.value === v.fuelUsed)?.label}
                                    </p>
                                ))}
                            <h3 className="cob-summary-heading">Stationary assets</h3>
                            <p>
                                {s1.hasOwnedStationaryAssets
                                    ? `${s1.stationaryAssets.length} asset(s)`
                                    : 'None declared'}
                            </p>
                            {s1.hasOwnedStationaryAssets &&
                                s1.stationaryAssets.map((a, i) => (
                                    <p key={a.id} style={{ fontSize: 14 }}>
                                        {i + 1}. {ASSET_TYPES.find((x) => x.value === a.assetType)?.label} — {a.assetName}{' '}
                                        — {STATIONARY_FUELS.find((x) => x.value === a.fuelUsed)?.label}
                                    </p>
                                ))}
                            <h3 className="cob-summary-heading">Refrigerants / fugitive</h3>
                            <p>
                                {s1.hasRefrigerantEquipment
                                    ? `${s1.refrigerantRows.length} line(s)`
                                    : 'None declared'}
                            </p>
                            {s1.hasRefrigerantEquipment &&
                                s1.refrigerantRows.map((r, i) => (
                                    <p key={r.id} style={{ fontSize: 14 }}>
                                        {i + 1}. {r.equipmentName} ({r.equipmentType}) × {r.quantity}
                                        {r.refilledInPeriod
                                            ? ` — refilled: ${REFRIGERANT_GASES.find((x) => x.value === r.gasRefilled)?.label || '—'}`
                                            : ' — not refilled in period'}
                                    </p>
                                ))}
                            <h3 className="cob-summary-heading">Process emissions</h3>
                            <p>
                                {s1.hasProcessEmissions
                                    ? `${s1.processEmissionRows.length} facility / process line(s)`
                                    : 'None declared'}
                            </p>
                            {s1.hasProcessEmissions &&
                                s1.processEmissionRows.map((row, i) => (
                                    <p key={row.id} style={{ fontSize: 14 }}>
                                        {i + 1}. {row.facilityLabel} —{' '}
                                        {PROCESS_SECTORS.find((x) => x.value === row.processSector)?.label}:{' '}
                                        {labelForProcessSectorAndType(row.processSector, row.processType)}
                                        {row.processTypeOther
                                            ? ` — note: ${row.processTypeOther}`
                                            : ''}
                                    </p>
                                ))}
                        </div>
                    </>
                )}

                <div className="cob-actions">
                    <button
                        type="button"
                        className="cob-btn ghost"
                        disabled={step === 1}
                        onClick={goBack}
                    >
                        {step === 1 ? (
                            'Back'
                        ) : (
                            <>
                                <i className="fas fa-arrow-left" aria-hidden="true" /> Back
                            </>
                        )}
                    </button>
                    {step < 5 ? (
                        <button type="button" className="cob-btn primary" onClick={goNext}>
                            <span>Save &amp; continue</span>
                            <i className="fas fa-arrow-right" aria-hidden="true" />
                        </button>
                    ) : (
                        <button
                            type="button"
                            className="cob-btn primary"
                            disabled={submitting}
                            onClick={handleSubmit}
                        >
                            {submitting ? (
                                <span>Submitting…</span>
                            ) : (
                                <>
                                    <span>Submit Scope 1 inventory</span>
                                    <i className="fas fa-paper-plane" aria-hidden="true" />
                                </>
                            )}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

import { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import {
    fetchOrganizationMe,
    saveOnboardingDraftApi,
    submitOnboardingApi,
    uploadRegistrationDocument,
    uploadOnboardingFacilityProof,
} from '../../api/client.js';
import { ISIC_SECTORS, REVENUE_CURRENCIES, PHONE_COUNTRY_CODES } from '../../data/isicRev4GHGSectors.js';
import {
    DEPARTMENT_OPTIONS,
    ONBOARDING_FACILITY_TYPES,
    syncOnboardingFacilitiesToDataInputSites,
} from '../../utils/onboardingFacilities.js';
import { canOpenRevisitOnboarding } from '../../utils/onboardingRevisit.js';
import './CompanyOnboarding.css';

const DRAFT_PREFIX = 'urimpact_onboarding_draft_';

function newFacilityId() {
    return typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `fac_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function createFacilityRow() {
    return {
        id: newFacilityId(),
        name: '',
        facilityType: 'CORPORATE_OFFICE',
        facilityTypeOther: '',
        location: '',
        proofDocumentPath: null,
    };
}

const emptyForm = () => ({
    pocFullName: '',
    pocDesignation: '',
    pocDepartment: '',
    pocEmail: '',
    pocCountryCode: '+966',
    pocPhone: '',
    legalName: '',
    commercialRegistrationNumber: '',
    headquarterAddress: '',
    isGroupCompany: false,
    groupCompanyName: '',
    sectorIsicCode: '',
    subSectorIsicCode: '',
    revenueAmount: '',
    revenueCurrency: 'AED',
    employeeCount: '',
});

export default function CompanyOnboarding() {
    const { t } = useTranslation();
    const { user, refreshSession } = useAuth();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const isRevisit = canOpenRevisitOnboarding(user?.role, searchParams);
    const [step, setStep] = useState(1);
    const [form, setForm] = useState(emptyForm);
    const [fieldErrors, setFieldErrors] = useState({});
    const [loading, setLoading] = useState(true);
    const [uploadPct, setUploadPct] = useState(0);
    const [thumbnailUrl, setThumbnailUrl] = useState('');
    const [registrationFilename, setRegistrationFilename] = useState('');
    const [toast, setToast] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [facilities, setFacilities] = useState(() => [createFacilityRow()]);
    const [departmentChoice, setDepartmentChoice] = useState('');
    const [departmentOther, setDepartmentOther] = useState('');
    const [facilityUploadPct, setFacilityUploadPct] = useState({});

    const subsectors = useMemo(() => {
        const sector = ISIC_SECTORS.find((s) => s.code === form.sectorIsicCode);
        return sector?.subsectors || [];
    }, [form.sectorIsicCode]);

    useEffect(() => {
        if (loading || !user?.organizationId) return;
        try {
            localStorage.setItem(
                `${DRAFT_PREFIX}${user.organizationId}`,
                JSON.stringify({
                    ...form,
                    facilities,
                    departmentChoice,
                    departmentOther,
                })
            );
        } catch (_) {
            /* ignore */
        }
    }, [loading, user?.organizationId, form, facilities, departmentChoice, departmentOther]);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const data = await fetchOrganizationMe();
                const org = data.organization;
                const draft = org?.onboardingDraft || {};
                let merged = { ...emptyForm(), ...draft };
                if (user?.organizationId) {
                    try {
                        const raw = localStorage.getItem(`${DRAFT_PREFIX}${user.organizationId}`);
                        if (raw) merged = { ...merged, ...JSON.parse(raw) };
                    } catch (_) {
                        /* ignore */
                    }
                }
                if (!cancelled) {
                    const {
                        facilities: _draftFac,
                        departmentChoice: _dc,
                        departmentOther: _do,
                        ...formFields
                    } = merged;
                    setForm((prev) => ({
                        ...prev,
                        ...formFields,
                        revenueAmount:
                            merged.revenueAmount !== undefined && merged.revenueAmount !== null
                                ? String(merged.revenueAmount)
                                : '',
                        employeeCount:
                            merged.employeeCount !== undefined && merged.employeeCount !== null
                                ? String(merged.employeeCount)
                                : '',
                    }));
                    const draftFac = merged.facilities;
                    let nextFacilities =
                        Array.isArray(draftFac) && draftFac.length ? draftFac : [createFacilityRow()];
                    setFacilities(nextFacilities);

                    let dc = merged.departmentChoice || '';
                    let dOther = merged.departmentOther || '';
                    if (!dc && merged.pocDepartment) {
                        const preset = DEPARTMENT_OPTIONS.find(
                            (o) => o.value === merged.pocDepartment && o.value !== '__OTHER__'
                        );
                        if (preset) dc = preset.value;
                        else {
                            dc = '__OTHER__';
                            dOther = merged.pocDepartment;
                        }
                    }
                    setDepartmentChoice(dc);
                    setDepartmentOther(dOther);

                    if (org?.registrationDocumentPath) {
                        setRegistrationFilename(org.registrationDocumentPath);
                    }
                }
            } catch (_) {
                /* ignore */
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [user?.organizationId]);

    useEffect(() => {
        return () => {
            if (thumbnailUrl) URL.revokeObjectURL(thumbnailUrl);
        };
    }, [thumbnailUrl]);

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    if (user.organizationOnboardingComplete && !isRevisit) {
        return <Navigate to="/" replace />;
    }

    const updateField = (name, value) => {
        setForm((prev) => {
            const next = { ...prev, [name]: value };
            if (name === 'sectorIsicCode') {
                next.subSectorIsicCode = '';
            }
            return next;
        });
        setFieldErrors((e) => ({ ...e, [name]: undefined }));
    };

    const blurSave = async () => {
        const pocDepartment =
            departmentChoice === '__OTHER__' ? departmentOther.trim() : departmentChoice;
        try {
            await saveOnboardingDraftApi({
                ...form,
                pocDepartment,
                facilities,
                departmentChoice,
                departmentOther,
            });
        } catch (_) {
            /* offline draft still in localStorage */
        }
    };

    const validateStep1 = () => {
        const err = {};
        const req = [
            'pocFullName',
            'pocDesignation',
            'pocEmail',
            'pocPhone',
            'legalName',
            'commercialRegistrationNumber',
            'headquarterAddress',
            'sectorIsicCode',
            'subSectorIsicCode',
            'revenueCurrency',
        ];
        req.forEach((k) => {
            if (!String(form[k] || '').trim()) err[k] = 'Required';
        });
        if (!departmentChoice) err.departmentChoice = 'Required';
        if (departmentChoice === '__OTHER__' && !String(departmentOther || '').trim()) {
            err.departmentOther = 'Enter department name';
        }
        const email = String(form.pocEmail || '').trim();
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            err.pocEmail = 'Invalid email';
        }
        const rev = Number(form.revenueAmount);
        if (!form.revenueAmount || Number.isNaN(rev) || rev <= 0) err.revenueAmount = 'Enter a positive amount';
        const emp = parseInt(form.employeeCount, 10);
        if (!form.employeeCount || Number.isNaN(emp) || emp < 1) err.employeeCount = 'Enter a positive integer';
        if (form.isGroupCompany && !String(form.groupCompanyName || '').trim()) {
            err.groupCompanyName = 'Required when Group Company is Yes';
        }
        if (!registrationFilename && !thumbnailUrl) {
            err.registrationDocument = 'Upload registration document';
        }
        const cr = String(form.commercialRegistrationNumber || '').trim();
        if (cr && !/^[a-zA-Z0-9]+$/.test(cr)) {
            err.commercialRegistrationNumber = 'Alphanumeric only';
        }
        setFieldErrors(err);
        return Object.keys(err).length === 0;
    };

    const validateStep2 = () => {
        const err = {};
        if (!facilities.length) err.facilities = 'Add at least one facility';
        facilities.forEach((f, i) => {
            if (!String(f.name || '').trim()) err[`fac_name_${i}`] = 'Required';
            if (!String(f.location || '').trim()) err[`fac_loc_${i}`] = 'Required';
            if (f.facilityType === 'OTHER' && !String(f.facilityTypeOther || '').trim()) {
                err[`fac_ot_${i}`] = 'Specify facility type';
            }
        });
        setFieldErrors(err);
        return Object.keys(err).length === 0;
    };

    const handleFile = async (file) => {
        if (!file) return;
        setFieldErrors((e) => ({ ...e, registrationDocument: undefined }));
        if (thumbnailUrl) URL.revokeObjectURL(thumbnailUrl);
        if (file.type.startsWith('image/')) {
            setThumbnailUrl(URL.createObjectURL(file));
        } else {
            setThumbnailUrl('');
        }
        setUploadPct(0);
        try {
            const { filename } = await uploadRegistrationDocument(file, setUploadPct);
            setRegistrationFilename(filename);
            setUploadPct(100);
        } catch (e) {
            setFieldErrors((err) => ({
                ...err,
                registrationDocument: e?.message || 'Upload failed',
            }));
        }
    };

    const updateFacility = (index, patch) => {
        setFacilities((prev) =>
            prev.map((row, i) => (i === index ? { ...row, ...patch } : row))
        );
        setFieldErrors((e) => {
            const next = { ...e };
            Object.keys(next).forEach((k) => {
                if (k.startsWith('fac_')) delete next[k];
            });
            if (next.facilities) delete next.facilities;
            return next;
        });
    };

    const addFacilityRow = () => {
        setFacilities((prev) => [...prev, createFacilityRow()]);
    };

    const removeFacilityRow = (index) => {
        setFacilities((prev) =>
            prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)
        );
    };

    const handleFacilityProof = async (index, file) => {
        if (!file) return;
        setFacilityUploadPct((p) => ({ ...p, [index]: 1 }));
        try {
            const { filename } = await uploadOnboardingFacilityProof(file, (pct) =>
                setFacilityUploadPct((prev) => ({ ...prev, [index]: pct }))
            );
            updateFacility(index, { proofDocumentPath: filename });
            setFacilityUploadPct((prev) => ({ ...prev, [index]: 100 }));
        } catch (e) {
            setFieldErrors((err) => ({
                ...err,
                [`fac_proof_${index}`]: e?.message || 'Upload failed',
            }));
            setFacilityUploadPct((prev) => ({ ...prev, [index]: 0 }));
        }
    };

    const goNext = async () => {
        if (step === 1) {
            if (!validateStep1()) return;
            await blurSave();
            setStep(2);
        } else if (step === 2) {
            if (!validateStep2()) return;
            await blurSave();
            setStep(3);
        }
        window.scrollTo(0, 0);
    };

    const goBack = () => {
        setStep((s) => Math.max(1, s - 1));
        window.scrollTo(0, 0);
    };

    const handleSubmit = async () => {
        if (!validateStep1()) {
            setStep(1);
            return;
        }
        if (!validateStep2()) {
            setStep(2);
            return;
        }
        setSubmitting(true);
        const pocDepartment =
            departmentChoice === '__OTHER__' ? departmentOther.trim() : departmentChoice;
        try {
            await submitOnboardingApi({
                legalName: form.legalName.trim(),
                commercialRegistrationNumber: form.commercialRegistrationNumber.trim(),
                headquarterAddress: form.headquarterAddress.trim(),
                isGroupCompany: !!form.isGroupCompany,
                groupCompanyName: form.isGroupCompany ? form.groupCompanyName.trim() : null,
                sectorIsicCode: form.sectorIsicCode,
                subSectorIsicCode: form.subSectorIsicCode,
                revenueAmount: Number(form.revenueAmount),
                revenueCurrency: form.revenueCurrency,
                employeeCount: parseInt(form.employeeCount, 10),
                pocFullName: form.pocFullName.trim(),
                pocDesignation: form.pocDesignation.trim(),
                pocDepartment,
                pocEmail: form.pocEmail.trim(),
                pocPhone: form.pocPhone.trim(),
                pocCountryCode: form.pocCountryCode,
                facilities: facilities.map((f) => ({
                    id: f.id,
                    name: f.name.trim(),
                    facilityType: f.facilityType,
                    facilityTypeOther:
                        f.facilityType === 'OTHER'
                            ? String(f.facilityTypeOther || '').trim() || null
                            : null,
                    location: f.location.trim(),
                    proofDocumentPath: f.proofDocumentPath || null,
                })),
            });
            await refreshSession();
            if (user?.organizationId) {
                syncOnboardingFacilitiesToDataInputSites(user.organizationId, facilities);
            }
            setToast('Company profile submitted successfully.');
            setTimeout(() => navigate(isRevisit ? '/' : '/scope-onboarding', { replace: true }), 600);
        } catch (e) {
            setToast(e?.message || 'Submission failed');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="loading-screen cob-loading">
                <div className="spinner" />
            </div>
        );
    }

    return (
        <div className="cob-page">
            {isRevisit && (
                <div className="cob-revisit-banner" role="status">
                    <i className="fas fa-pen-to-square" aria-hidden />
                    <span>{t('onboarding.revisitBannerCompany')}</span>
                </div>
            )}
            {toast && (
                <div className={`cob-toast ${toast.includes('failed') || toast.includes('Upload') ? 'cob-toast-err' : ''}`}>
                    {toast}
                </div>
            )}
            <div className="cob-inner">
                <nav className="cob-stepper" aria-label="Onboarding progress">
                    <div className={`cob-step ${step === 1 ? 'cob-step-active' : ''} ${step > 1 ? 'cob-step-done' : ''}`}>
                        <span className="cob-step-num" aria-hidden="true">
                            {step > 1 ? '✓' : '1'}
                        </span>
                        <div className="cob-step-text">
                            <span className="cob-step-label">Company profile</span>
                            <span className="cob-step-sub">POC &amp; legal details</span>
                        </div>
                    </div>
                    <div className="cob-step-connector" aria-hidden="true" />
                    <div className={`cob-step ${step === 2 ? 'cob-step-active' : ''} ${step > 2 ? 'cob-step-done' : ''}`}>
                        <span className="cob-step-num" aria-hidden="true">
                            {step > 2 ? '✓' : '2'}
                        </span>
                        <div className="cob-step-text">
                            <span className="cob-step-label">Facility mapping</span>
                            <span className="cob-step-sub">Sites &amp; locations</span>
                        </div>
                    </div>
                    <div className="cob-step-connector" aria-hidden="true" />
                    <div className={`cob-step ${step === 3 ? 'cob-step-active' : ''}`}>
                        <span className="cob-step-num" aria-hidden="true">
                            3
                        </span>
                        <div className="cob-step-text">
                            <span className="cob-step-label">Review</span>
                            <span className="cob-step-sub">Confirm &amp; submit</span>
                        </div>
                    </div>
                </nav>

                {step === 1 && (
                    <>
                        <header className="cob-page-header">
                            <div className="cob-page-header-icon" aria-hidden="true">
                                <i className="fas fa-building-user" />
                            </div>
                            <div>
                                <h1 className="cob-page-title">Company onboarding</h1>
                                <p className="cob-lead">
                                    Primary contact and legal entity details (GHG Protocol–aligned sector classification).
                                </p>
                            </div>
                        </header>

                        <section className="cob-section cob-section-panel">
                            <div className="cob-section-head">
                                <span className="cob-section-icon" aria-hidden="true">
                                    <i className="fas fa-user-tie" />
                                </span>
                                <h2 className="cob-section-title">Primary contact</h2>
                            </div>
                            <div className="cob-grid">
                                <div className="cob-field">
                                    <label>Full name</label>
                                    <input
                                        value={form.pocFullName}
                                        onBlur={blurSave}
                                        onChange={(e) => updateField('pocFullName', e.target.value)}
                                    />
                                    {fieldErrors.pocFullName && (
                                        <span className="cob-field-error">{fieldErrors.pocFullName}</span>
                                    )}
                                </div>
                                <div className="cob-field">
                                    <label>Designation</label>
                                    <input
                                        value={form.pocDesignation}
                                        onBlur={blurSave}
                                        onChange={(e) => updateField('pocDesignation', e.target.value)}
                                    />
                                    {fieldErrors.pocDesignation && (
                                        <span className="cob-field-error">{fieldErrors.pocDesignation}</span>
                                    )}
                                </div>
                                <div className="cob-field">
                                    <label>Department</label>
                                    <select
                                        value={departmentChoice}
                                        onBlur={blurSave}
                                        onChange={(e) => {
                                            const v = e.target.value;
                                            setDepartmentChoice(v);
                                            if (v !== '__OTHER__') setDepartmentOther('');
                                            setFieldErrors((err) => ({
                                                ...err,
                                                departmentChoice: undefined,
                                                departmentOther: undefined,
                                            }));
                                        }}
                                    >
                                        <option value="">Select department</option>
                                        {DEPARTMENT_OPTIONS.map((o) => (
                                            <option key={o.value} value={o.value}>
                                                {o.label}
                                            </option>
                                        ))}
                                    </select>
                                    {fieldErrors.departmentChoice && (
                                        <span className="cob-field-error">{fieldErrors.departmentChoice}</span>
                                    )}
                                </div>
                                {departmentChoice === '__OTHER__' && (
                                    <div className="cob-field">
                                        <label>Specify department</label>
                                        <input
                                            value={departmentOther}
                                            onBlur={blurSave}
                                            onChange={(e) => setDepartmentOther(e.target.value)}
                                        />
                                        {fieldErrors.departmentOther && (
                                            <span className="cob-field-error">{fieldErrors.departmentOther}</span>
                                        )}
                                    </div>
                                )}
                                <div className="cob-field">
                                    <label>Email</label>
                                    <input
                                        type="email"
                                        value={form.pocEmail}
                                        onBlur={blurSave}
                                        onChange={(e) => updateField('pocEmail', e.target.value)}
                                    />
                                    {fieldErrors.pocEmail && <span className="cob-field-error">{fieldErrors.pocEmail}</span>}
                                </div>
                                <div className="cob-field cob-phone">
                                    <label>Phone</label>
                                    <div className="cob-phone-row">
                                        <select
                                            value={form.pocCountryCode}
                                            onBlur={blurSave}
                                            onChange={(e) => updateField('pocCountryCode', e.target.value)}
                                        >
                                            {PHONE_COUNTRY_CODES.map((o) => (
                                                <option key={o.code} value={o.code}>
                                                    {o.label}
                                                </option>
                                            ))}
                                        </select>
                                        <input
                                            type="tel"
                                            placeholder="Number"
                                            value={form.pocPhone}
                                            onBlur={blurSave}
                                            onChange={(e) => updateField('pocPhone', e.target.value)}
                                        />
                                    </div>
                                    {fieldErrors.pocPhone && <span className="cob-field-error">{fieldErrors.pocPhone}</span>}
                                </div>
                            </div>
                        </section>

                        <section className="cob-section cob-section-panel">
                            <div className="cob-section-head">
                                <span className="cob-section-icon" aria-hidden="true">
                                    <i className="fas fa-landmark" />
                                </span>
                                <h2 className="cob-section-title">Company information</h2>
                            </div>
                            <div className="cob-grid">
                                <div className="cob-field cob-span2">
                                    <label>Legal name</label>
                                    <input
                                        value={form.legalName}
                                        onBlur={blurSave}
                                        onChange={(e) => updateField('legalName', e.target.value)}
                                    />
                                    {fieldErrors.legalName && <span className="cob-field-error">{fieldErrors.legalName}</span>}
                                </div>
                                <div className="cob-field">
                                    <label>Commercial registration number</label>
                                    <input
                                        value={form.commercialRegistrationNumber}
                                        onBlur={blurSave}
                                        onChange={(e) => updateField('commercialRegistrationNumber', e.target.value)}
                                    />
                                    {fieldErrors.commercialRegistrationNumber && (
                                        <span className="cob-field-error">{fieldErrors.commercialRegistrationNumber}</span>
                                    )}
                                </div>
                                <div className="cob-field cob-span2">
                                    <label>Headquarter address</label>
                                    <textarea
                                        rows={3}
                                        value={form.headquarterAddress}
                                        onBlur={blurSave}
                                        onChange={(e) => updateField('headquarterAddress', e.target.value)}
                                    />
                                    {fieldErrors.headquarterAddress && (
                                        <span className="cob-field-error">{fieldErrors.headquarterAddress}</span>
                                    )}
                                </div>

                                <div className="cob-field cob-span2">
                                    <label>Registration document (PDF / JPG / PNG, max 10MB)</label>
                                    <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => handleFile(e.target.files?.[0])} />
                                    {uploadPct > 0 && uploadPct < 100 && (
                                        <div className="cob-progress">
                                            <div style={{ width: `${uploadPct}%` }} />
                                        </div>
                                    )}
                                    {thumbnailUrl && (
                                        <img src={thumbnailUrl} alt="" className="cob-thumb" />
                                    )}
                                    {registrationFilename && (
                                        <p className="cob-file-meta">Saved: {registrationFilename}</p>
                                    )}
                                    {fieldErrors.registrationDocument && (
                                        <span className="cob-field-error">{fieldErrors.registrationDocument}</span>
                                    )}
                                </div>

                                <div className="cob-field cob-toggle">
                                    <label>
                                        <input
                                            type="checkbox"
                                            checked={form.isGroupCompany}
                                            onChange={(e) => updateField('isGroupCompany', e.target.checked)}
                                        />
                                        Group company
                                    </label>
                                </div>
                                {form.isGroupCompany && (
                                    <div className="cob-field cob-span2">
                                        <label>Group company name</label>
                                        <input
                                            value={form.groupCompanyName}
                                            onBlur={blurSave}
                                            onChange={(e) => updateField('groupCompanyName', e.target.value)}
                                        />
                                        {fieldErrors.groupCompanyName && (
                                            <span className="cob-field-error">{fieldErrors.groupCompanyName}</span>
                                        )}
                                    </div>
                                )}

                                <div className="cob-field">
                                    <label>Sector (ISIC Rev.4)</label>
                                    <select
                                        value={form.sectorIsicCode}
                                        onBlur={blurSave}
                                        onChange={(e) => updateField('sectorIsicCode', e.target.value)}
                                    >
                                        <option value="">Select sector</option>
                                        {ISIC_SECTORS.map((s) => (
                                            <option key={s.code} value={s.code}>
                                                {s.label}
                                            </option>
                                        ))}
                                    </select>
                                    {fieldErrors.sectorIsicCode && (
                                        <span className="cob-field-error">{fieldErrors.sectorIsicCode}</span>
                                    )}
                                </div>
                                <div className="cob-field">
                                    <label>Sub-sector</label>
                                    <select
                                        value={form.subSectorIsicCode}
                                        onBlur={blurSave}
                                        onChange={(e) => updateField('subSectorIsicCode', e.target.value)}
                                        disabled={!form.sectorIsicCode}
                                    >
                                        <option value="">Select sub-sector</option>
                                        {subsectors.map((s) => (
                                            <option key={s.code} value={s.code}>
                                                {s.label}
                                            </option>
                                        ))}
                                    </select>
                                    {fieldErrors.subSectorIsicCode && (
                                        <span className="cob-field-error">{fieldErrors.subSectorIsicCode}</span>
                                    )}
                                </div>

                                <div className="cob-field cob-revenue">
                                    <label>Revenue (current year)</label>
                                    <div className="cob-revenue-row">
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={form.revenueAmount}
                                            onBlur={blurSave}
                                            onChange={(e) => updateField('revenueAmount', e.target.value)}
                                        />
                                        <select
                                            value={form.revenueCurrency}
                                            onBlur={blurSave}
                                            onChange={(e) => updateField('revenueCurrency', e.target.value)}
                                        >
                                            {REVENUE_CURRENCIES.map((c) => (
                                                <option key={c} value={c}>
                                                    {c}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    {fieldErrors.revenueAmount && (
                                        <span className="cob-field-error">{fieldErrors.revenueAmount}</span>
                                    )}
                                </div>

                                <div className="cob-field">
                                    <label>Total employees</label>
                                    <input
                                        type="number"
                                        min="1"
                                        step="1"
                                        value={form.employeeCount}
                                        onBlur={blurSave}
                                        onChange={(e) => updateField('employeeCount', e.target.value)}
                                    />
                                    {fieldErrors.employeeCount && (
                                        <span className="cob-field-error">{fieldErrors.employeeCount}</span>
                                    )}
                                </div>
                            </div>
                        </section>

                        <div className="cob-actions">
                            <button type="button" className="cob-btn ghost" disabled>
                                Back
                            </button>
                            <button type="button" className="cob-btn primary" onClick={goNext}>
                                <span>Save &amp; continue</span>
                                <i className="fas fa-arrow-right" aria-hidden="true" />
                            </button>
                        </div>
                    </>
                )}

                {step === 2 && (
                    <>
                        <header className="cob-page-header">
                            <div className="cob-page-header-icon" aria-hidden="true">
                                <i className="fas fa-map-location-dot" />
                            </div>
                            <div>
                                <h1 className="cob-page-title">Facility mapping</h1>
                                <p className="cob-lead">
                                    Map operating sites and locations (GHG inventory boundary). At least one facility
                                    is required. Proof of address is optional.
                                </p>
                            </div>
                        </header>
                        {fieldErrors.facilities && (
                            <p className="cob-field-error" style={{ marginBottom: 12 }}>
                                {fieldErrors.facilities}
                            </p>
                        )}
                        {facilities.map((f, i) => (
                            <section key={f.id} className="cob-section cob-section-panel" style={{ marginBottom: 18 }}>
                                <div
                                    style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        marginBottom: 12,
                                    }}
                                >
                                    <h2 className="cob-section-title" style={{ margin: 0 }}>
                                        Facility {i + 1}
                                    </h2>
                                    {facilities.length > 1 && (
                                        <button
                                            type="button"
                                            className="cob-btn ghost"
                                            style={{ padding: '6px 12px', fontSize: 13 }}
                                            onClick={() => removeFacilityRow(i)}
                                        >
                                            Remove
                                        </button>
                                    )}
                                </div>
                                <div className="cob-grid">
                                    <div className="cob-field cob-span2">
                                        <label>Facility name</label>
                                        <input
                                            value={f.name}
                                            onBlur={blurSave}
                                            onChange={(e) => updateFacility(i, { name: e.target.value })}
                                        />
                                        {fieldErrors[`fac_name_${i}`] && (
                                            <span className="cob-field-error">{fieldErrors[`fac_name_${i}`]}</span>
                                        )}
                                    </div>
                                    <div className="cob-field">
                                        <label>Facility type</label>
                                        <select
                                            value={f.facilityType}
                                            onBlur={blurSave}
                                            onChange={(e) => {
                                                const v = e.target.value;
                                                updateFacility(i, {
                                                    facilityType: v,
                                                    facilityTypeOther: v === 'OTHER' ? f.facilityTypeOther : '',
                                                });
                                            }}
                                        >
                                            {ONBOARDING_FACILITY_TYPES.map((o) => (
                                                <option key={o.value} value={o.value}>
                                                    {o.label}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    {f.facilityType === 'OTHER' && (
                                        <div className="cob-field cob-span2">
                                            <label>Other facility type</label>
                                            <input
                                                value={f.facilityTypeOther}
                                                onBlur={blurSave}
                                                onChange={(e) =>
                                                    updateFacility(i, { facilityTypeOther: e.target.value })
                                                }
                                            />
                                            {fieldErrors[`fac_ot_${i}`] && (
                                                <span className="cob-field-error">{fieldErrors[`fac_ot_${i}`]}</span>
                                            )}
                                        </div>
                                    )}
                                    <div className="cob-field cob-span2">
                                        <label>Location (street, city, state, country, PIN)</label>
                                        <textarea
                                            rows={3}
                                            value={f.location}
                                            onBlur={blurSave}
                                            onChange={(e) => updateFacility(i, { location: e.target.value })}
                                        />
                                        {fieldErrors[`fac_loc_${i}`] && (
                                            <span className="cob-field-error">{fieldErrors[`fac_loc_${i}`]}</span>
                                        )}
                                    </div>
                                    <div className="cob-field cob-span2">
                                        <label>Proof document (PDF / JPG / PNG — optional)</label>
                                        <input
                                            type="file"
                                            accept=".pdf,.jpg,.jpeg,.png"
                                            onChange={(e) => handleFacilityProof(i, e.target.files?.[0])}
                                        />
                                        {facilityUploadPct[i] > 0 && facilityUploadPct[i] < 100 && (
                                            <div className="cob-progress">
                                                <div style={{ width: `${facilityUploadPct[i]}%` }} />
                                            </div>
                                        )}
                                        {f.proofDocumentPath && (
                                            <p className="cob-file-meta">Saved: {f.proofDocumentPath}</p>
                                        )}
                                        {fieldErrors[`fac_proof_${i}`] && (
                                            <span className="cob-field-error">{fieldErrors[`fac_proof_${i}`]}</span>
                                        )}
                                    </div>
                                </div>
                            </section>
                        ))}
                        <button type="button" className="cob-btn ghost" onClick={addFacilityRow}>
                            + Add another facility
                        </button>
                        <div className="cob-actions">
                            <button type="button" className="cob-btn ghost" onClick={goBack}>
                                <i className="fas fa-arrow-left" aria-hidden="true" />
                                Back
                            </button>
                            <button type="button" className="cob-btn primary" onClick={goNext}>
                                <span>Save &amp; continue</span>
                                <i className="fas fa-arrow-right" aria-hidden="true" />
                            </button>
                        </div>
                    </>
                )}

                {step === 3 && (
                    <>
                        <header className="cob-page-header cob-page-header--review">
                            <div className="cob-page-header-icon cob-page-header-icon--review" aria-hidden="true">
                                <i className="fas fa-clipboard-check" />
                            </div>
                            <div>
                                <h1 className="cob-page-title">Review &amp; submit</h1>
                                <p className="cob-lead">Check everything below, then submit to finish company onboarding.</p>
                            </div>
                        </header>
                        <div className="cob-summary">
                            <h3 className="cob-summary-heading">Primary contact</h3>
                            <p>
                                {form.pocFullName}, {form.pocDesignation},{' '}
                                {departmentChoice === '__OTHER__' ? departmentOther : departmentChoice || '—'}
                            </p>
                            <p>
                                {form.pocEmail} · {form.pocCountryCode} {form.pocPhone}
                            </p>
                            <h3 className="cob-summary-heading">Company</h3>
                            <p>
                                <strong>{form.legalName}</strong> — CR {form.commercialRegistrationNumber}
                            </p>
                            <p>{form.headquarterAddress}</p>
                            <p>
                                Sector {form.sectorIsicCode} / Sub {form.subSectorIsicCode} · Revenue{' '}
                                {form.revenueAmount} {form.revenueCurrency} · Employees {form.employeeCount}
                            </p>
                            <p>Registration file: {registrationFilename || '—'}</p>
                            <h3 className="cob-summary-heading">Facilities</h3>
                            {facilities.map((f, i) => (
                                <p key={f.id} style={{ fontSize: 14 }}>
                                    {i + 1}. <strong>{f.name || '—'}</strong> —{' '}
                                    {ONBOARDING_FACILITY_TYPES.find((x) => x.value === f.facilityType)?.label}
                                    {f.facilityType === 'OTHER' && f.facilityTypeOther
                                        ? ` (${f.facilityTypeOther})`
                                        : ''}
                                    . {f.location ? `${f.location.slice(0, 120)}${f.location.length > 120 ? '…' : ''}` : ''}
                                    {f.proofDocumentPath ? ` · Proof: ${f.proofDocumentPath}` : ''}
                                </p>
                            ))}
                        </div>
                        <div className="cob-actions">
                            <button type="button" className="cob-btn ghost" onClick={goBack}>
                                <i className="fas fa-arrow-left" aria-hidden="true" />
                                Back
                            </button>
                            <button type="button" className="cob-btn primary" disabled={submitting} onClick={handleSubmit}>
                                {submitting ? (
                                    <span>Submitting…</span>
                                ) : (
                                    <>
                                        <span>Submit company profile</span>
                                        <i className="fas fa-paper-plane" aria-hidden="true" />
                                    </>
                                )}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

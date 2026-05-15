import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import {
    ESG_GRI2_DRAFT_KEY,
    GRI2_ORG_EMPTY,
    GRI2_SECTIONS,
} from './esgGri2OrganizationalConfig.js';

function draftStorageKey(organizationId) {
    return organizationId ? `${ESG_GRI2_DRAFT_KEY}_${organizationId}` : ESG_GRI2_DRAFT_KEY;
}

export default function ESGGri2OrganizationalForm({ onBack }) {
    const { t } = useTranslation();
    const { user } = useAuth();
    const [form, setForm] = useState(GRI2_ORG_EMPTY);
    const [savedToast, setSavedToast] = useState(false);

    const loadDraft = useCallback(() => {
        const key = draftStorageKey(user?.organizationId);
        try {
            const raw = localStorage.getItem(key);
            if (raw) {
                setForm({ ...GRI2_ORG_EMPTY(), ...JSON.parse(raw) });
                return;
            }
        } catch (_) {
            /* ignore */
        }
        if (user?.company) {
            setForm((prev) => ({ ...prev, legalName: user.company }));
        }
    }, [user?.organizationId, user?.company]);

    useEffect(() => {
        loadDraft();
    }, [loadDraft]);

    const updateField = (name, value) => {
        setForm((prev) => ({ ...prev, [name]: value }));
        setSavedToast(false);
    };

    const handleSave = () => {
        try {
            localStorage.setItem(draftStorageKey(user?.organizationId), JSON.stringify(form));
            setSavedToast(true);
            setTimeout(() => setSavedToast(false), 3000);
        } catch (_) {
            /* ignore */
        }
    };

    const renderField = (field) => {
        if (field.showWhen && !field.showWhen(form)) return null;
        const label = t(`esgModule.gri2.${field.labelKey}`);
        const id = `esg-gri2-${field.name}`;

        if (field.type === 'textarea') {
            return (
                <label key={field.name} className="esg-fg" htmlFor={id}>
                    <span className="esg-fl">
                        {label}
                        {field.required && <span className="esg-req"> *</span>}
                    </span>
                    <textarea
                        id={id}
                        className="esg-fta"
                        rows={4}
                        value={form[field.name]}
                        onChange={(e) => updateField(field.name, e.target.value)}
                    />
                </label>
            );
        }

        if (field.type === 'select') {
            return (
                <label key={field.name} className="esg-fg" htmlFor={id}>
                    <span className="esg-fl">
                        {label}
                        {field.required && <span className="esg-req"> *</span>}
                    </span>
                    <select
                        id={id}
                        className="esg-fsel"
                        value={form[field.name]}
                        onChange={(e) => updateField(field.name, e.target.value)}
                    >
                        <option value="">{t('esgModule.gri2.selectPlaceholder')}</option>
                        {field.options.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                                {t(`esgModule.gri2.${opt.labelKey}`)}
                            </option>
                        ))}
                    </select>
                </label>
            );
        }

        if (field.type === 'radio') {
            return (
                <fieldset key={field.name} className="esg-fg esg-fg--radio">
                    <legend className="esg-fl">
                        {label}
                        {field.required && <span className="esg-req"> *</span>}
                    </legend>
                    <div className="esg-radio-group">
                        {field.options.map((opt) => (
                            <label key={opt.value} className="esg-radio-label">
                                <input
                                    type="radio"
                                    name={field.name}
                                    value={opt.value}
                                    checked={form[field.name] === opt.value}
                                    onChange={() => updateField(field.name, opt.value)}
                                />
                                {t(`esgModule.gri2.${opt.labelKey}`)}
                            </label>
                        ))}
                    </div>
                </fieldset>
            );
        }

        return (
            <label key={field.name} className="esg-fg" htmlFor={id}>
                <span className="esg-fl">
                    {label}
                    {field.required && <span className="esg-req"> *</span>}
                </span>
                <input
                    id={id}
                    type="text"
                    className="esg-fi"
                    value={form[field.name]}
                    onChange={(e) => updateField(field.name, e.target.value)}
                />
            </label>
        );
    };

    return (
        <div className="esg-gri2-detail">
            <div className="esg-gri2-toolbar">
                <button type="button" className="esg-back-link" onClick={onBack}>
                    <i className="fas fa-arrow-left" aria-hidden />
                    {t('esgModule.gri2.backToGeneral')}
                </button>
                {savedToast && (
                    <span className="esg-save-toast" role="status">
                        {t('esgModule.gri2.saved')}
                    </span>
                )}
                <button type="button" className="esg-btn esg-btn--primary" onClick={handleSave}>
                    {t('esgModule.gri2.save')}
                </button>
            </div>

            <div className="esg-gri2-intro">
                <div className="esg-egri">GRI 2</div>
                <h2 className="esg-gri2-heading">{t('esgModule.gri2.pageTitle')}</h2>
                <p className="esg-gri2-desc">{t('esgModule.gri2.pageDesc')}</p>
            </div>

            {GRI2_SECTIONS.map((section) => (
                <section key={section.id} className="esg-gri2-section">
                    <h3 className="esg-gri2-section-title">
                        {section.id} {t(`esgModule.gri2.${section.titleKey}`)}
                    </h3>
                    <div className="esg-gri2-fields">
                        {section.fields.map((field) => renderField(field))}
                    </div>
                </section>
            ))}
        </div>
    );
}

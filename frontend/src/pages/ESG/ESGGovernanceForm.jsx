import { useEffect, useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { GOV_DISCLOSURES, emptyGovForm } from './esgGovernanceConfig.js';

function draftStorageKey(baseKey, organizationId) {
    return organizationId ? `${baseKey}_${organizationId}` : baseKey;
}

export default function ESGGovernanceForm({ formKey, onBack }) {
    const config = GOV_DISCLOSURES[formKey];
    const { t } = useTranslation();
    const { user } = useAuth();
    const [form, setForm] = useState(() => emptyGovForm(config));
    const [savedToast, setSavedToast] = useState(false);
    const [fileNames, setFileNames] = useState({});
    const fileInputRefs = useRef({});

    const loadDraft = useCallback(() => {
        const key = draftStorageKey(config.draftKey, user?.organizationId);
        try {
            const raw = localStorage.getItem(key);
            if (raw) {
                setForm({ ...emptyGovForm(config), ...JSON.parse(raw) });
            }
        } catch (_) {
            /* ignore */
        }
        try {
            const fnKey = `${draftStorageKey(config.draftKey, user?.organizationId)}_files`;
            const raw = localStorage.getItem(fnKey);
            if (raw) setFileNames(JSON.parse(raw));
        } catch (_) {
            /* ignore */
        }
    }, [config, user?.organizationId]);

    useEffect(() => {
        loadDraft();
    }, [loadDraft]);

    const updateField = (name, value) => {
        setForm((prev) => ({ ...prev, [name]: value }));
        setSavedToast(false);
    };

    const handleCheckbox = (fieldName, optionValue, checked) => {
        setForm((prev) => {
            const current = Array.isArray(prev[fieldName]) ? prev[fieldName] : [];
            const next = checked
                ? [...current, optionValue]
                : current.filter((v) => v !== optionValue);
            return { ...prev, [fieldName]: next };
        });
        setSavedToast(false);
    };

    const handleFileChange = (fieldName, e) => {
        const file = e.target.files?.[0];
        if (file) {
            setFileNames((prev) => ({ ...prev, [fieldName]: file.name }));
            updateField(fieldName, file.name);
        }
    };

    const handleSave = () => {
        try {
            const storageKey = draftStorageKey(config.draftKey, user?.organizationId);
            localStorage.setItem(storageKey, JSON.stringify(form));
            localStorage.setItem(`${storageKey}_files`, JSON.stringify(fileNames));
            setSavedToast(true);
            setTimeout(() => setSavedToast(false), 3000);
        } catch (_) {
            /* ignore */
        }
    };

    const renderField = (field) => {
        if (field.showWhen && !field.showWhen(form)) return null;
        const label = t(`esgModule.gov.${field.labelKey}`);
        const id = `esg-gov-${formKey}-${field.name}`;

        if (field.type === 'number') {
            return (
                <label key={field.name} className="esg-fg" htmlFor={id}>
                    <span className="esg-fl">{label}</span>
                    <input
                        id={id}
                        type="number"
                        className="esg-fi"
                        min="0"
                        value={form[field.name]}
                        onChange={(e) => updateField(field.name, e.target.value)}
                    />
                </label>
            );
        }

        if (field.type === 'radio') {
            return (
                <fieldset key={field.name} className="esg-fg esg-fg--radio">
                    <legend className="esg-fl">{label}</legend>
                    <div className="esg-radio-group">
                        {field.options.map((opt) => (
                            <label key={opt.value} className="esg-radio-label">
                                <input
                                    type="radio"
                                    name={`${formKey}-${field.name}`}
                                    value={opt.value}
                                    checked={form[field.name] === opt.value}
                                    onChange={() => updateField(field.name, opt.value)}
                                />
                                {t(`esgModule.gov.${opt.labelKey}`)}
                            </label>
                        ))}
                    </div>
                </fieldset>
            );
        }

        if (field.type === 'select') {
            return (
                <label key={field.name} className="esg-fg" htmlFor={id}>
                    <span className="esg-fl">{label}</span>
                    <select
                        id={id}
                        className="esg-fsel"
                        value={form[field.name]}
                        onChange={(e) => updateField(field.name, e.target.value)}
                    >
                        <option value="">{t('esgModule.gov.selectPlaceholder')}</option>
                        {field.options.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                                {t(`esgModule.gov.${opt.labelKey}`)}
                            </option>
                        ))}
                    </select>
                </label>
            );
        }

        if (field.type === 'checkboxes') {
            const currentValues = Array.isArray(form[field.name]) ? form[field.name] : [];
            return (
                <fieldset key={field.name} className="esg-fg esg-fg--radio">
                    <legend className="esg-fl">{label}</legend>
                    <div className="esg-checkbox-group">
                        {field.options.map((opt) => (
                            <label key={opt.value} className="esg-radio-label">
                                <input
                                    type="checkbox"
                                    checked={currentValues.includes(opt.value)}
                                    onChange={(e) => handleCheckbox(field.name, opt.value, e.target.checked)}
                                />
                                {t(`esgModule.gov.${opt.labelKey}`)}
                            </label>
                        ))}
                    </div>
                </fieldset>
            );
        }

        if (field.type === 'file') {
            return (
                <div key={field.name} className="esg-fg">
                    <span className="esg-fl">{label}</span>
                    <div className="esg-file-upload">
                        <input
                            ref={(el) => { fileInputRefs.current[field.name] = el; }}
                            id={id}
                            type="file"
                            className="esg-file-input"
                            onChange={(e) => handleFileChange(field.name, e)}
                        />
                        <button
                            type="button"
                            className="esg-btn-sm esg-btn-sm--outline"
                            onClick={() => fileInputRefs.current[field.name]?.click()}
                        >
                            Choose File
                        </button>
                        {(fileNames[field.name] || form[field.name]) && (
                            <span className="esg-file-name">{fileNames[field.name] || form[field.name]}</span>
                        )}
                    </div>
                </div>
            );
        }

        if (field.type === 'textarea') {
            return (
                <label key={field.name} className="esg-fg" htmlFor={id}>
                    <span className="esg-fl">{label}</span>
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

        // Default: text
        return (
            <label key={field.name} className="esg-fg" htmlFor={id}>
                <span className="esg-fl">{label}</span>
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
                    {t('esgModule.gov.backToGovernance')}
                </button>
                {savedToast && (
                    <span className="esg-save-toast" role="status">
                        {t('esgModule.gov.saved')}
                    </span>
                )}
                <button type="button" className="esg-btn esg-btn--primary" onClick={handleSave}>
                    {t('esgModule.gov.save')}
                </button>
            </div>

            <div className="esg-gri2-intro">
                <div className="esg-egri" style={{ background: '#F4E8FB', color: '#8E44AD' }}>
                    {config.griCode}
                </div>
                <h2 className="esg-gri2-heading">{t(`esgModule.gov.${config.titleKey}`)}</h2>
                <p className="esg-gri2-desc">{t(`esgModule.gov.${config.descKey}`)}</p>
            </div>

            {config.sections.map((section, idx) => (
                <section key={section.titleKey || idx} className="esg-gri2-section">
                    <h3 className="esg-gri2-section-title">
                        {t(`esgModule.gov.${section.titleKey}`)}
                    </h3>
                    {section.fields.length > 0 && (
                        <div className="esg-gri2-fields">
                            {section.fields.map((field) => renderField(field))}
                        </div>
                    )}
                </section>
            ))}
        </div>
    );
}
